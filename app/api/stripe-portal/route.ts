import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireBoxOwner } from '@/lib/requireBoxOwner';
import { SITE_URL } from '@/lib/site-url';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { box_id } = await req.json();

    const guard = await requireBoxOwner(box_id);
    if (!guard.ok) return guard.response;
    const supabase = guard.service;

    const { data: sub } = await supabase.from('box_subscriptions')
      .select('stripe_customer_id')
      .eq('box_id', box_id)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    const baseUrl = SITE_URL;

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
