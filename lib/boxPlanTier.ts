export interface BoxSubscriptionTier {
  box_id: string;
  status: string;
  plan_tier: string | null;
}

export const FREE_TIER = 'free';

/** Palier affiché pour une box : plan_tier de sa ligne box_subscriptions active, sinon « free ». */
export function activePlanTier(subs: BoxSubscriptionTier[] | null | undefined): string {
  const active = (subs ?? []).find(s => s.status === 'active');
  return active?.plan_tier || FREE_TIER;
}

export function planTierClasses(tier: string): string {
  switch (tier) {
    case 'multi': return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/20';
    case 'complete': return 'text-purple-400 bg-purple-500/15 border-purple-500/20';
    default: return 'text-gray-400 bg-white/5 border-white/10';
  }
}
