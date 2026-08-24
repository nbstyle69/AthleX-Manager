/**
 * Sélection de l'adhésion affichée sur /compte.
 *
 * Adhésion et abonnement Stripe sont deux choses : une formule payée au
 * comptoir ou attribuée par le gérant rend une adhésion `active` avec
 * `subscription_status` NULL. Filtrer sur cette colonne masquait ces
 * adhérents et leur proposait « Trouve ta box » alors qu'ils en ont une.
 */
export interface MembershipBillingRow {
  id: string;
  box_id: string;
  status: string | null;
  joined_at: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  amount_cents: number | null;
  commitment_end_date: string | null;
  subscription_paused: boolean | null;
  pause_resumes_at: string | null;
}

const STRIPE_VIVANT = ['active', 'trialing', 'past_due'];

export interface MembershipSelection {
  membership: MembershipBillingRow | null;
  /** L'adhésion affichée est portée par un abonnement Stripe. */
  stripeBacked: boolean;
  /** Un changement de formule en ligne est possible. */
  canManage: boolean;
}

export function selectMembership(
  rows: MembershipBillingRow[],
): MembershipSelection {
  const retenues = rows
    .filter((m) => m.status === 'active' || m.subscription_status != null)
    .sort((a, b) => (b.joined_at ?? '').localeCompare(a.joined_at ?? ''));

  const membership =
    retenues.find((m) => STRIPE_VIVANT.includes(m.subscription_status ?? '')) ??
    retenues.find((m) => m.status === 'active') ??
    retenues[0] ??
    null;

  const stripeBacked = membership?.subscription_status != null;

  return {
    membership,
    stripeBacked,
    canManage:
      stripeBacked &&
      STRIPE_VIVANT.includes(membership?.subscription_status ?? ''),
  };
}
