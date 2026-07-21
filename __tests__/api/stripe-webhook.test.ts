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
});
