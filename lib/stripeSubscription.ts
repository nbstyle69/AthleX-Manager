import Stripe from 'stripe';

/**
 * Version d'API Stripe utilisée par la plateforme (celle du SDK installé, égale
 * à la version par défaut du compte/sandbox). Les payloads webhook suivent la
 * version du compte quoi qu'il arrive : depuis 2025-03-31, `current_period_end`
 * n'est plus à la racine de la subscription mais sur chaque `items.data[]`.
 */
export const STRIPE_API_VERSION = '2026-03-25.dahlia';

export function getPlatformStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION });
}

export type BoxSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

/**
 * Origine d'une ligne d'abonnement. 'manual' = offerte / saisie à la main :
 * aucun mécanisme Stripe (webhook, verify-subscription, resync au rendu) ne la
 * touche. Toute écriture Stripe filtre sur `billing_source = 'stripe'`.
 */
export type BillingSource = 'stripe' | 'manual';
export const STRIPE_BILLING_SOURCE: BillingSource = 'stripe';

export function isManualBilling(row: { billing_source?: string | null } | null | undefined): boolean {
  return row?.billing_source === 'manual';
}

/**
 * Statuts Stripe transitoires (`incomplete`, `incomplete_expired`, `paused`) :
 * le checkout n'a pas abouti ou l'abonnement est suspendu par Stripe ; on ne
 * répercute rien en base tant que Stripe n'a pas tranché.
 */
export function isSyncableStripeStatus(stripeStatus: string): boolean {
  return ['trialing', 'active', 'past_due', 'canceled', 'unpaid'].includes(stripeStatus);
}

export interface StripeSubscriptionLike {
  status: string;
  current_period_end?: number | null;
  trial_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> | null } | null;
}

export function mapStripeStatus(stripeStatus: string): BoxSubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'unpaid': return 'canceled';
    default: return 'expired';
  }
}

/** Fin de période (secondes epoch) : max des items, repli sur la racine. */
export function subscriptionPeriodEnd(sub: StripeSubscriptionLike): number | null {
  const fromItems = (sub.items?.data ?? [])
    .map(i => i.current_period_end)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (fromItems.length > 0) return Math.max(...fromItems);
  return typeof sub.current_period_end === 'number' ? sub.current_period_end : null;
}

function toIso(epochSeconds: number | null): string | null {
  return epochSeconds === null ? null : new Date(epochSeconds * 1000).toISOString();
}

export interface BoxSubscriptionSync {
  status: BoxSubscriptionStatus;
  current_period_end?: string;
  trial_ends_at: string | null;
}

/**
 * Champs à écrire dans `box_subscriptions` depuis une subscription Stripe.
 * `current_period_end` est omis (et donc non écrasé) si Stripe ne le fournit
 * ni sur les items ni à la racine.
 */
export function boxSubscriptionSync(sub: StripeSubscriptionLike): BoxSubscriptionSync {
  const periodEnd = toIso(subscriptionPeriodEnd(sub));
  return {
    status: mapStripeStatus(sub.status),
    ...(periodEnd ? { current_period_end: periodEnd } : {}),
    trial_ends_at: toIso(typeof sub.trial_end === 'number' ? sub.trial_end : null),
  };
}
