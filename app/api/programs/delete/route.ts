import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { readSubscriptionState, stopSubscription } from '@/lib/stripe/stopSubscription';
import { memberFirstName, sendMemberEmail } from '@/lib/members/stopMembership';
import { programStopEmail, subscriptionsOverview } from '@/lib/stopProductSubscriptions';
import { deCount } from '@/lib/plural';

/**
 * Suppression d'un programme athlète (S4, B10). Supprimer un programme efface
 * en cascade `program_members` — et donc l'identifiant de l'abonnement
 * Stripe, qui aurait continué de prélever sans trace. D'où le refus.
 *
 * Body: { program_id: string, action: 'check' | 'delete' | 'stop_then_deactivate' }
 * - `check` : lecture seule — abonnements Stripe actifs rattachés, dont ceux
 *   qu'il reste à arrêter et les impayés (l'état vient de Stripe : le webhook
 *   enregistre un impayé comme `active`).
 * - `delete` : refusée (409 + nombre) tant qu'il en reste ; redevient possible
 *   d'elle-même quand le dernier abonnement est terminé (webhook → cancelled).
 * - `stop_then_deactivate` : chaque abonnement est arrêté à la fin de sa
 *   période (un impayé tout de suite), e-mail à l'acheteur, ligne de journal
 *   quand l'acheteur est membre de la box (le journal S1 exige un
 *   `box_member_id`) ; puis le programme est DÉSACTIVÉ, pas supprimé : les
 *   acheteurs gardent la période payée. Échec partiel : rien n'est désactivé.
 *
 * « Désactiver » reste la bascule `is_active` existante, sans appel Stripe.
 */

interface BuyerRow { id: string; user_id: string; stripe_subscription_id: string | null; status: string | null }

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { program_id, action } = await req.json();
    if (!program_id || !['check', 'delete', 'stop_then_deactivate'].includes(action)) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: progRaw } = await supabase
      .from('programs').select('id, box_id, title').eq('id', program_id).maybeSingle();
    const program = progRaw as { id: string; box_id: string; title: string } | null;
    if (!program) return NextResponse.json({ error: 'Programme introuvable.' }, { status: 404 });
    if (!(await isBoxOwnerAdmin(supabase, user.id, program.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const { data: buyersRaw } = await supabase
      .from('program_members')
      .select('id, user_id, stripe_subscription_id, status')
      .eq('program_id', program.id)
      .eq('status', 'active');
    const subs = ((buyersRaw ?? []) as BuyerRow[]).filter(b => !!b.stripe_subscription_id);

    const { data: boxRaw } = await supabase
      .from('boxes').select('name, stripe_account_id, contact_email').eq('id', program.box_id).single();
    const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;

    if (action === 'check') {
      return NextResponse.json({
        ok: true,
        ...(await subscriptionsOverview(box?.stripe_account_id ?? null, subs.map(s => s.stripe_subscription_id!))),
      });
    }

    if (action === 'delete') {
      if (subs.length > 0) {
        return NextResponse.json(
          {
            error: `${subs.length === 1 ? '1 abonnement Stripe est encore actif' : `${subs.length} abonnements Stripe sont encore actifs`} sur ce programme : il ne peut pas être supprimé.`,
            active_subscriptions: subs.length,
          },
          { status: 409 },
        );
      }
      const { error } = await supabase.from('programs').delete().eq('id', program.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    // stop_then_deactivate
    if (subs.length > 0 && !box?.stripe_account_id) {
      return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
    }

    const userIds = subs.map(s => s.user_id);
    const [{ data: profilesRaw }, { data: bmRaw }] = userIds.length
      ? await Promise.all([
          supabase.from('profiles').select('id, email, username, full_name').in('id', userIds),
          supabase.from('box_members').select('id, member_id').eq('box_id', program.box_id).in('member_id', userIds),
        ])
      : [{ data: [] }, { data: [] }];
    const profileById = new Map(((profilesRaw ?? []) as any[]).map(p => [p.id, p]));
    const boxMemberByUser = new Map(((bmRaw ?? []) as { id: string; member_id: string }[]).map(b => [b.member_id, b.id]));

    const failed: string[] = [];
    let stopped = 0;
    let notEmailed = 0;
    for (const s of subs) {
      const profile = profileById.get(s.user_id) ?? null;
      let periodEnd: string | null = null;
      let mode: 'period_end' | 'now' = 'period_end';
      try {
        const state = await readSubscriptionState({
          stripeAccount: box!.stripe_account_id!, subscriptionId: s.stripe_subscription_id!,
        });
        // Déjà en voie d'arrêt (relance après un échec partiel) : rien n'est refait.
        if (state.stopping) continue;
        periodEnd = state.periodEnd;
        // Impayé : arrêt immédiat, comme la règle S2.
        if (state.status === 'past_due' || state.status === 'unpaid') mode = 'now';
        await stopSubscription({
          stripeAccount: box!.stripe_account_id!,
          subscriptionId: s.stripe_subscription_id!,
          mode,
          idempotencyKey: `stop:program:${s.id}:${s.stripe_subscription_id}:${mode}`,
        });
        stopped += 1;
      } catch {
        failed.push(profile?.username ?? 'un acheteur');
        continue;
      }

      // Journal : seulement si l'acheteur est membre de la box (box_member_id requis).
      const boxMemberId = boxMemberByUser.get(s.user_id) ?? null;
      let journalId: string | null = null;
      if (boxMemberId) {
        const { data: j, error: je } = await supabase
          .from('box_member_subscription_actions')
          .insert({
            box_id: program.box_id, box_member_id: boxMemberId, member_id: s.user_id,
            action: 'stop', mode, stripe_subscription_id: s.stripe_subscription_id,
            refund_cents: 0, actor_id: user.id,
          })
          .select('id').maybeSingle();
        if (je) console.error('programs stop journal insert failed:', je.message);
        journalId = (j as { id: string } | null)?.id ?? null;
      }

      const email = profile?.email ?? null;
      const boxName = box?.name ?? 'ta box';
      const sent = email ? await sendMemberEmail({
        to: email,
        ...programStopEmail({ mode, firstName: memberFirstName(profile), boxName, title: program.title, periodEnd }),
        boxName,
        replyTo: box?.contact_email ?? null,
        tag: 'programs-stop',
      }) : false;
      if (sent && journalId) {
        await supabase.from('box_member_subscription_actions')
          .update({ notified_at: new Date().toISOString() }).eq('id', journalId);
      }
      if (!sent) notEmailed += 1;
    }

    if (failed.length > 0) {
      return NextResponse.json(
        {
          error: `Stripe a refusé l’arrêt ${deCount(failed.length, 'abonnement', 'abonnements')} : ${failed.join(', ')}. Le programme n’a pas été désactivé ; les autres abonnements sont bien arrêtés.`,
          failed,
          stopped,
        },
        { status: 502 },
      );
    }

    const { error } = await supabase.from('programs')
      .update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', program.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true, deactivated: true, stopped,
      ...(notEmailed > 0 ? { warning: notEmailed === 1 ? '1 acheteur n’a pas reçu l’e-mail : préviens-le directement.' : `${notEmailed} acheteurs n’ont pas reçu l’e-mail : préviens-les directement.` } : {}),
    });
  } catch (err: any) {
    console.error('programs delete error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
