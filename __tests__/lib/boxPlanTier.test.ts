import { activePlanTier, FREE_TIER } from '@/lib/boxPlanTier';

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
