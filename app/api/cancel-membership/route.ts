import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Résilie l'abonnement de salle de l'utilisateur connecté à la fin de la période.
 * L'identité vient du cookie de session (sb-access-token) — un utilisateur ne peut
 * résilier que son propre abonnement.
 */
export async function POST() {
  const stripe = getStripe();
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: memberRaw } = await (supabase.from as any)('box_members')
      .select('id, box_id, subscription_status, stripe_subscription_id')
      .eq('member_id', user.id)
      .not('stripe_subscription_id', 'is', null)
      .order('joined_at', { ascending: false });

    const members = (memberRaw ?? []) as {
      id: string; box_id: string; subscription_status: string | null; stripe_subscription_id: string | null;
    }[];
    const m = members.find(x => ACTIVE_STATUSES.includes(x.subscription_status ?? '')) ?? null;

    if (!m?.stripe_subscription_id) {
      return NextResponse.json({ error: 'Aucun abonnement actif à résilier.' }, { status: 404 });
    }

    const { data: box } = await supabase
      .from('boxes')
      .select('stripe_account_id')
      .eq('id', m.box_id)
      .single();
    const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id;
    if (!stripeAccount) {
      return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
    }

    await stripe.subscriptions.update(
      m.stripe_subscription_id,
      { cancel_at_period_end: true },
      { stripeAccount },
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('cancel-membership error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
