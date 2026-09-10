import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { subscriptionPeriodEnd } from '@/lib/stripeSubscription';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

/**
 * Désabonnement d'une programmation Marketplace payante en abonnement Stripe.
 * La demande (case « retirer les séances futures ») est mémorisée en base par
 * `unsubscribe_programming` ; Stripe résilie à fin de période et le webhook
 * `customer.subscription.deleted` conclut (statut canceled, retrait des cartes).
 * Les offres gratuites / paiement unique passent directement par la RPC.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { subscription_id, remove_future } = await req.json();
    if (!subscription_id) {
      return NextResponse.json({ error: 'subscription_id requis' }, { status: 400 });
    }

    const authed = await createClient();
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const supabase = createServiceClient();
    const { data: subRaw } = await supabase
      .from('box_programming_subscriptions')
      .select('id, subscriber_box_id, programming_id, status, stripe_subscription_id')
      .eq('id', subscription_id)
      .maybeSingle();
    const sub = subRaw as {
      id: string; subscriber_box_id: string; programming_id: string;
      status: string; stripe_subscription_id: string | null;
    } | null;
    if (!sub) return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 });

    if (!(await isBoxOwnerAdmin(supabase, user.id, sub.subscriber_box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }
    if (sub.status === 'canceled') {
      return NextResponse.json({ ok: true, pending_stripe: false });
    }

    // Mémorise la demande sous l'identité du gérant (garde is_box_owner_admin côté RPC).
    const { data: memo, error: memoErr } = await authed.rpc('unsubscribe_programming', {
      p_subscription_id: sub.id, p_remove_future: remove_future !== false,
    });
    if (memoErr) return NextResponse.json({ error: memoErr.message }, { status: 400 });
    const result = memo as { pending_stripe: boolean; removed: number } | null;
    if (!result?.pending_stripe || !sub.stripe_subscription_id) {
      return NextResponse.json({ ok: true, pending_stripe: false, removed: result?.removed ?? 0 });
    }

    const { data: prog } = await supabase
      .from('box_programming')
      .select('publisher_box_id')
      .eq('id', sub.programming_id)
      .single();
    const publisherBoxId = (prog as { publisher_box_id: string } | null)?.publisher_box_id;
    const { data: box } = publisherBoxId
      ? await supabase.from('boxes').select('stripe_account_id').eq('id', publisherBoxId).single()
      : { data: null };
    const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id;
    if (!stripeAccount) {
      return NextResponse.json({ error: 'Compte de paiement de la box éditrice introuvable.' }, { status: 409 });
    }

    const updated = await stripe.subscriptions.update(
      sub.stripe_subscription_id,
      { cancel_at_period_end: true },
      { stripeAccount },
    );

    const periodEnd = subscriptionPeriodEnd(updated);
    return NextResponse.json({
      ok: true,
      pending_stripe: true,
      period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  } catch (err: any) {
    console.error('cancel-programming-subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
