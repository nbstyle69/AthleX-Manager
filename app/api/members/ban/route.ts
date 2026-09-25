import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { EMAIL_WARNING, stopBoxMember } from '@/lib/members/stopMembership';

/**
 * Bannissement d'un membre (S4) : un membre banni n'est plus prélevé.
 *
 * Body: { box_id: string, member_id: string }
 * - abonnement Stripe en cours (actif, essai, impayé) : arrêt immédiat
 *   (`now`, sans remboursement), journal et e-mail « arrêté » ;
 * - adhésion au comptoir en cours : mêmes écritures que l'arrêt immédiat ;
 * - puis l'adhésion passe `banned`, comme avant (le déclencheur SQL libère
 *   ses réservations futures). Aucun autre changement du bannissement ; le
 *   débannissement reste côté page, inchangé.
 *
 * L'arrêt Stripe passe AVANT le bannissement : si Stripe refuse, rien n'est
 * écrit et le gérant le voit.
 */

const LIVE = ['active', 'trialing', 'past_due'];

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { box_id, member_id } = await req.json();
    if (!box_id || !member_id) return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });

    const supabase = createServiceClient();
    if (!(await isBoxOwnerAdmin(supabase, user.id, box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const { data: memberRaw } = await supabase
      .from('box_members')
      .select('id, box_id, member_id, plan_id, status, stripe_subscription_id, subscription_status, subscription_current_period_end')
      .eq('box_id', box_id)
      .eq('member_id', member_id)
      .maybeSingle();
    const member = memberRaw as {
      id: string; box_id: string; member_id: string; plan_id: string | null; status: string | null;
      stripe_subscription_id: string | null; subscription_status: string | null;
      subscription_current_period_end: string | null;
    } | null;
    if (!member) return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });

    // Déjà banni : rien n'est refait.
    if (member.status === 'banned') return NextResponse.json({ ok: true, already: true });

    let warning: string | null = null;
    let stopped = false;
    if (LIVE.includes(member.subscription_status ?? '')) {
      const [{ data: boxRaw }, { data: planRaw }, { data: profileRaw }] = await Promise.all([
        supabase.from('boxes').select('name, stripe_account_id, contact_email').eq('id', box_id).single(),
        member.plan_id
          ? supabase.from('membership_plans').select('name').eq('id', member.plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('email, username, full_name').eq('id', member_id).maybeSingle(),
      ]);
      const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;
      if (member.stripe_subscription_id && !box?.stripe_account_id) {
        return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
      }
      const { emailed } = await stopBoxMember(supabase, {
        member, box, profile: profileRaw as any,
        planName: (planRaw as { name: string } | null)?.name ?? null,
        mode: 'now', actorId: user.id,
      });
      stopped = true;
      if (!emailed) warning = EMAIL_WARNING;
    }

    const { error } = await supabase.from('box_members').update({ status: 'banned' }).eq('id', member.id);
    if (error) {
      return NextResponse.json(
        { error: stopped ? `L’abonnement est arrêté, mais le bannissement n’a pas été enregistré : ${error.message}` : error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, stopped, ...(warning ? { warning } : {}) });
  } catch (err: any) {
    console.error('members ban error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
