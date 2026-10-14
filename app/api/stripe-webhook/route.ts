import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import {
  boxSubscriptionSync,
  getPlatformStripe,
  isSyncableStripeStatus,
  STRIPE_BILLING_SOURCE,
  type StripeSubscriptionLike,
} from '@/lib/stripeSubscription';
import { logStripeError } from '@/lib/membership/server';
import { must } from '@/lib/stripe/must';

const ROUTE = 'stripe-webhook';

// Toute écriture pilotée par Stripe filtre sur billing_source = 'stripe' :
// une ligne offerte (manual) n'est jamais touchée, quel que soit l'événement.

export async function POST(req: NextRequest) {
  const stripe = getPlatformStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    logStripeError(ROUTE, 'signature', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Owner-level Multi-box subscription.
        if (session.metadata?.owner_subscription === '1') {
          const ownerId = session.metadata?.supabase_owner_id;
          const quota = Number(session.metadata?.box_quota ?? '1') || 1;
          if (!ownerId) break;
          const ownerSub = await stripe.subscriptions.retrieve(subscriptionId) as unknown as StripeSubscriptionLike;
          const { current_period_end } = boxSubscriptionSync(ownerSub);
          must(await supabase.from('owner_subscriptions').upsert({
            owner_id: ownerId,
            plan_tier: 'multi',
            box_quota: quota,
            status: ownerSub.status === 'trialing' ? 'trialing' : 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            billing_source: STRIPE_BILLING_SOURCE,
            ...(current_period_end ? { current_period_end } : {}),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'owner_id' }), 'owner_subscriptions.upsert');
          console.log('Owner Multi checkout completed');
          break;
        }

        const boxId = session.metadata?.box_id;
        if (!boxId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as StripeSubscriptionLike;
        const sync = boxSubscriptionSync(subscription);

        // Upsert sur box_id (contrainte unique) : une box sans ligne en reçoit
        // une, au lieu d'un update qui ne touchait rien, en silence.
        must(await supabase.from('box_subscriptions')
          .upsert({
            box_id: boxId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            billing_source: STRIPE_BILLING_SOURCE,
            plan_tier: 'complete',
            ...sync,
            status: subscription.status === 'trialing' ? 'trialing' : 'active',
          }, { onConflict: 'box_id' }), 'box_subscriptions.upsert');

        console.log('Checkout completed for box');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as unknown as StripeSubscriptionLike & { customer: string };
        const customerId = subscription.customer;

        // incomplete / incomplete_expired / paused : rien n'est écrit.
        if (!isSyncableStripeStatus(subscription.status)) {
          console.log(`Subscription ${subscription.status} ignored`);
          break;
        }

        // past_due conservé tel quel ; unpaid → canceled (mapStripeStatus).
        const { status, current_period_end, trial_ends_at } = boxSubscriptionSync(subscription);
        const periodPatch = current_period_end ? { current_period_end } : {};

        must(await supabase.from('box_subscriptions')
          .update({ status, ...periodPatch, trial_ends_at })
          .eq('stripe_customer_id', customerId)
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'box_subscriptions.update');

        // Owner-level subscription mirrors the same status transitions.
        must(await supabase.from('owner_subscriptions')
          .update({ status, ...periodPatch, updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId)
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'owner_subscriptions.update');

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        must(await supabase.from('box_subscriptions')
          .update({ status: 'canceled', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'box_subscriptions.update');

        must(await supabase.from('owner_subscriptions')
          .update({ status: 'canceled', stripe_subscription_id: null, updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId)
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'owner_subscriptions.update');

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        must(await supabase.from('box_subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', customerId)
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'box_subscriptions.update');

        must(await supabase.from('owner_subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId)
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'owner_subscriptions.update');

        break;
      }

      // Paiement de rattrapage après un échec : la ligne past_due redevient
      // active. Les autres statuts (trialing, première facture) ne bougent pas —
      // c'est customer.subscription.updated qui fait foi.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        must(await supabase.from('box_subscriptions')
          .update({ status: 'active' })
          .eq('stripe_customer_id', customerId)
          .eq('status', 'past_due')
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'box_subscriptions.update');

        must(await supabase.from('owner_subscriptions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId)
          .eq('status', 'past_due')
          .eq('billing_source', STRIPE_BILLING_SOURCE), 'owner_subscriptions.update');

        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    // 500 : Stripe rejoue l'événement. Le message reste dans le journal, nettoyé.
    logStripeError(ROUTE, event.type, err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
