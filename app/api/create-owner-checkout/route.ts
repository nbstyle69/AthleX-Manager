import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site-url';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });
}

// Owner-level Multi-box checkout: base plan + (N-1) × extra-box price.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const PRICE_BASE = process.env.STRIPE_PRICE_MONTHLY_ID;
  const PRICE_EXTRA = process.env.STRIPE_PRICE_EXTRA_BOX_ID;

  if (!PRICE_BASE) {
    return NextResponse.json({ error: 'Facturation non configurée (STRIPE_PRICE_MONTHLY_ID manquant).' }, { status: 500 });
  }

  try {
    // Identify the authenticated owner from the session cookie.
    const authed = await createClient();
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const supabase = createServiceClient();

    // Owner box count drives the quota + extra-box quantity.
    const { data: owned } = await supabase
      .from('boxes').select('id').eq('owner_id', user.id);
    const boxCount = (owned ?? []).length;
    if (boxCount < 2) {
      return NextResponse.json({ error: 'Le plan Multi-box nécessite au moins 2 boxs.' }, { status: 400 });
    }
    const extraBoxes = boxCount - 1;

    if (extraBoxes > 0 && !PRICE_EXTRA) {
      return NextResponse.json({
        error: 'Le tarif « box supplémentaire » (STRIPE_PRICE_EXTRA_BOX_ID) n’est pas encore configuré.',
      }, { status: 500 });
    }

    const { data: profile } = await supabase
      .from('profiles').select('email').eq('id', user.id).single();

    // Reuse or create the owner Stripe customer + owner_subscriptions row.
    const { data: existing } = await supabase
      .from('owner_subscriptions')
      .select('stripe_customer_id')
      .eq('owner_id', user.id)
      .maybeSingle();

    let customerId = (existing as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (profile as { email?: string } | null)?.email ?? undefined,
        metadata: { supabase_owner_id: user.id, plan: 'multi' },
      });
      customerId = customer.id;
      await supabase.from('owner_subscriptions').upsert({
        owner_id: user.id,
        plan_tier: 'multi',
        box_quota: boxCount,
        status: 'trialing',
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' });
    } else {
      await supabase.from('owner_subscriptions')
        .update({ box_quota: boxCount, updated_at: new Date().toISOString() })
        .eq('owner_id', user.id);
    }

    const lineItems: { price: string; quantity: number }[] = [
      { price: PRICE_BASE, quantity: 1 },
    ];
    if (extraBoxes > 0 && PRICE_EXTRA) {
      lineItems.push({ price: PRICE_EXTRA, quantity: extraBoxes });
    }

    const baseUrl = SITE_URL;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}/pricing/success?owner=1`,
      cancel_url: `${baseUrl}/`,
      metadata: {
        owner_subscription: '1',
        supabase_owner_id: user.id,
        box_quota: String(boxCount),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-owner-checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
