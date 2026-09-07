import { accessAfterResync, boxAccessState, STALE_ACTIVE_GRACE_DAYS } from '@/lib/boxAccess';

const now = new Date('2026-09-07T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe('boxAccessState — verrouillage du back-office gérant', () => {
  it('aucune ligne → verrouillé', () => {
    expect(boxAccessState(null, now)).toMatchObject({ locked: true, banner: null, needsResync: false });
  });

  it('active stripe, période en cours → ouvert, pas de resync', () => {
    const s = boxAccessState({ status: 'active', billing_source: 'stripe', stripe_subscription_id: 'sub_1', current_period_end: inDays(5) }, now);
    expect(s).toMatchObject({ locked: false, banner: null, needsResync: false });
  });

  it('active stripe échue de moins de 7 jours → ouvert, pas de resync', () => {
    const s = boxAccessState({ status: 'active', billing_source: 'stripe', stripe_subscription_id: 'sub_1', current_period_end: daysAgo(STALE_ACTIVE_GRACE_DAYS - 1) }, now);
    expect(s).toMatchObject({ locked: false, needsResync: false });
  });

  it('active stripe échue de plus de 7 jours → ouvert MAIS resync demandée', () => {
    const s = boxAccessState({ status: 'active', billing_source: 'stripe', stripe_subscription_id: 'sub_1', current_period_end: daysAgo(STALE_ACTIVE_GRACE_DAYS + 1) }, now);
    expect(s).toMatchObject({ locked: false, needsResync: true });
  });

  it('active manual (offert) échue depuis longtemps → ouvert, jamais de resync', () => {
    const s = boxAccessState({ status: 'active', billing_source: 'manual', current_period_end: daysAgo(400) }, now);
    expect(s).toMatchObject({ locked: false, needsResync: false });
  });

  it('active stripe sans identifiant Stripe → rien à resynchroniser', () => {
    const s = boxAccessState({ status: 'active', billing_source: 'stripe', current_period_end: daysAgo(30) }, now);
    expect(s).toMatchObject({ locked: false, needsResync: false });
  });

  it('past_due → accès maintenu + bandeau', () => {
    expect(boxAccessState({ status: 'past_due', billing_source: 'stripe' }, now)).toMatchObject({ locked: false, banner: 'past_due' });
  });

  it('canceled / expired → verrouillé', () => {
    expect(boxAccessState({ status: 'canceled' }, now).locked).toBe(true);
    expect(boxAccessState({ status: 'expired' }, now).locked).toBe(true);
  });

  it('trialing : ouvert tant que trial_ends_at est à venir, verrouillé après', () => {
    expect(boxAccessState({ status: 'trialing', trial_ends_at: inDays(3) }, now)).toMatchObject({ locked: false, daysLeft: 3 });
    expect(boxAccessState({ status: 'trialing', trial_ends_at: daysAgo(1) }, now).locked).toBe(true);
    expect(boxAccessState({ status: 'trialing', trial_ends_at: null }, now).locked).toBe(true);
  });
});

describe('accessAfterResync — verrouillage seulement si Stripe confirme', () => {
  it('Stripe confirme active → ouvert', () => {
    expect(accessAfterResync('active', now).locked).toBe(false);
  });
  it('Stripe confirme past_due → ouvert avec bandeau', () => {
    expect(accessAfterResync('past_due', now)).toMatchObject({ locked: false, banner: 'past_due' });
  });
  it('Stripe confirme canceled → verrouillé', () => {
    expect(accessAfterResync('canceled', now).locked).toBe(true);
  });
});
