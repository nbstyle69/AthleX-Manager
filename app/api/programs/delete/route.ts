import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { readSubscriptionState, stopSubscription } from '@/lib/stripe/stopSubscription';
import { fullDate, memberFirstName, sendMemberEmail } from '@/lib/members/stopMembership';

/**
 * Suppression d'un programme athlète (S4, B10). Supprimer un programme efface
 * en cascade `program_members` — et donc l'identifiant de l'abonnement
 * Stripe, qui aurait continué de prélever sans trace. D'où le refus.
 *
 * Body: { program_id: string, action: 'check' | 'delete' | 'stop_then_delete' }
 * - `check` : nombre d'abonnements Stripe actifs rattachés (lecture seule).
 * - `delete` : refusée (409 + nombre) s'il en reste.
 * - `stop_then_delete` : chaque abonnement arrêté à la fin de sa période
 *   (e-mail à l'acheteur ; ligne de journal quand l'acheteur est membre de
 *   la box — le journal S1 exige un `box_member_id`) ; suppression seulement
 *   si tous les arrêts Stripe ont réussi.
 *
 * « Désactiver » reste la bascule `is_active` existante, sans appel Stripe.
 */

interface BuyerRow { id: string; user_id: string; stripe_subscription_id: string | null; status: string | null }

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { program_id, action } = await req.json();
    if (!program_id || !['check', 'delete', 'stop_then_delete'].includes(action)) {
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

    if (action === 'check') return NextResponse.json({ ok: true, active_subscriptions: subs.length });

    if (action === 'delete') {
      if (subs.length > 0) {
        return NextResponse.json(
          {
            error: `${subs.length} abonnement(s) Stripe sont encore actifs sur ce programme : il ne peut pas être supprimé.`,
            active_subscriptions: subs.length,
          },
          { status: 409 },
        );
      }
      const { error } = await supabase.from('programs').delete().eq('id', program.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    // stop_then_delete
    const { data: boxRaw } = await supabase
      .from('boxes').select('name, stripe_account_id, contact_email').eq('id', program.box_id).single();
    const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;
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
    let notEmailed = 0;
    for (const s of subs) {
      const profile = profileById.get(s.user_id) ?? null;
      let periodEnd: string | null = null;
      try {
        const state = await readSubscriptionState({
          stripeAccount: box!.stripe_account_id!, subscriptionId: s.stripe_subscription_id!,
        });
        // Déjà en voie d'arrêt (relance après un échec partiel) : rien n'est refait.
        if (state.stopping) continue;
        periodEnd = state.periodEnd;
        await stopSubscription({
          stripeAccount: box!.stripe_account_id!,
          subscriptionId: s.stripe_subscription_id!,
          mode: 'period_end',
          idempotencyKey: `stop:program:${s.id}:${s.stripe_subscription_id}:period_end`,
        });
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
            action: 'stop', mode: 'period_end', stripe_subscription_id: s.stripe_subscription_id,
            refund_cents: 0, actor_id: user.id,
          })
          .select('id').maybeSingle();
        if (je) console.error('programs delete journal insert failed:', je.message);
        journalId = (j as { id: string } | null)?.id ?? null;
      }

      const email = profile?.email ?? null;
      const boxName = box?.name ?? 'ta box';
      const sent = email ? await sendMemberEmail({
        to: email,
        subject: `${boxName} a retiré le programme ${program.title}`,
        bodyText: `Bonjour ${memberFirstName(profile)}, ${boxName} a retiré le programme ${program.title} : ton accès s'arrête aujourd'hui. Ton abonnement prendra fin ${periodEnd ? `le ${fullDate(periodEnd)}` : 'à la fin de la période payée'}, sans nouveau prélèvement. Pour toute question, réponds à cet e-mail : il arrive directement à ${boxName}.`,
        boxName,
        replyTo: box?.contact_email ?? null,
        tag: 'programs-delete',
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
          error: `Stripe a refusé l’arrêt de ${failed.length} abonnement(s) : ${failed.join(', ')}. Le programme n’a pas été supprimé ; les autres abonnements sont bien programmés pour s’arrêter à la fin de leur période.`,
          failed,
          stopped: subs.length - failed.length,
        },
        { status: 502 },
      );
    }

    const { error } = await supabase.from('programs').delete().eq('id', program.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true, deleted: true, stopped: subs.length,
      ...(notEmailed > 0 ? { warning: `${notEmailed} acheteur(s) n’ont pas reçu l’e-mail : préviens-les directement.` } : {}),
    });
  } catch (err: any) {
    console.error('programs delete error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
