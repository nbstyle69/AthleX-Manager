import { parisDate } from '@/lib/datetime';

export interface BoxSubscriptionTier {
  box_id: string;
  status: string;
  plan_tier: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  billing_source?: string | null;
}

export const FREE_TIER = 'free';

/**
 * Étiquette du badge super admin :
 *   - 'complete' / 'multi' : palier de la ligne active (Stripe ou offerte)
 *   - 'essai'   : ligne trialing dont l'essai court encore
 *   - 'impayé'  : ligne past_due (accès maintenu, paiement en échec)
 *   - 'free'    : rien d'actif
 * `offered` = ligne active billing_source 'manual' (mention « offert » à côté).
 */
export interface BoxPlanInfo {
  plan_tier: string;
  /** ISO de current_period_end si la ligne active est échue, sinon null. */
  expired_at: string | null;
  offered: boolean;
}

/** Palier affiché pour une box : plan_tier de sa ligne box_subscriptions active, sinon « free ». */
export function activePlanTier(subs: BoxSubscriptionTier[] | null | undefined): string {
  return boxPlanInfo(subs).plan_tier;
}

export function boxPlanInfo(subs: BoxSubscriptionTier[] | null | undefined, now: Date = new Date()): BoxPlanInfo {
  const rows = subs ?? [];
  const active = rows.find(s => s.status === 'active');
  if (!active) {
    if (rows.some(s => s.status === 'past_due')) return { plan_tier: 'impayé', expired_at: null, offered: false };
    const trial = rows.find(s => s.status === 'trialing');
    if (trial && !isPast(trial.trial_ends_at ?? trial.current_period_end, now)) {
      return { plan_tier: 'essai', expired_at: null, offered: false };
    }
    return { plan_tier: FREE_TIER, expired_at: null, offered: false };
  }
  const end = active.current_period_end ? new Date(active.current_period_end) : null;
  const expired = end !== null && !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
  return {
    plan_tier: active.plan_tier || FREE_TIER,
    expired_at: expired ? end!.toISOString() : null,
    offered: active.billing_source === 'manual',
  };
}

function isPast(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < now.getTime();
}

export function formatExpiredSince(iso: string): string {
  return `échue depuis le ${parisDate(iso, { day: '2-digit', month: '2-digit' })}`;
}

/** Pastille de formule (super-admin), en jetons `--ax-*` : même sens qu'avant, lisible dans les deux thèmes. */
export function planTierClasses(tier: string): string {
  switch (tier) {
    case 'multi': return 'text-ax-warning bg-ax-warning-soft border-ax-warning';
    case 'complete': return 'text-ax-purple bg-[color-mix(in_srgb,var(--ax-purple)_12%,var(--ax-surface))] border-ax-purple';
    case 'essai': return 'text-[color:var(--ax-sub-sky-text)] bg-[color-mix(in_srgb,var(--ax-sub-sky-text)_12%,var(--ax-surface))] border-[color:var(--ax-sub-sky-text)]';
    case 'impayé': return 'text-ax-danger bg-ax-danger-soft border-ax-danger';
    default: return 'text-ax-text-secondary bg-ax-neutral-soft border-ax-border';
  }
}
