/**
 * Calcul de l'accès au back-office gérant depuis la ligne box_subscriptions.
 *
 *   - active            : accès
 *   - past_due          : accès + bandeau « paiement en échec » (lien portail)
 *   - trialing en cours : accès + bandeau essai
 *   - canceled / expired / essai fini / aucune ligne : verrouillé (PaywallOverlay)
 *
 * Ligne Stripe active dont la période est dépassée de plus de
 * STALE_ACTIVE_GRACE_DAYS : `needsResync` — le layout relit Stripe avant de
 * décider, et ne verrouille que si Stripe confirme un statut non actif.
 * Une ligne offerte (billing_source 'manual') n'est jamais resynchronisée ni
 * verrouillée pour cause de période.
 */

export const STALE_ACTIVE_GRACE_DAYS = 7;

export interface BoxAccessRow {
  status: string;
  billing_source?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
}

export interface BoxAccessState {
  locked: boolean;
  /** Bandeau à afficher en haut du dashboard. */
  banner: 'past_due' | null;
  /** Ligne Stripe active à période dépassée > 7 j : relire Stripe avant de trancher. */
  needsResync: boolean;
  daysLeft: number;
}

export function trialDaysLeft(trialEndsAt: string | null | undefined, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  return Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86_400_000);
}

export function boxAccessState(row: BoxAccessRow | null | undefined, now: Date = new Date()): BoxAccessState {
  const status = row?.status ?? 'none';
  const daysLeft = trialDaysLeft(row?.trial_ends_at, now);
  const base: BoxAccessState = { locked: false, banner: null, needsResync: false, daysLeft };

  switch (status) {
    case 'active': {
      if (!row || row.billing_source === 'manual') return base;
      const hasStripe = !!(row.stripe_subscription_id || row.stripe_customer_id);
      const end = row.current_period_end ? new Date(row.current_period_end).getTime() : NaN;
      const stale = !Number.isNaN(end) && now.getTime() - end > STALE_ACTIVE_GRACE_DAYS * 86_400_000;
      return { ...base, needsResync: hasStripe && stale };
    }
    case 'past_due':
      return { ...base, banner: 'past_due' };
    case 'trialing':
      return { ...base, locked: daysLeft <= 0 };
    default:
      return { ...base, locked: true };
  }
}

/**
 * Après resync d'une ligne active périmée : on ne verrouille que si Stripe a
 * confirmé un statut qui verrouille par lui-même (canceled, expired…).
 * past_due garde l'accès (avec bandeau), active reste ouvert.
 */
export function accessAfterResync(confirmedStatus: string, now: Date = new Date()): BoxAccessState {
  return boxAccessState({ status: confirmedStatus }, now);
}
