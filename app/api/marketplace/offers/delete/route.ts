import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { readSubscriptionState, stopSubscription } from '@/lib/stripe/stopSubscription';
import { memberFirstName, sendMemberEmail } from '@/lib/members/stopMembership';
import { offerStopEmail, subscriptionsOverview } from '@/lib/stopProductSubscriptions';
import { deCount } from '@/lib/plural';

/**
 * Suppression d'une offre Marketplace (S4, B11). Supprimer l'offre efface en
 * cascade `box_programming_subscriptions` — et l'identifiant de l'abonnement
 * Stripe, qui aurait continué de prélever la box abonnée sans trace.
 *
 * Body: { programming_id: string, action: 'check' | 'delete' | 'stop_then_deactivate' }
 * - `check` : lecture seule — abonnements Stripe actifs ou en impayé, dont ceux
 *   qu'il reste à arrêter et les impayés (état lu chez Stripe).
 * - `delete` : refusée (409 + nombre) tant qu'il en reste ; redevient possible
 *   quand le dernier abonnement est terminé (webhook → canceled).
 * - `stop_then_deactivate` : chaque abonnement est arrêté à la fin de sa
 *   période (un impayé tout de suite), e-mail au gérant de la box abonnée ;
 *   puis l'offre est DÉPUBLIÉE (même écriture que `publish_programming(false)`),
 *   pas supprimée : la box abonnée reçoit ses semaines jusqu'à la fin de sa
 *   période (`materialize_box_programming` ne regarde pas `is_published`).
 *   Pas de ligne de journal : l'abonné est une box, le journal S1 exige un
 *   membre. Échec partiel : rien n'est dépublié.
 *
 * « Désactiver » reste la dépublication existante, sans appel Stripe.
 */

interface SubRow { id: string; subscriber_box_id: string; stripe_subscription_id: string | null; status: string | null }

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { programming_id, action } = await req.json();
    if (!programming_id || !['check', 'delete', 'stop_then_deactivate'].includes(action)) {
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

    const { data: pubRaw } = await supabase
      .from('boxes').select('name, stripe_account_id, contact_email').eq('id', offer.publisher_box_id).single();
    const pub = pubRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;

    if (action === 'check') {
      return NextResponse.json({
        ok: true,
        ...(await subscriptionsOverview(pub?.stripe_account_id ?? null, subs.map(s => s.stripe_subscription_id!))),
      });
    }

    if (action === 'delete') {
      if (subs.length > 0) {
        return NextResponse.json(
          {
            error: `${subs.length === 1 ? '1 abonnement Stripe est encore actif' : `${subs.length} abonnements Stripe sont encore actifs`} sur cette offre : elle ne peut pas être supprimée.`,
            active_subscriptions: subs.length,
          },
          { status: 409 },
        );
      }
      const { error } = await supabase.from('box_programming').delete().eq('id', offer.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    // stop_then_deactivate
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
    let stopped = 0;
    let notEmailed = 0;
    for (const s of subs) {
      const subBox = subBoxById.get(s.subscriber_box_id) ?? null;
      let periodEnd: string | null = null;
      let mode: 'period_end' | 'now' = 'period_end';
      try {
        const state = await readSubscriptionState({
          stripeAccount: pub!.stripe_account_id!, subscriptionId: s.stripe_subscription_id!,
        });
        if (state.stopping) continue;
        periodEnd = state.periodEnd;
        // Impayé : arrêt immédiat, comme la règle S2.
        if (state.status === 'past_due' || state.status === 'unpaid') mode = 'now';
        await stopSubscription({
          stripeAccount: pub!.stripe_account_id!,
          subscriptionId: s.stripe_subscription_id!,
          mode,
          idempotencyKey: `stop:programming:${s.id}:${s.stripe_subscription_id}:${mode}`,
        });
        stopped += 1;
      } catch {
        failed.push(subBox?.name ?? 'une box');
        continue;
      }

      const owner = subBox?.owner_id ? ownerById.get(subBox.owner_id) ?? null : null;
      const pubName = pub?.name ?? 'La box éditrice';
      const sent = owner?.email ? await sendMemberEmail({
        to: owner.email,
        ...offerStopEmail({
          mode, firstName: memberFirstName(owner), publisherName: pubName, title: offer.title,
          subscriberBoxName: subBox?.name ?? 'ta box', periodEnd,
        }),
        boxName: pubName,
        replyTo: pub?.contact_email ?? null,
        tag: 'marketplace-offer-stop',
      }) : false;
      if (!sent) notEmailed += 1;
    }

    if (failed.length > 0) {
      return NextResponse.json(
        {
          error: `Stripe a refusé l’arrêt ${deCount(failed.length, 'abonnement', 'abonnements')} : ${failed.join(', ')}. L’offre n’a pas été désactivée ; les autres abonnements sont bien arrêtés.`,
          failed,
          stopped,
        },
        { status: 502 },
      );
    }

    const { error } = await supabase.from('box_programming')
      .update({ is_published: false, updated_at: new Date().toISOString() }).eq('id', offer.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true, deactivated: true, stopped,
      ...(notEmailed > 0 ? { warning: notEmailed === 1 ? '1 box abonnée n’a pas reçu l’e-mail : préviens-la directement.' : `${notEmailed} boxs abonnées n’ont pas reçu l’e-mail : préviens-les directement.` } : {}),
    });
  } catch (err: any) {
    console.error('marketplace offer delete error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
