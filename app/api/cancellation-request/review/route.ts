import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Le staff de la box approuve ou refuse une demande de résiliation anticipée.
 * Approuver → résilie l'abonnement à la fin de la période et lève l'engagement.
 * Body: { request_id: string, action: 'approve' | 'reject', note?: string }
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { request_id, action, note } = await req.json();
    if (!request_id || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: reqRaw } = await supabase
      .from('membership_cancellation_requests')
      .select('id, box_id, member_id, status')
      .eq('id', request_id)
      .maybeSingle();
    const request = reqRaw as {
      id: string; box_id: string; member_id: string; status: string;
    } | null;

    if (!request) {
      return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    }
    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });
    }
    if (!(await isBoxStaff(supabase, user.id, request.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    if (action === 'approve') {
      const { data: memberRaw } = await supabase
        .from('box_members')
        .select('id, stripe_subscription_id, subscription_status')
        .eq('box_id', request.box_id)
        .eq('member_id', request.member_id)
        .maybeSingle();
      const member = memberRaw as {
        id: string; stripe_subscription_id: string | null; subscription_status: string | null;
      } | null;

      if (member?.stripe_subscription_id && ACTIVE_STATUSES.includes(member.subscription_status ?? '')) {
        const { data: box } = await supabase
          .from('boxes').select('stripe_account_id').eq('id', request.box_id).single();
        const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id;
        if (stripeAccount) {
          await stripe.subscriptions.update(
            member.stripe_subscription_id,
            { cancel_at_period_end: true },
            { stripeAccount },
          );
        }
      }

      // Lève l'engagement pour que la résiliation ne soit plus bloquée.
      if (member?.id) {
        await supabase.from('box_members')
          .update({ commitment_end_date: null, subscription_cancel_at_period_end: true })
          .eq('id', member.id);
      }
    }

    await supabase
      .from('membership_cancellation_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        review_note: (note as string | undefined)?.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('cancellation-request review error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
