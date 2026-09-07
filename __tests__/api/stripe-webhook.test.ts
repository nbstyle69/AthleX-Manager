// Tests for app/api/stripe-webhook/route.ts (AthleX platform subscription webhook).

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockConstructEvent = jest.fn();
const mockRetrieve = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockRetrieve },
  })),
}));

function makeChain(cfg: { awaited?: any } = {}) {
  const awaited = cfg.awaited ?? { data: null, error: null };
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'ilike', 'in', 'order'].forEach(
    (m) => (c[m] = jest.fn(ret)),
  );
  c.then = (resolve: Function) => Promise.resolve(awaited).then(resolve as any);
  c.catch = (reject: Function) => Promise.resolve(awaited).catch(reject as any);
  return c;
}

let currentChain: any;
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: jest.fn(() => currentChain) })),
}));

import { POST } from '../../app/api/stripe-webhook/route';

function makeReq(opts: { signature?: string | null; body?: string } = {}): any {
  const signature = opts.signature === undefined ? 'sig_dummy' : opts.signature;
  return {
    headers: { get: (k: string) => (k === 'stripe-signature' ? signature : null) },
    text: jest.fn().mockResolvedValue(opts.body ?? '{}'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  currentChain = makeChain();
});

describe('POST /api/stripe-webhook', () => {
  it('returns 400 when the stripe-signature header is missing', async () => {
    const res = (await POST(makeReq({ signature: null }) as any)) as any;
    expect(res._status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad sig');
    });
    const res = (await POST(makeReq() as any)) as any;
    expect(res._status).toBe(400);
    expect(res._data.error).toBe('bad sig');
  });

  it('activates the box subscription on checkout.session.completed (active)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { box_id: 'box-1' }, customer: 'cus_1', subscription: 'sub_1' } },
    });
    mockRetrieve.mockResolvedValue({ status: 'active', current_period_end: 1800000000, trial_end: null });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(res._data).toEqual({ received: true });
    expect(currentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
        plan_tier: 'complete',
        status: 'active',
      }),
    );
    expect(currentChain.eq).toHaveBeenCalledWith('box_id', 'box-1');
  });

  it('marks the subscription trialing when Stripe reports a trial', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { box_id: 'box-1' }, customer: 'cus_1', subscription: 'sub_1' } },
    });
    mockRetrieve.mockResolvedValue({ status: 'trialing', current_period_end: 1800000000, trial_end: 1790000000 });

    await POST(makeReq() as any);

    expect(currentChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'trialing' }));
  });

  it('ignores checkout.session.completed without box_id (no write)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: {}, customer: 'cus_1', subscription: 'sub_1' } },
    });
    const res = (await POST(makeReq() as any)) as any;
    expect(res._status).toBe(200);
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(currentChain.update).not.toHaveBeenCalled();
  });

  it('cancels the subscription on customer.subscription.deleted', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_9' } },
    });
    await POST(makeReq() as any);
    expect(currentChain.update).toHaveBeenCalledWith({ status: 'canceled', stripe_subscription_id: null });
    expect(currentChain.eq).toHaveBeenCalledWith('stripe_customer_id', 'cus_9');
  });

  it('customer.subscription.updated : période lue dans items.data[] (racine absente, API >= 2025-03-31)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1TsSrdJDlbyV6Ki3GmhQTY7G',
          customer: 'cus_UKQF',
          status: 'active',
          trial_end: null,
          items: { data: [{ current_period_start: 1786562193, current_period_end: 1789240593 }] },
        },
        previous_attributes: { items: { data: [{ current_period_end: 1786562193 }] } },
      },
    });
    await POST(makeReq() as any);
    expect(currentChain.update).toHaveBeenCalledWith({
      status: 'active',
      current_period_end: '2026-09-12T19:16:33.000Z',
      trial_ends_at: null,
    });
    expect(currentChain.eq).toHaveBeenCalledWith('stripe_customer_id', 'cus_UKQF');
  });

  it('customer.subscription.updated : sans période nulle part, status seul est écrit', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_UKQF', status: 'past_due', trial_end: null } },
    });
    await POST(makeReq() as any);
    expect(currentChain.update).toHaveBeenCalledWith({ status: 'past_due', trial_ends_at: null });
  });

  it('checkout.session.completed : période depuis les items quand retrieve ne la met pas à la racine', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { box_id: 'box-1' }, customer: 'cus_1', subscription: 'sub_1' } },
    });
    mockRetrieve.mockResolvedValue({ status: 'active', trial_end: null, items: { data: [{ current_period_end: 1789240593 }] } });
    await POST(makeReq() as any);
    expect(currentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', current_period_end: '2026-09-12T19:16:33.000Z' }),
    );
  });

  it('sets past_due on invoice.payment_failed', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_9' } },
    });
    await POST(makeReq() as any);
    expect(currentChain.update).toHaveBeenCalledWith({ status: 'past_due' });
    expect(currentChain.eq).toHaveBeenCalledWith('stripe_customer_id', 'cus_9');
  });

  it('returns 500 when downstream processing throws', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { box_id: 'box-1' }, customer: 'cus_1', subscription: 'sub_1' } },
    });
    mockRetrieve.mockRejectedValue(new Error('stripe down'));
    const res = (await POST(makeReq() as any)) as any;
    expect(res._status).toBe(500);
    expect(res._data.error).toBe('stripe down');
  });

  describe('billing_source : les lignes manual ne sont jamais touchées', () => {
    // Chaque écriture Stripe est filtrée par .eq('billing_source', 'stripe') sur
    // box_subscriptions ET owner_subscriptions : une ligne manual est hors cible.
    function expectStripeOnlyFilter(times: number) {
      const calls = currentChain.eq.mock.calls.filter((c: any[]) => c[0] === 'billing_source');
      expect(calls).toHaveLength(times);
      calls.forEach((c: any[]) => expect(c[1]).toBe('stripe'));
    }

    it('customer.subscription.updated filtre billing_source = stripe (box + owner)', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: { customer: 'cus_manual', status: 'canceled', trial_end: null } },
      });
      await POST(makeReq() as any);
      expect(currentChain.update).toHaveBeenCalledTimes(2);
      expectStripeOnlyFilter(2);
    });

    it('customer.subscription.deleted filtre billing_source = stripe', async () => {
      mockConstructEvent.mockReturnValue({ type: 'customer.subscription.deleted', data: { object: { customer: 'cus_manual' } } });
      await POST(makeReq() as any);
      expectStripeOnlyFilter(2);
    });

    it('invoice.payment_failed filtre billing_source = stripe', async () => {
      mockConstructEvent.mockReturnValue({ type: 'invoice.payment_failed', data: { object: { customer: 'cus_manual' } } });
      await POST(makeReq() as any);
      expectStripeOnlyFilter(2);
    });

    it('checkout.session.completed pose billing_source = stripe (box et owner)', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { metadata: { box_id: 'box-1' }, customer: 'cus_1', subscription: 'sub_1' } },
      });
      mockRetrieve.mockResolvedValue({ status: 'active', current_period_end: 1800000000, trial_end: null });
      await POST(makeReq() as any);
      expect(currentChain.update).toHaveBeenCalledWith(expect.objectContaining({ billing_source: 'stripe' }));

      jest.clearAllMocks();
      mockConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { metadata: { owner_subscription: '1', supabase_owner_id: 'own-1', box_quota: '3' }, customer: 'cus_o', subscription: 'sub_o' } },
      });
      mockRetrieve.mockResolvedValue({ status: 'active', current_period_end: 1800000000, trial_end: null });
      await POST(makeReq() as any);
      expect(currentChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ owner_id: 'own-1', billing_source: 'stripe', status: 'active' }),
        { onConflict: 'owner_id' },
      );
    });
  });

  describe('cycle de vie : past_due / unpaid / incomplete / invoice.paid', () => {
    it('past_due est écrit tel quel, accès conservé côté layout', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: { customer: 'cus_1', status: 'past_due', trial_end: null, items: { data: [{ current_period_end: 1789240593 }] } } },
      });
      await POST(makeReq() as any);
      expect(currentChain.update).toHaveBeenCalledWith({ status: 'past_due', current_period_end: '2026-09-12T19:16:33.000Z', trial_ends_at: null });
    });

    it('unpaid → canceled (réglage Stripe « cancel après retries »)', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: { customer: 'cus_1', status: 'unpaid', trial_end: null } },
      });
      await POST(makeReq() as any);
      expect(currentChain.update).toHaveBeenCalledWith({ status: 'canceled', trial_ends_at: null });
    });

    it.each(['incomplete', 'incomplete_expired', 'paused'])('%s : aucune écriture', async (status) => {
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: { customer: 'cus_1', status, trial_end: null } },
      });
      const res = (await POST(makeReq() as any)) as any;
      expect(res._status).toBe(200);
      expect(currentChain.update).not.toHaveBeenCalled();
    });

    it('invoice.paid : seule une ligne past_due repasse active (box + owner, stripe uniquement)', async () => {
      mockConstructEvent.mockReturnValue({ type: 'invoice.paid', data: { object: { customer: 'cus_1' } } });
      await POST(makeReq() as any);
      expect(currentChain.update).toHaveBeenCalledTimes(2);
      expect(currentChain.update).toHaveBeenCalledWith({ status: 'active' });
      expect(currentChain.eq).toHaveBeenCalledWith('status', 'past_due');
      expect(currentChain.eq.mock.calls.filter((c: any[]) => c[0] === 'billing_source' && c[1] === 'stripe')).toHaveLength(2);
    });
  });
});
