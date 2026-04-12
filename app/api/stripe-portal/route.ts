import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { box_id } = await req.json();

    if (!box_id) {
      return NextResponse.json({ error: 'box_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: sub } = await (supabase.from as any)('box_subscriptions')
      .select('stripe_customer_id')
      .eq('box_id', box_id)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://athlex.app';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/pricing?box_id=${box_id}`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('stripe-portal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
