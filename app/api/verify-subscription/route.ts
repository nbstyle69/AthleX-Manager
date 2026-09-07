import { NextRequest, NextResponse } from 'next/server';
import { requireBoxOwner } from '@/lib/requireBoxOwner';
import { boxSubscriptionSync, getPlatformStripe, type StripeSubscriptionLike } from '@/lib/stripeSubscription';

export async function POST(req: NextRequest) {
  try {
    const { box_id } = await req.json();

    const guard = await requireBoxOwner(box_id);
    if (!guard.ok) return guard.response;
    const supabase = guard.service;

    const { data: sub } = await supabase.from('box_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status, current_period_end')
      .eq('box_id', box_id)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ status: 'none', message: 'No subscription record — go to pricing page to subscribe' });
    }

    // Une ligne active sans identifiant Stripe est offerte : rien à synchroniser.
    if (sub.status === 'active' && !sub.stripe_subscription_id && !sub.stripe_customer_id) {
      return NextResponse.json({ status: 'active', updated: false, current_period_end: sub.current_period_end, source: 'manual' });
    }

    const stripe = getPlatformStripe();

    // Try with subscription ID first
    if (sub.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as unknown as StripeSubscriptionLike;
      const sync = boxSubscriptionSync(subscription);

      await supabase.from('box_subscriptions')
        .update(sync)
        .eq('box_id', box_id);

      return NextResponse.json({ status: sync.status, updated: true, current_period_end: sync.current_period_end ?? sub.current_period_end });
    }

    // Fallback: search by customer ID for recent subscriptions
    if (sub.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: sub.stripe_customer_id,
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0] as unknown as StripeSubscriptionLike & { id: string };
        const sync = boxSubscriptionSync(subscription);

        await supabase.from('box_subscriptions')
          .update({ ...sync, stripe_subscription_id: subscription.id })
          .eq('box_id', box_id);

        return NextResponse.json({ status: sync.status, updated: true, current_period_end: sync.current_period_end ?? sub.current_period_end });
      }
    }

    return NextResponse.json({ status: sub.status, updated: false, current_period_end: sub.current_period_end });
  } catch (err: any) {
    console.error('verify-subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
