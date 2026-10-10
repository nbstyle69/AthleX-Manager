import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/auth/requestUser';
import {
  connectAccount, getConnectStripe, idempotencyKey, loadMember, planChangeError,
} from '@/lib/membership/server';

const FINI = ['released', 'canceled', 'completed'];

/**
 * Annule le changement de formule de l'appelant tant qu'il n'a pas eu lieu
 * (cookie du site ou Bearer de l'app) :
 *   - en ligne : l'échéancier Stripe est relâché (l'abonnement garde sa
 *     formule), puis les colonnes `scheduled_*` remises à null, seulement si
 *     elles portent encore cet échéancier ;
 *   - au comptoir : `cancel_plan_change_request`.
 * Rien à annuler → 409 PLAN_CHANGE_NOTHING_TO_CANCEL.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const supabase = createServiceClient();
    const m = await loadMember(supabase, user.id);
    if (!m) return planChangeError('PLAN_CHANGE_NOT_MEMBER');

    if (m.stripe_schedule_id) {
      const box = await connectAccount(supabase, m.box_id);
      if (!box?.stripe_account_id) return planChangeError('PLAN_CHANGE_PAYMENTS_DISABLED');
      const stripe = getConnectStripe();
      const stripeAccount = box.stripe_account_id;
      const scheduleId = m.stripe_schedule_id;
      try {
        await stripe.subscriptionSchedules.release(
          scheduleId, {}, { stripeAccount, idempotencyKey: idempotencyKey('release', scheduleId) },
        );
      } catch (err) {
        // Déjà relâché ou terminé (webhook en retard) : il ne reste qu'à nettoyer.
        const s = await stripe.subscriptionSchedules.retrieve(scheduleId, {}, { stripeAccount });
        if (!FINI.includes(s.status)) throw err;
      }
      await supabase.from('box_members')
        .update({ scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null })
        .eq('id', m.id)
        .eq('stripe_schedule_id', scheduleId);
      return NextResponse.json({ ok: true, mode: 'online' });
    }

    const { data, error } = await supabase.rpc('cancel_plan_change_request', {
      p_member_id: user.id, p_box_id: m.box_id,
    });
    if (error) throw new Error(error.message);
    if (data !== true) return planChangeError('PLAN_CHANGE_NOTHING_TO_CANCEL');
    return NextResponse.json({ ok: true, mode: 'counter' });
  } catch (err: any) {
    console.error('change-membership-plan/cancel error:', err?.message ?? err);
    return NextResponse.json({ error: "L'annulation a échoué." }, { status: 500 });
  }
}
