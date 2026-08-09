// Tests for app/api/create-membership-checkout/route.ts
// (moyens de paiement : SEPA sur l'abonnement, carte seule sur Drop-in/Carnet)

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockSessionsCreate = jest.fn().mockResolvedValue({ url: 'https://checkout.test/s' });
const mockPricesCreate = jest.fn().mockResolvedValue({ id: 'price_new' });
const mockProductsCreate = jest.fn().mockResolvedValue({ id: 'prod_new' });

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionsCreate } },
    prices: { create: mockPricesCreate },
    products: { create: mockProductsCreate },
  })),
}));

interface ChainCfg { single?: any; awaited?: any }

function makeChain(cfg: ChainCfg = {}) {
  const awaited = cfg.awaited ?? { data: null, error: null };
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'eq'].forEach((m) => (c[m] = jest.fn(ret)));
  c.then = (resolve: Function) => Promise.resolve(awaited).then(resolve as any);
  c.single = jest.fn().mockResolvedValue(cfg.single ?? awaited);
  c.maybeSingle = jest.fn().mockResolvedValue(cfg.single ?? awaited);
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((table: string) => (chains[table] ??= makeChain()));

const mockGetServerUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: fromSpy })),
  getServerUser: (...args: unknown[]) => mockGetServerUser(...args),
}));

import { POST } from '../../app/api/create-membership-checkout/route';

const BOX = {
  id: 'box-1', name: 'CrossFit Test', slug: 'cf-test',
  stripe_account_id: 'acct_1', stripe_onboarding_complete: true,
};

function plan(overrides: Record<string, any> = {}) {
  return {
    id: 'plan-1', box_id: 'box-1', name: 'Illimité', description: null,
    price_cents: 8900, currency: 'eur', is_active: true,
    stripe_product_id: 'prod_1', stripe_price_id: 'price_1',
    plan_type: 'subscription', credits: null, validity_days: null,
    commitment_months: null,
    ...overrides,
  };
}

function makeReq(body: any): any {
  return { json: jest.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  jest.clearAllMocks();
  chains = {};
  mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.test/s' });
  mockGetServerUser.mockResolvedValue(null);
});

describe('POST /api/create-membership-checkout', () => {
  it('returns 400 without plan_id', async () => {
    const res = (await POST(makeReq({}) as any)) as any;
    expect(res._status).toBe(400);
  });

  // Lot 7A-bis : le tunnel reste public, mais l'e-mail du body n'attribue rien.
  it('lets Stripe collect the email for an anonymous buyer (body email not trusted)', async () => {
    chains.membership_plans = makeChain({ single: { data: plan(), error: null } });
    chains.boxes = makeChain({ single: { data: BOX, error: null } });

    const res = (await POST(makeReq({ plan_id: 'plan-1', buyer_email: 'victim@b.com' }) as any)) as any;

    expect(res._status).toBe(200);
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.customer_email).toBeUndefined();
    expect(params.metadata.user_id).toBeUndefined();
    expect(params.metadata.submitted_email).toBe('victim@b.com');
  });

  it('forces the session identity when the buyer is signed in', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'user-7', email: 'owner@b.com' });
    chains.membership_plans = makeChain({ single: { data: plan(), error: null } });
    chains.boxes = makeChain({ single: { data: BOX, error: null } });

    const res = (await POST(makeReq({ plan_id: 'plan-1', buyer_email: 'victim@b.com' }) as any)) as any;

    expect(res._status).toBe(200);
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.customer_email).toBe('owner@b.com');
    expect(params.metadata.user_id).toBe('user-7');
    expect(params.subscription_data.metadata.user_id).toBe('user-7');
  });

  it('offers card + SEPA debit on a euro subscription', async () => {
    chains.membership_plans = makeChain({ single: { data: plan(), error: null } });
    chains.boxes = makeChain({ single: { data: BOX, error: null } });

    const res = (await POST(makeReq({ plan_id: 'plan-1', buyer_email: 'a@b.com' }) as any)) as any;

    expect(res._status).toBe(200);
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription', payment_method_types: ['card', 'sepa_debit'] }),
      { stripeAccount: 'acct_1' },
    );
  });

  it('keeps card only when the plan is not priced in euros', async () => {
    chains.membership_plans = makeChain({ single: { data: plan({ currency: 'chf' }), error: null } });
    chains.boxes = makeChain({ single: { data: BOX, error: null } });

    await POST(makeReq({ plan_id: 'plan-1', buyer_email: 'a@b.com' }) as any);

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method_types: ['card'] }),
      { stripeAccount: 'acct_1' },
    );
  });

  it('keeps card only on a one-off Drop-in (SEPA settles too slowly)', async () => {
    chains.membership_plans = makeChain({
      single: { data: plan({ plan_type: 'drop_in', credits: 1, validity_days: 14 }), error: null },
    });
    chains.boxes = makeChain({ single: { data: BOX, error: null } });

    await POST(makeReq({ plan_id: 'plan-1', buyer_email: 'a@b.com' }) as any);

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment', payment_method_types: ['card'] }),
      { stripeAccount: 'acct_1' },
    );
  });

  it('returns 409 when the box has no Stripe account', async () => {
    chains.membership_plans = makeChain({ single: { data: plan(), error: null } });
    chains.boxes = makeChain({ single: { data: { ...BOX, stripe_account_id: null }, error: null } });

    const res = (await POST(makeReq({ plan_id: 'plan-1', buyer_email: 'a@b.com' }) as any)) as any;

    expect(res._status).toBe(409);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});
