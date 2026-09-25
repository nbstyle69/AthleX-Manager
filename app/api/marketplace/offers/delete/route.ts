import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { readSubscriptionState, stopSubscription } from '@/lib/stripe/stopSubscription';
import { fullDate, memberFirstName, sendMemberEmail } from '@/lib/members/stopMembership';

/**
 * Suppression d'une offre Marketplace (S4, B11). Supprimer l'offre efface en
 * cascade `box_programming_subscriptions` — et l'identifiant de l'abonnement
 * Stripe, qui aurait continué de prélever la box abonnée sans trace.
 *
 * Body: { programming_id: string, action: 'check' | 'delete' | 'stop_then_delete' }
 * - `check` : nombre d'abonnements Stripe actifs ou en impayé (lecture seule).
 * - `delete` : refusée (409 + nombre) s'il en reste.
 * - `stop_then_delete` : chaque abonnement arrêté à la fin de sa période,
 *   e-mail au gérant de la box abonnée ; suppression seulement si tous les
 *   arrêts Stripe ont réussi. Pas de ligne de journal : l'abonné est une box,
 *   le journal S1 exige un membre (`box_member_id`).
 *
 * « Désactiver » reste la dépublication existante, sans appel Stripe.
 */

interface SubRow { id: string; subscriber_box_id: string; stripe_subscription_id: string | null; status: string | null }

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { programming_id, action } = await req.json();
    if (!programming_id || !['check', 'delete', 'stop_then_delete'].includes(action)) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: offerRaw } = await supabase
      .from('box_programming').select('id, publisher_box_id, title').eq('id', programming_id).maybeSingle();
    const offer = offerRaw as { id: string; publisher_box_id: string; title: string } | null;
    if (!offer) return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 });
    if (!(await isBoxOwnerAdmin(supabase, user.id, offer.publisher_box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const { data: subsRaw } = await supabase
      .from('box_programming_subscriptions')
      .select('id, subscriber_box_id, stripe_subscription_id, status')
      .eq('programming_id', offer.id)
      .in('status', ['active', 'past_due']);
    const subs = ((subsRaw ?? []) as SubRow[]).filter(s => !!s.stripe_subscription_id);

    if (action === 'check') return NextResponse.json({ ok: true, active_subscriptions: subs.length });

    if (action === 'delete') {
      if (subs.length > 0) {
        return NextResponse.json(
          {
            error: `${subs.length} abonnement(s) Stripe sont encore actifs sur cette offre : elle ne peut pas être supprimée.`,
            active_subscriptions: subs.length,
          },
          { status: 409 },
        );
      }
      const { error } = await supabase.from('box_programming').delete().eq('id', offer.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    // stop_then_delete
    const { data: pubRaw } = await supabase
      .from('boxes').select('name, stripe_account_id, contact_email').eq('id', offer.publisher_box_id).single();
    const pub = pubRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;
    if (subs.length > 0 && !pub?.stripe_account_id) {
      return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
    }

    const boxIds = subs.map(s => s.subscriber_box_id);
    const { data: subBoxesRaw } = boxIds.length
      ? await supabase.from('boxes').select('id, name, owner_id').in('id', boxIds)
      : { data: [] };
    const subBoxById = new Map(((subBoxesRaw ?? []) as { id: string; name: string; owner_id: string | null }[]).map(b => [b.id, b]));
    const ownerIds = Array.from(new Set(Array.from(subBoxById.values()).map(b => b.owner_id).filter((x): x is string => !!x)));
    const { data: ownersRaw } = ownerIds.length
      ? await supabase.from('profiles').select('id, email, username, full_name').in('id', ownerIds)
      : { data: [] };
    const ownerById = new Map(((ownersRaw ?? []) as any[]).map(p => [p.id, p]));

    const failed: string[] = [];
    let notEmailed = 0;
    for (const s of subs) {
      const subBox = subBoxById.get(s.subscriber_box_id) ?? null;
      let periodEnd: string | null = null;
      try {
        const state = await readSubscriptionState({
          stripeAccount: pub!.stripe_account_id!, subscriptionId: s.stripe_subscription_id!,
        });
        if (state.stopping) continue;
        periodEnd = state.periodEnd;
        await stopSubscription({
          stripeAccount: pub!.stripe_account_id!,
          subscriptionId: s.stripe_subscription_id!,
          mode: 'period_end',
          idempotencyKey: `stop:programming:${s.id}:${s.stripe_subscription_id}:period_end`,
        });
      } catch {
        failed.push(subBox?.name ?? 'une box');
        continue;
      }

      const owner = subBox?.owner_id ? ownerById.get(subBox.owner_id) ?? null : null;
      const pubName = pub?.name ?? 'La box éditrice';
      const sent = owner?.email ? await sendMemberEmail({
        to: owner.email,
        subject: `${pubName} a retiré l’offre ${offer.title}`,
        bodyText: `Bonjour ${memberFirstName(owner)}, ${pubName} a retiré l'offre de programmation ${offer.title} : ${subBox?.name ?? 'ta box'} ne recevra plus de nouvelles semaines, et les séances déjà posées restent. L'abonnement prendra fin ${periodEnd ? `le ${fullDate(periodEnd)}` : 'à la fin de la période payée'}, sans nouveau prélèvement. Pour toute question, réponds à cet e-mail : il arrive directement à ${pubName}.`,
        boxName: pubName,
        replyTo: pub?.contact_email ?? null,
        tag: 'marketplace-offer-delete',
      }) : false;
      if (!sent) notEmailed += 1;
    }

    if (failed.length > 0) {
      return NextResponse.json(
        {
          error: `Stripe a refusé l’arrêt de ${failed.length} abonnement(s) : ${failed.join(', ')}. L’offre n’a pas été supprimée ; les autres abonnements sont bien programmés pour s’arrêter à la fin de leur période.`,
          failed,
          stopped: subs.length - failed.length,
        },
        { status: 502 },
      );
    }

    const { error } = await supabase.from('box_programming').delete().eq('id', offer.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true, deleted: true, stopped: subs.length,
      ...(notEmailed > 0 ? { warning: `${notEmailed} box(s) abonnée(s) n’ont pas reçu l’e-mail : préviens-les directement.` } : {}),
    });
  } catch (err: any) {
    console.error('marketplace offer delete error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
