process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockRetrieve = jest.fn();
const mockList = jest.fn();
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    subscriptions: { retrieve: mockRetrieve, list: mockList },
  })),
}));

import { syncBoxSubscriptionFromStripe } from '@/lib/syncBoxSubscription';

function makeClient(row: any) {
  const chain: any = {};
  const ret = () => chain;
  ['select', 'update', 'eq', 'order', 'limit'].forEach((m) => (chain[m] = jest.fn(ret)));
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
  chain.then = (resolve: Function) => Promise.resolve({ data: null, error: null }).then(resolve as any);
  return { client: { from: jest.fn(() => chain) } as any, chain };
}

beforeEach(() => jest.clearAllMocks());

describe('syncBoxSubscriptionFromStripe', () => {
  it('aucune ligne → status none, pas d\'appel Stripe', async () => {
    const { client } = makeClient(null);
    const r = await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(r.status).toBe('none');
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('ligne manual (offerte) : jamais touchée, même avec un identifiant Stripe posé par erreur', async () => {
    const { client, chain } = makeClient({
      status: 'active', billing_source: 'manual', stripe_customer_id: 'cus_x', stripe_subscription_id: 'sub_x', current_period_end: '2020-01-01T00:00:00Z',
    });
    const r = await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(r).toEqual({ status: 'active', updated: false, current_period_end: '2020-01-01T00:00:00Z', source: 'manual' });
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('ligne stripe sans identifiant : rien à synchroniser', async () => {
    const { client, chain } = makeClient({ status: 'trialing', billing_source: 'stripe', stripe_customer_id: null, stripe_subscription_id: null, current_period_end: null });
    const r = await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(r).toMatchObject({ status: 'trialing', updated: false });
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('ligne stripe active périmée, Stripe confirme canceled → écrit canceled, filtré billing_source = stripe', async () => {
    const { client, chain } = makeClient({ status: 'active', billing_source: 'stripe', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', current_period_end: '2026-08-12T19:16:33Z' });
    mockRetrieve.mockResolvedValue({ id: 'sub_1', status: 'canceled', trial_end: null, items: { data: [{ current_period_end: 1789240593 }] } });
    const r = await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(r).toEqual({ status: 'canceled', updated: true, current_period_end: '2026-09-12T19:16:33.000Z' });
    expect(chain.update).toHaveBeenCalledWith({ status: 'canceled', current_period_end: '2026-09-12T19:16:33.000Z', trial_ends_at: null });
    expect(chain.eq).toHaveBeenCalledWith('billing_source', 'stripe');
  });

  it('Stripe confirme active (renouvellement manqué par le webhook) → active, nouvelle période', async () => {
    const { client } = makeClient({ status: 'active', billing_source: 'stripe', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', current_period_end: '2026-08-12T19:16:33Z' });
    mockRetrieve.mockResolvedValue({ id: 'sub_1', status: 'active', trial_end: null, items: { data: [{ current_period_end: 1789240593 }] } });
    const r = await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(r).toMatchObject({ status: 'active', updated: true, current_period_end: '2026-09-12T19:16:33.000Z' });
  });

  it('statut Stripe incomplete → aucune écriture', async () => {
    const { client, chain } = makeClient({ status: 'active', billing_source: 'stripe', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', current_period_end: null });
    mockRetrieve.mockResolvedValue({ id: 'sub_1', status: 'incomplete' });
    const r = await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(r.updated).toBe(false);
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('repli par customer : pose stripe_subscription_id', async () => {
    const { client, chain } = makeClient({ status: 'trialing', billing_source: 'stripe', stripe_customer_id: 'cus_1', stripe_subscription_id: null, current_period_end: null });
    mockList.mockResolvedValue({ data: [{ id: 'sub_new', status: 'active', trial_end: null, current_period_end: 1789240593 }] });
    await syncBoxSubscriptionFromStripe(client, 'box-1');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', stripe_subscription_id: 'sub_new' }));
  });
});
