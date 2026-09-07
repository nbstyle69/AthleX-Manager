import { boxSubscriptionSync, mapStripeStatus, subscriptionPeriodEnd } from '@/lib/stripeSubscription';

// Payload réel (sandbox, API >= 2025-03-31) : current_period_end absent de la
// racine, porté par items.data[].current_period_end.
const nbs2Updated = {
  id: 'sub_1TsSrdJDlbyV6Ki3GmhQTY7G',
  status: 'active',
  customer: 'cus_UKQF',
  trial_end: null,
  items: { data: [{ id: 'si_x', current_period_start: 1786562193, current_period_end: 1789240593 }] },
};

describe('subscriptionPeriodEnd', () => {
  it('lit la période depuis les items quand la racine est absente', () => {
    expect(subscriptionPeriodEnd(nbs2Updated)).toBe(1789240593);
  });

  it('prend le max des items', () => {
    expect(subscriptionPeriodEnd({ status: 'active', items: { data: [{ current_period_end: 10 }, { current_period_end: 20 }] } })).toBe(20);
  });

  it('repli sur la racine (API 2023-10-16) si aucun item ne porte la période', () => {
    expect(subscriptionPeriodEnd({ status: 'active', current_period_end: 1800000000, items: { data: [{}] } })).toBe(1800000000);
    expect(subscriptionPeriodEnd({ status: 'active', current_period_end: 1800000000 })).toBe(1800000000);
  });

  it('null si rien nulle part', () => {
    expect(subscriptionPeriodEnd({ status: 'active' })).toBeNull();
  });
});

describe('boxSubscriptionSync', () => {
  it('NBS2 : la ligne passe au 12/09/2026', () => {
    expect(boxSubscriptionSync(nbs2Updated)).toEqual({
      status: 'active',
      current_period_end: '2026-09-12T19:16:33.000Z',
      trial_ends_at: null,
    });
  });

  it("n'écrase pas current_period_end quand Stripe ne le fournit pas", () => {
    expect(boxSubscriptionSync({ status: 'past_due' })).toEqual({ status: 'past_due', trial_ends_at: null });
  });

  it('trial_ends_at depuis trial_end', () => {
    expect(boxSubscriptionSync({ status: 'trialing', trial_end: 1789240593 }).trial_ends_at).toBe('2026-09-12T19:16:33.000Z');
  });
});

describe('mapStripeStatus', () => {
  it.each([
    ['trialing', 'trialing'], ['active', 'active'], ['past_due', 'past_due'],
    ['canceled', 'canceled'], ['unpaid', 'canceled'], ['incomplete', 'expired'], ['paused', 'expired'],
  ])('%s → %s', (input, expected) => {
    expect(mapStripeStatus(input)).toBe(expected);
  });
});
