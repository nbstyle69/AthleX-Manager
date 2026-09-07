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
  const d = new Date(iso);
  return `échue depuis le ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function planTierClasses(tier: string): string {
  switch (tier) {
    case 'multi': return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/20';
    case 'complete': return 'text-purple-400 bg-purple-500/15 border-purple-500/20';
    case 'essai': return 'text-sky-400 bg-sky-500/15 border-sky-500/20';
    case 'impayé': return 'text-red-400 bg-red-500/15 border-red-500/20';
    default: return 'text-gray-400 bg-white/5 border-white/10';
  }
}
