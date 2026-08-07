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
  const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY_ID!;
  const PRICE_ANNUAL  = process.env.STRIPE_PRICE_ANNUAL_ID ?? PRICE_MONTHLY;
  try {
    const { box_id, billing = 'monthly' } = await req.json();

    if (!box_id) {
      return NextResponse.json({ error: 'box_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get box + owner info
    const { data: box, error: boxErr } = await supabase
      .from('boxes')
      .select('id, owner_id, name')
      .eq('id', box_id)
      .single();

    if (boxErr || !box) {
      return NextResponse.json({ error: 'Box not found' }, { status: 404 });
    }

    // Get owner email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', (box as any).owner_id)
      .single();

    // Get or create subscription record
    const { data: sub } = await supabase.from('box_subscriptions')
      .select('stripe_customer_id, is_early_adopter, status, trial_ends_at')
      .eq('box_id', box_id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (profile as any)?.email ?? undefined,
        metadata: {
          box_id: box_id,
          box_name: (box as any).name,
          supabase_owner_id: (box as any).owner_id,
        },
      });
      customerId = customer.id;

      if (sub) {
        // Record exists but no customer → update
        await supabase.from('box_subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('box_id', box_id);
      } else {
        // No record at all → create one
        await supabase.from('box_subscriptions')
          .insert({
            box_id: box_id,
            status: 'trialing',
            stripe_customer_id: customerId,
            plan_tier: 'complete',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            is_early_adopter: false,
          });
      }
    }

    // Calculate remaining trial days
    let trialPeriodDays: number | undefined;
    if (sub?.status === 'trialing' && sub?.trial_ends_at) {
      const remaining = Math.ceil(
        (new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      trialPeriodDays = Math.max(remaining, 0) || undefined;
    }

    const priceId = billing === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://the-hub-rho.vercel.app';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(trialPeriodDays && trialPeriodDays > 0
        ? { subscription_data: { trial_period_days: trialPeriodDays } }
        : {}),
      success_url: `${baseUrl}/pricing/success?box_id=${box_id}`,
      cancel_url: `${baseUrl}/pricing?box_id=${box_id}`,
      metadata: {
        box_id: box_id,
        supabase_owner_id: (box as any).owner_id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
