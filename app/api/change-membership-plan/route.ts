import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/auth/requestUser';
import { refuseClosedBox } from '@/lib/boxEntryGuard';
import { SCHEDULE_MARK, codeFromDbError, modeOf, planRefusal, type PlanLite } from '@/lib/membership/planChange';
import {
  blockError, connectAccount, getConnectStripe, idempotencyKey, loadBlockReason, loadMember, periodEndEpoch,
  planChangeError, releaseSchedule,
} from '@/lib/membership/server';

/**
 * Changement de formule de l'appelant (cookie du site ou Bearer de l'app).
 * Corps : `{ new_plan_id }`. Une seule règle, celle de la base (20270147) :
 *   - en ligne : échéancier Stripe (subscription schedule) sur le compte
 *     connecté, phase 1 = formule actuelle jusqu'à la fin de la période,
 *     phase 2 = nouvelle formule, sans prorata, rien facturé aujourd'hui.
 *     `plan_id` et `amount_cents` sont écrits par le webhook à la bascule ;
 *     ici, seulement `scheduled_*` et `stripe_schedule_id` ;
 *   - au comptoir : demande au gérant (`request_plan_change`).
 * Refus nommés (409, codes PLAN_CHANGE_*). Réponse `{ ok, mode, effective_at? }`.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    const userId = user.id;

    const { new_plan_id } = await req.json().catch(() => ({}));
    if (!new_plan_id || typeof new_plan_id !== 'string') {
      return NextResponse.json({ error: 'new_plan_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: plan } = await supabase
      .from('membership_plans')
      .select('id, box_id, name, description, price_cents, currency, is_active, plan_type, stripe_product_id, stripe_price_id')
      .eq('id', new_plan_id)
      .maybeSingle();
    const p = plan as (PlanLite & {
      description: string | null; currency: string | null;
      stripe_product_id: string | null; stripe_price_id: string | null;
    }) | null;
    if (!p) return planChangeError('PLAN_CHANGE_INVALID_PLAN', 404);

    // Archivage : box archivée ou en archivage programmé → le refus commun des
    // routes d'entrée (BOX_ARCHIVEE / BOX_ARCHIVAGE_PROGRAMME), que le site affiche.
    const refus = await refuseClosedBox(supabase, p.box_id, 'achat');
    if (refus) return refus;

    const m = await loadMember(supabase, userId, p.box_id);
    if (!m) return planChangeError('PLAN_CHANGE_NOT_MEMBER');

    const block = await loadBlockReason(supabase, m);
    if (block) return blockError(block);
    const invalid = planRefusal(p, m);
    if (invalid) return planChangeError(invalid);

    // ── Au comptoir : demande au gérant ──────────────────────────────────
    if (modeOf(m) === 'counter') {
      const { error } = await supabase.rpc('request_plan_change', {
        p_member_id: userId, p_box_id: p.box_id, p_to_plan_id: p.id,
      });
      if (error) {
        const code = codeFromDbError(error.message);
        if (code) return planChangeError(code);
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, mode: 'counter', plan_name: p.name });
    }

    // ── En ligne : échéancier sur le compte connecté de la box ───────────
    const box = await connectAccount(supabase, p.box_id);
    if (!box?.stripe_account_id || !box.stripe_onboarding_complete) {
      return planChangeError('PLAN_CHANGE_PAYMENTS_DISABLED');
    }
    const stripe = getConnectStripe();
    const stripeAccount = box.stripe_account_id;

    // Prix de la nouvelle formule sur le compte connecté (créé une fois, puis réutilisé).
    let priceId = p.stripe_price_id;
    if (!priceId) {
      const product = p.stripe_product_id
        ? { id: p.stripe_product_id }
        : await stripe.products.create(
            { name: `${box.name} — ${p.name}`, description: p.description ?? undefined, metadata: { plan_id: p.id, box_id: p.box_id } },
            { stripeAccount, idempotencyKey: idempotencyKey('product', p.id) },
          );
      const price = await stripe.prices.create(
        { product: product.id, currency: p.currency || 'eur', unit_amount: p.price_cents, recurring: { interval: 'month' } },
        { stripeAccount, idempotencyKey: idempotencyKey('price', p.id, p.price_cents) },
      );
      priceId = price.id;
      await supabase.from('membership_plans')
        .update({ stripe_product_id: product.id, stripe_price_id: priceId })
        .eq('id', p.id);
    }

    const sub: any = await stripe.subscriptions.retrieve(m.stripe_subscription_id!, {}, { stripeAccount });
    const periodEnd = periodEndEpoch(sub);
    const items: { price: string; quantity: number }[] = (sub.items?.data ?? [])
      .map((it: any) => ({ price: it.price?.id, quantity: it.quantity ?? 1 }));
    if (!periodEnd || items.length === 0 || items.some((i) => !i.price)) {
      return NextResponse.json({ error: 'Abonnement Stripe invalide.' }, { status: 500 });
    }

    // Échéancier : le nôtre (enregistré, ou marqué à notre nom) est repris ;
    // tout autre est étranger, on n'y touche pas.
    let schedule: Stripe.SubscriptionSchedule;
    const existing = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id ?? null;
    const mark = { [SCHEDULE_MARK]: '1', member_id: userId, box_id: p.box_id };
    if (existing) {
      schedule = await stripe.subscriptionSchedules.retrieve(existing, {}, { stripeAccount });
      const ours = existing === m.stripe_schedule_id
        || (schedule.metadata?.[SCHEDULE_MARK] === '1' && schedule.metadata?.member_id === userId);
      if (!ours) return planChangeError('PLAN_CHANGE_FOREIGN_SCHEDULE');
    } else {
      // Clé : l'abonnement, l'échéancier enregistré au moment de l'appel, la formule visée.
      const creer = (suffixe?: string) => stripe.subscriptionSchedules.create(
        { from_subscription: sub.id, metadata: mark } as any,
        { stripeAccount, idempotencyKey: idempotencyKey('schedule', sub.id, m.stripe_schedule_id, p.id, suffixe ?? '') },
      );
      schedule = await creer();
      // Même état et même choix qu'avant une annulation (moins de 24 h) : Stripe
      // rejoue la réponse d'alors, et cet échéancier est relâché depuis. Seule
      // une relecture le dit (la réponse rejouée garde son ancien statut).
      schedule = await stripe.subscriptionSchedules.retrieve(schedule.id, {}, { stripeAccount });
      if (!['not_started', 'active'].includes(schedule.status)) {
        schedule = await creer(`apres-${schedule.id}`);
      }
    }

    const current = schedule.phases.find((ph) => ph.start_date === schedule.current_phase?.start_date) ?? schedule.phases[0];
    const metadata = { ...(sub.metadata ?? {}) } as Record<string, string>;
    // Phase 1 : la formule actuelle jusqu'à la fin de la période. Phase 2
    // (remplace toute phase future) : la nouvelle formule, sans prorata.
    schedule = await stripe.subscriptionSchedules.update(
      schedule.id,
      {
        end_behavior: 'release',
        proration_behavior: 'none',
        metadata: mark,
        phases: [
          { start_date: current.start_date, end_date: periodEnd, items, proration_behavior: 'none', metadata },
          {
            items: [{ price: priceId, quantity: items[0].quantity }],
            iterations: 1,
            proration_behavior: 'none',
            metadata: { ...metadata, plan_id: p.id, box_id: p.box_id, member_id: userId },
          },
        ],
      } as any,
      // Clé : l'échéancier, sa phase en cours, la formule programmée avant l'appel, la formule visée.
      { stripeAccount, idempotencyKey: idempotencyKey('phases', schedule.id, current.start_date, m.scheduled_plan_id, p.id) },
    );

    const effectiveAt = new Date(periodEnd * 1000).toISOString();
    const { data: written, error: writeErr } = await supabase.from('box_members')
      .update({ scheduled_plan_id: p.id, scheduled_change_at: effectiveAt, stripe_schedule_id: schedule.id })
      .eq('id', m.id)
      .eq('stripe_subscription_id', sub.id)
      .select('id');
    if (writeErr || !written || written.length !== 1) {
      // Pas d'état à moitié : sans trace en base, l'échéancier est relâché
      // (l'abonnement continue tel quel, rien n'est programmé).
      await releaseSchedule(stripe, schedule.id, 'echec-base', stripeAccount);
      console.error('change-membership-plan: write failed after Stripe, schedule released');
      return NextResponse.json({ error: "Le changement n'a pas pu être enregistré. Réessaie." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mode: 'online', effective_at: effectiveAt, plan_name: p.name });
  } catch (err: any) {
    console.error('change-membership-plan error:', err?.message ?? err);
    return NextResponse.json({ error: 'Le changement de formule a échoué.' }, { status: 500 });
  }
}
