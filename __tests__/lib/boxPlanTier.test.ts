import { activePlanTier, boxPlanInfo, formatExpiredSince, FREE_TIER } from '@/lib/boxPlanTier';

describe('boxPlanInfo — période échue', () => {
  const now = new Date('2026-09-07T12:00:00Z');

  it('signale expired_at quand current_period_end est passé (palier conservé)', () => {
    const info = boxPlanInfo([{ box_id: 'a', status: 'active', plan_tier: 'complete', current_period_end: '2026-08-12T19:16:33+00:00' }], now);
    expect(info.plan_tier).toBe('complete');
    expect(info.expired_at).toBe('2026-08-12T19:16:33.000Z');
  });

  it('pas de mention si la période est à venir ou absente', () => {
    expect(boxPlanInfo([{ box_id: 'a', status: 'active', plan_tier: 'complete', current_period_end: '2027-09-06T00:00:00Z' }], now).expired_at).toBeNull();
    expect(boxPlanInfo([{ box_id: 'a', status: 'active', plan_tier: 'complete', current_period_end: null }], now).expired_at).toBeNull();
  });

  it('pas de mention pour une ligne non active même échue', () => {
    expect(boxPlanInfo([{ box_id: 'a', status: 'trialing', plan_tier: 'complete', current_period_end: '2020-01-01T00:00:00Z' }], now).expired_at).toBeNull();
  });

  it('formatExpiredSince → « échue depuis le JJ/MM »', () => {
    expect(formatExpiredSince('2026-08-12T12:00:00Z')).toBe('échue depuis le 12/08');
  });
});

describe('activePlanTier', () => {
  it('renvoie plan_tier de la ligne active', () => {
    expect(activePlanTier([{ box_id: 'a', status: 'active', plan_tier: 'complete' }])).toBe('complete');
  });

  it('ignore les lignes non actives (trialing, canceled)', () => {
    expect(activePlanTier([
      { box_id: 'a', status: 'trialing', plan_tier: 'complete' },
      { box_id: 'a', status: 'canceled', plan_tier: 'multi' },
    ])).toBe(FREE_TIER);
  });

  it('free sans aucune ligne', () => {
    expect(activePlanTier([])).toBe(FREE_TIER);
    expect(activePlanTier(null)).toBe(FREE_TIER);
  });

  it('free si la ligne active n\'a pas de plan_tier', () => {
    expect(activePlanTier([{ box_id: 'a', status: 'active', plan_tier: null }])).toBe(FREE_TIER);
  });
});
