// Tests for app/api/stripe-connect-webhook/route.ts (Stripe Connect webhook:
// memberships, one-off credit packs, program purchases, refunds).

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockConstructEvent = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}));

interface ChainCfg {
  awaited?: any;
  maybeSingle?: any;
  single?: any;
}

function makeChain(cfg: ChainCfg = {}) {
  const awaited = cfg.awaited ?? { data: null, error: null };
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'ilike', 'in', 'order'].forEach(
    (m) => (c[m] = jest.fn(ret)),
  );
  c.then = (resolve: Function) => Promise.resolve(awaited).then(resolve as any);
  c.catch = (reject: Function) => Promise.resolve(awaited).catch(reject as any);
  c.maybeSingle = jest.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null });
  c.single = jest.fn().mockResolvedValue(cfg.single ?? awaited);
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((table: string) => (chains[table] ??= makeChain()));

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: fromSpy })),
}));

import { POST } from '../../app/api/stripe-connect-webhook/route';

function makeReq(opts: { signature?: string | null } = {}): any {
  const signature = opts.signature === undefined ? 'sig_dummy' : opts.signature;
  return {
    headers: { get: (k: string) => (k === 'stripe-signature' ? signature : null) },
    text: jest.fn().mockResolvedValue('{}'),
  };
}

const profileFound = () => makeChain({ maybeSingle: { data: { id: 'user-1' } } });

beforeEach(() => {
  jest.clearAllMocks();
  chains = {};
});

describe('POST /api/stripe-connect-webhook', () => {
  it('returns 400 when the stripe-signature header is missing', async () => {
    const res = (await POST(makeReq({ signature: null }) as any)) as any;
    expect(res._status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it('updates the existing box_members row on a membership checkout', async () => {
    chains.profiles = profileFound();
    chains.box_members = makeChain({ maybeSingle: { data: { id: 'bm-1' } }, awaited: { error: null } });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', subscription: 'sub_1', metadata: { kind: 'membership', plan_id: 'plan-1', box_id: 'box-1', buyer_email: 'a@b.com' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.box_members.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: 'plan-1', subscription_status: 'active', status: 'active' }),
    );
    expect(chains.box_members.eq).toHaveBeenCalledWith('id', 'bm-1');
  });

  it('inserts a new box_members row when none exists', async () => {
    chains.profiles = profileFound();
    chains.box_members = makeChain({ maybeSingle: { data: null }, awaited: { error: null } });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', subscription: 'sub_1', metadata: { kind: 'membership', plan_id: 'plan-1', box_id: 'box-1', buyer_email: 'a@b.com' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.box_members.insert).toHaveBeenCalledWith(
      expect.objectContaining({ box_id: 'box-1', member_id: 'user-1', role: 'member', plan_id: 'plan-1' }),
    );
  });

  it('skips the membership write when no profile matches the buyer email', async () => {
    chains.profiles = makeChain({ maybeSingle: { data: null } });
    chains.box_members = makeChain();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', metadata: { kind: 'membership', plan_id: 'plan-1', box_id: 'box-1', buyer_email: 'ghost@b.com' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.box_members.insert).not.toHaveBeenCalled();
    expect(chains.box_members.update).not.toHaveBeenCalled();
  });

  it('activates a credit pack on a credit checkout', async () => {
    chains.profiles = profileFound();
    chains.member_class_credits = makeChain({ awaited: { error: null } });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_intent: 'pi_1', metadata: { kind: 'credit', box_id: 'box-1', buyer_email: 'a@b.com', credits: '10', validity_days: '90' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.member_class_credits.insert).toHaveBeenCalledWith(
      expect.objectContaining({ box_id: 'box-1', member_id: 'user-1', credits_total: 10, status: 'active' }),
    );
  });

  it('treats a duplicate credit insert (unique violation 23505) as success', async () => {
    chains.profiles = profileFound();
    chains.member_class_credits = makeChain({ awaited: { error: { code: '23505', message: 'dup' } } });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_intent: 'pi_1', metadata: { kind: 'credit', box_id: 'box-1', buyer_email: 'a@b.com', credits: '10', validity_days: '90' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
  });

  it('upserts program_members on a program checkout', async () => {
    chains.profiles = profileFound();
    chains.program_members = makeChain({ awaited: { error: null } });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_intent: 'pi_1', metadata: { kind: 'program', program_id: 'prog-1', buyer_email: 'a@b.com' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.program_members.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ program_id: 'prog-1', user_id: 'user-1', status: 'active' }),
      { onConflict: 'program_id,user_id' },
    );
  });

  it('sets the renewal date on customer.subscription.created', async () => {
    chains.program_members = makeChain({ awaited: { error: null } });
    chains.box_members = makeChain({ awaited: { error: null } });
    const periodEndEpoch = 1785000000; // seconds
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_1', status: 'active', current_period_end: periodEndEpoch, items: { data: [{}] }, metadata: {} } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.box_members.update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'active',
        subscription_current_period_end: new Date(periodEndEpoch * 1000).toISOString(),
      }),
    );
    expect(chains.box_members.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1');
  });

  it('revokes program access and credits on charge.refunded', async () => {
    chains.program_members = makeChain({ awaited: { error: null } });
    chains.member_class_credits = makeChain({ awaited: { error: null } });
    mockConstructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_9' } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(200);
    expect(chains.program_members.update).toHaveBeenCalledWith({ status: 'refunded' });
    expect(chains.program_members.eq).toHaveBeenCalledWith('stripe_payment_intent', 'pi_9');
    expect(chains.member_class_credits.update).toHaveBeenCalledWith({ status: 'refunded' });
    expect(chains.member_class_credits.eq).toHaveBeenCalledWith('stripe_payment_intent', 'pi_9');
  });

  it('returns 500 when the membership write fails', async () => {
    chains.profiles = profileFound();
    chains.box_members = makeChain({ maybeSingle: { data: { id: 'bm-1' } }, awaited: { error: { message: 'boom' } } });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', subscription: 'sub_1', metadata: { kind: 'membership', plan_id: 'plan-1', box_id: 'box-1', buyer_email: 'a@b.com' } } },
    });

    const res = (await POST(makeReq() as any)) as any;

    expect(res._status).toBe(500);
    expect(res._data.error).toBe('boom');
  });
});
