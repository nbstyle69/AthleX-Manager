import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { EMAIL_WARNING, stopBoxMember } from '@/lib/members/stopMembership';

/**
 * Arrêt d'un abonnement de salle par le gérant (S2, option A : aucun
 * remboursement).
 *
 * Body: { box_member_id: string, mode: 'period_end' | 'now' }
 * - Stripe : `period_end` (fin de la période payée) ou `now` (immédiat) ;
 *   un abonnement en impayé n'accepte que `now`.
 * - Comptoir (pas d'abonnement Stripe) : seulement `now`.
 *
 * Le cœur (Stripe, écritures du webhook, journal, e-mail) est partagé avec
 * S4 : `lib/members/stopMembership.ts`.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { box_member_id, mode } = await req.json();
    if (!box_member_id || (mode !== 'period_end' && mode !== 'now')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: memberRaw } = await supabase
      .from('box_members')
      .select('id, box_id, member_id, plan_id, status, stripe_subscription_id, subscription_status, subscription_cancel_at_period_end, subscription_current_period_end')
      .eq('id', box_member_id)
      .maybeSingle();
    const member = memberRaw as {
      id: string; box_id: string; member_id: string; plan_id: string | null;
      status: string | null;
      stripe_subscription_id: string | null;
      subscription_status: string | null;
      subscription_cancel_at_period_end: boolean | null;
      subscription_current_period_end: string | null;
    } | null;

    if (!member) {
      return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
    }
    if (!(await isBoxOwnerAdmin(supabase, user.id, member.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const hasStripeSub = !!member.stripe_subscription_id;

    // État demandé déjà atteint : on ne refait rien (idempotence côté Manager).
    if (member.subscription_status === 'cancelled') {
      return NextResponse.json({ ok: true, already: true });
    }
    if (mode === 'period_end' && member.subscription_cancel_at_period_end) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (!hasStripeSub && mode === 'period_end') {
      return NextResponse.json(
        { error: 'Ce membre paie au comptoir : il n\'y a pas de période Stripe, seul l\'arrêt immédiat est possible.' },
        { status: 409 },
      );
    }
    if (member.subscription_status === 'past_due' && mode === 'period_end') {
      return NextResponse.json(
        { error: 'Cet abonnement est en impayé : seul l\'arrêt immédiat est possible.' },
        { status: 409 },
      );
    }

    // Le nom de la formule sert à l'e-mail : lu avant que `now` la retire.
    const [{ data: boxRaw }, { data: planRaw }, { data: profileRaw }] = await Promise.all([
      supabase.from('boxes').select('name, stripe_account_id, contact_email').eq('id', member.box_id).single(),
      member.plan_id
        ? supabase.from('membership_plans').select('name').eq('id', member.plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('profiles').select('email, username, full_name').eq('id', member.member_id).maybeSingle(),
    ]);
    const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;
    const plan = planRaw as { name: string } | null;

    if (hasStripeSub && !box?.stripe_account_id) {
      return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
    }

    const { emailed } = await stopBoxMember(supabase, {
      member, box, profile: profileRaw as any, planName: plan?.name ?? null, mode, actorId: user.id,
    });

    return NextResponse.json({ ok: true, mode, ...(emailed ? {} : { warning: EMAIL_WARNING }) });
  } catch (err: any) {
    console.error('stop-subscription error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
