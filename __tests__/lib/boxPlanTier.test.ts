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

  it('ignore les lignes non actives (canceled, expired) ; un essai en cours devient « essai »', () => {
    expect(activePlanTier([
      { box_id: 'a', status: 'expired', plan_tier: 'complete' },
      { box_id: 'a', status: 'canceled', plan_tier: 'multi' },
    ])).toBe(FREE_TIER);
    expect(activePlanTier([{ box_id: 'a', status: 'trialing', plan_tier: 'complete' }])).toBe('essai');
  });

  it('free sans aucune ligne', () => {
    expect(activePlanTier([])).toBe(FREE_TIER);
    expect(activePlanTier(null)).toBe(FREE_TIER);
  });

  it('free si la ligne active n\'a pas de plan_tier', () => {
    expect(activePlanTier([{ box_id: 'a', status: 'active', plan_tier: null }])).toBe(FREE_TIER);
  });
});

describe('boxPlanInfo — badges essai / impayé / offert', () => {
  const now = new Date('2026-09-07T12:00:00Z');

  it('trialing en cours → « essai » (RAW PERFORMANCE)', () => {
    const info = boxPlanInfo([{ box_id: 'raw', status: 'trialing', plan_tier: 'complete', current_period_end: '2026-09-16T14:12:00Z', trial_ends_at: '2026-09-16T14:12:00Z' }], now);
    expect(info).toEqual({ plan_tier: 'essai', expired_at: null, offered: false });
  });

  it('trialing dont l\'essai est fini → free', () => {
    expect(boxPlanInfo([{ box_id: 'a', status: 'trialing', plan_tier: 'trial', trial_ends_at: '2026-01-01T00:00:00Z' }], now).plan_tier).toBe(FREE_TIER);
  });

  it('trialing sans date de fin → « essai » (Crossfit AX)', () => {
    expect(boxPlanInfo([{ box_id: 'ax', status: 'trialing', plan_tier: 'trial', current_period_end: null, trial_ends_at: null }], now).plan_tier).toBe('essai');
  });

  it('past_due → « impayé »', () => {
    expect(boxPlanInfo([{ box_id: 'a', status: 'past_due', plan_tier: 'complete' }], now).plan_tier).toBe('impayé');
  });

  it('active manual → palier + offert (AthleX Fitness)', () => {
    const info = boxPlanInfo([{ box_id: 'fit', status: 'active', plan_tier: 'complete', billing_source: 'manual', current_period_end: '2027-09-06T00:00:00Z' }], now);
    expect(info).toEqual({ plan_tier: 'complete', expired_at: null, offered: true });
  });

  it('active stripe → palier sans mention offert (NBS2)', () => {
    const info = boxPlanInfo([{ box_id: 'nbs2', status: 'active', plan_tier: 'complete', billing_source: 'stripe', current_period_end: '2026-09-12T19:16:33Z' }], now);
    expect(info).toEqual({ plan_tier: 'complete', expired_at: null, offered: false });
  });

  it('canceled seule → free', () => {
    expect(boxPlanInfo([{ box_id: 'a', status: 'canceled', plan_tier: 'complete' }], now).plan_tier).toBe(FREE_TIER);
  });
});
