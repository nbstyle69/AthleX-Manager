// B3 — webhook Connect, customer.subscription.created / updated : Stripe
// n'envoie pas les événements dans l'ordre. « incomplete » (état de passage)
// n'écrit rien ; sinon l'état écrit est celui relu chez Stripe sur le compte
// connecté, pas celui de l'événement ; relecture en échec : rien écrit, 500.

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

function makeChain() {
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'ilike', 'in', 'order'].forEach(
    (m) => (c[m] = jest.fn(ret)),
  );
  c.then = (resolve: Function) => Promise.resolve({ data: [], error: null }).then(resolve as any);
  c.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((table: string) => (chains[table] ??= makeChain()));

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: fromSpy, rpc: jest.fn() })),
}));

import { POST } from '../../app/api/stripe-connect-webhook/route';

const req = (): any => ({
  headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig' : null) },
  text: jest.fn().mockResolvedValue('{}'),
});

const PERIOD_END = 1_800_000_000;
const sub = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'sub_1', status, metadata: {}, cancel_at_period_end: false, cancel_at: null,
  items: { data: [{ current_period_end: PERIOD_END }] }, ...extra,
});
const event = (type: string, status: string, account: string | null = 'acct_box') => ({
  type, ...(account ? { account } : {}), data: { object: sub(status) },
});

/** Ce que le webhook a écrit sur box_members (patchs d'update). */
const memberPatches = () => (chains.box_members?.update.mock.calls ?? []).map((c: any[]) => c[0]);
const anyWrite = () => ['box_members', 'program_members', 'box_programming_subscriptions']
  .some((t) => chains[t]?.update.mock.calls.length > 0);

beforeEach(() => {
  jest.clearAllMocks();
  mockRetrieve.mockReset();
  chains = {};
});

describe('« incomplete » : aucune écriture', () => {
  it.each(['customer.subscription.created', 'customer.subscription.updated'])('%s incomplete : ni relecture ni écriture, 200', async (type) => {
    mockConstructEvent.mockReturnValue(event(type, 'incomplete'));
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(anyWrite()).toBe(false);
  });

  // Le cas vu sur le banc B1 : `created` (incomplete) traité après l'activation.
  it('événement « incomplete » arrivé après l’activation : l’adhésion active n’est pas touchée', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.created', 'incomplete'));
    await POST(req());
    expect(memberPatches()).toEqual([]);
  });

  it('relu « incomplete » (événement d’un autre statut) : aucune écriture', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active'));
    mockRetrieve.mockResolvedValue(sub('incomplete'));
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(anyWrite()).toBe(false);
  });
});

describe('état relu chez Stripe, pas celui de l’événement', () => {
  it('relit l’abonnement de l’événement sur le compte connecté de la box', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active'));
    mockRetrieve.mockResolvedValue(sub('active'));
    await POST(req());
    expect(mockRetrieve).toHaveBeenCalledWith('sub_1', {}, { stripeAccount: 'acct_box' });
  });

  it('événement périmé (past_due) mais abonnement relu actif : active écrit', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'past_due'));
    mockRetrieve.mockResolvedValue(sub('active'));
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(memberPatches()[0]).toEqual(expect.objectContaining({ subscription_status: 'active', past_due_since: null }));
    expect(chains.box_members.update).not.toHaveBeenCalledWith({ past_due_since: expect.anything() });
  });

  it('événement périmé (active) mais abonnement relu annulé : cancelled écrit', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active'));
    mockRetrieve.mockResolvedValue(sub('canceled'));
    await POST(req());
    expect(memberPatches()[0]).toEqual(expect.objectContaining({ subscription_status: 'cancelled' }));
  });

  it('la fin de période écrite est celle relue', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.created', 'active'));
    mockRetrieve.mockResolvedValue(sub('active', { items: { data: [{ current_period_end: PERIOD_END + 86400 }] } }));
    await POST(req());
    expect(memberPatches()[0].subscription_current_period_end).toBe(new Date((PERIOD_END + 86400) * 1000).toISOString());
  });

  it('traduction inchangée : incomplete_expired → cancelled, trialing → active, unpaid → past_due', async () => {
    for (const [relu, attendu] of [['incomplete_expired', 'cancelled'], ['trialing', 'active'], ['unpaid', 'past_due']]) {
      chains = {};
      mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active'));
      mockRetrieve.mockResolvedValue(sub(relu));
      await POST(req());
      expect(memberPatches()[0].subscription_status).toBe(attendu);
    }
  });

  it('cas normal inchangé : actif relu actif → active, sans écriture d’impayé', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.created', 'active'));
    mockRetrieve.mockResolvedValue(sub('active'));
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(memberPatches()[0]).toEqual(expect.objectContaining({ subscription_status: 'active' }));
  });

  it('relu past_due : past_due écrit et impayé ancré', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active'));
    mockRetrieve.mockResolvedValue(sub('past_due'));
    await POST(req());
    expect(memberPatches()[0].subscription_status).toBe('past_due');
    expect(memberPatches()).toContainEqual({ past_due_since: expect.any(String) });
  });
});

describe('relecture impossible', () => {
  it('relecture en échec : aucune écriture, 500 (Stripe rejoue)', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active'));
    mockRetrieve.mockRejectedValue(Object.assign(new Error('boom'), { type: 'StripeAPIError' }));
    expect(((await POST(req())) as any)._status).toBe(500);
    expect(anyWrite()).toBe(false);
  });

  it('événement sans compte connecté : aucune écriture, 500', async () => {
    mockConstructEvent.mockReturnValue(event('customer.subscription.updated', 'active', null));
    expect(((await POST(req())) as any)._status).toBe(500);
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(anyWrite()).toBe(false);
  });
});
