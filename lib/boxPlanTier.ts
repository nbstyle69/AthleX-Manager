export interface BoxSubscriptionTier {
  box_id: string;
  status: string;
  plan_tier: string | null;
  current_period_end?: string | null;
}

export const FREE_TIER = 'free';

export interface BoxPlanInfo {
  plan_tier: string;
  /** ISO de current_period_end si la ligne active est échue, sinon null. */
  expired_at: string | null;
}

/** Palier affiché pour une box : plan_tier de sa ligne box_subscriptions active, sinon « free ». */
export function activePlanTier(subs: BoxSubscriptionTier[] | null | undefined): string {
  return boxPlanInfo(subs).plan_tier;
}

export function boxPlanInfo(subs: BoxSubscriptionTier[] | null | undefined, now: Date = new Date()): BoxPlanInfo {
  const active = (subs ?? []).find(s => s.status === 'active');
  if (!active) return { plan_tier: FREE_TIER, expired_at: null };
  const end = active.current_period_end ? new Date(active.current_period_end) : null;
  const expired = end !== null && !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
  return { plan_tier: active.plan_tier || FREE_TIER, expired_at: expired ? end!.toISOString() : null };
}

export function formatExpiredSince(iso: string): string {
  const d = new Date(iso);
  return `échue depuis le ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function planTierClasses(tier: string): string {
  switch (tier) {
    case 'multi': return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/20';
    case 'complete': return 'text-purple-400 bg-purple-500/15 border-purple-500/20';
    default: return 'text-gray-400 bg-white/5 border-white/10';
  }
}
