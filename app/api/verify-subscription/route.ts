import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireBoxOwner } from '@/lib/requireBoxOwner';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { box_id } = await req.json();

    const guard = await requireBoxOwner(box_id);
    if (!guard.ok) return guard.response;
    const supabase = guard.service;

    const { data: sub } = await supabase.from('box_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('box_id', box_id)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ status: 'none', message: 'No subscription record — go to pricing page to subscribe' });
    }

    // If already active, nothing to do
    if (sub.status === 'active') {
      return NextResponse.json({ status: 'active', updated: false });
    }

    const stripe = getStripe();

    // Try with subscription ID first
    if (sub.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as any;

      let status: string;
      switch (subscription.status) {
        case 'trialing': status = 'trialing'; break;
        case 'active': status = 'active'; break;
        case 'past_due': status = 'past_due'; break;
        case 'canceled':
        case 'unpaid': status = 'canceled'; break;
        default: status = 'expired';
      }

      await supabase.from('box_subscriptions')
        .update({
          status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq('box_id', box_id);

      return NextResponse.json({ status, updated: true });
    }

    // Fallback: search by customer ID for recent subscriptions
    if (sub.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: sub.stripe_customer_id,
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0] as any;

        let status: string;
        switch (subscription.status) {
          case 'trialing': status = 'trialing'; break;
          case 'active': status = 'active'; break;
          case 'past_due': status = 'past_due'; break;
          case 'canceled':
          case 'unpaid': status = 'canceled'; break;
          default: status = 'expired';
        }

        await supabase.from('box_subscriptions')
          .update({
            status,
            stripe_subscription_id: subscription.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          })
          .eq('box_id', box_id);

        return NextResponse.json({ status, updated: true });
      }
    }

    return NextResponse.json({ status: sub.status, updated: false });
  } catch (err: any) {
    console.error('verify-subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
