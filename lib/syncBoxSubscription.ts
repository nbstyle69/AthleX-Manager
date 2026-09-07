import type { createServiceClient } from '@/lib/supabase/server';
import {
  boxSubscriptionSync,
  getPlatformStripe,
  isManualBilling,
  isSyncableStripeStatus,
  STRIPE_BILLING_SOURCE,
  type StripeSubscriptionLike,
} from '@/lib/stripeSubscription';

export interface BoxSubscriptionSyncResult {
  /** Statut en base après l'appel ('none' sans ligne). */
  status: string;
  updated: boolean;
  current_period_end: string | null;
  source?: 'manual';
  message?: string;
}

/**
 * Relit l'abonnement Stripe d'une box et écrit statut + période dans
 * `box_subscriptions`. Partagé par la route `verify-subscription` (bouton,
 * TrialBanner) et par la resync au rendu du layout gérant.
 *
 * Ne touche jamais une ligne `billing_source = 'manual'`, ni une ligne sans
 * identifiant Stripe ; ignore les statuts Stripe transitoires (incomplete…).
 */
export async function syncBoxSubscriptionFromStripe(
  supabase: ReturnType<typeof createServiceClient>,
  boxId: string,
): Promise<BoxSubscriptionSyncResult> {
  const { data: sub } = await supabase.from('box_subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status, current_period_end, billing_source')
    .eq('box_id', boxId)
    .maybeSingle();

  if (!sub) {
    return { status: 'none', updated: false, current_period_end: null, message: 'No subscription record — go to pricing page to subscribe' };
  }

  const unchanged: BoxSubscriptionSyncResult = { status: sub.status, updated: false, current_period_end: sub.current_period_end };

  if (isManualBilling(sub)) return { ...unchanged, source: 'manual' };
  if (!sub.stripe_subscription_id && !sub.stripe_customer_id) return unchanged;

  const stripe = getPlatformStripe();

  let subscription: (StripeSubscriptionLike & { id: string }) | null = null;
  if (sub.stripe_subscription_id) {
    subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as unknown as StripeSubscriptionLike & { id: string };
  } else {
    const list = await stripe.subscriptions.list({ customer: sub.stripe_customer_id!, limit: 1 });
    subscription = (list.data[0] as unknown as StripeSubscriptionLike & { id: string }) ?? null;
  }

  if (!subscription || !isSyncableStripeStatus(subscription.status)) return unchanged;

  const sync = boxSubscriptionSync(subscription);
  const patch = sub.stripe_subscription_id ? sync : { ...sync, stripe_subscription_id: subscription.id };

  const { error } = await supabase.from('box_subscriptions')
    .update(patch)
    .eq('box_id', boxId)
    .eq('billing_source', STRIPE_BILLING_SOURCE);
  if (error) throw new Error(error.message);

  return { status: sync.status, updated: true, current_period_end: sync.current_period_end ?? sub.current_period_end };
}
