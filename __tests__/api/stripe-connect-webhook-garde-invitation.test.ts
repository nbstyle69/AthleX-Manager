// Comptoir P1, PR 5b (B1) — webhook Connect : une page d'invitation payée
// après une révocation ou un encaissement au comptoir n'active rien. La base
// tranche (box_invitation_activation_permise, migration 20270158) ; refus :
// abonnement annulé tout de suite sur le compte de la box, arrêt journalisé,
// aucune écriture sur l'adhésion. Faux Stripe et fausse base.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockConstructEvent = jest.fn();
const mockSubsRetrieve = jest.fn();
const mockSubsCancel = jest.fn();
const mockSubsList = jest.fn();
const mockSubsCreate = jest.fn();
const mockSetupRetrieve = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubsRetrieve, cancel: mockSubsCancel, list: mockSubsList, create: mockSubsCreate },
    setupIntents: { retrieve: mockSetupRetrieve },
    customers: { update: jest.fn().mockResolvedValue({}) },
    invoiceItems: { list: jest.fn().mockResolvedValue({ data: [] }), create: jest.fn() },
    paymentMethods: { attach: jest.fn().mockResolvedValue({}) },
  })),
}));

function makeChain(cfg: { awaited?: any; maybeSingle?: any } = {}) {
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'ilike', 'in', 'order'].forEach(
    (m) => (c[m] = jest.fn(ret)),
  );
  c.then = (resolve: Function) => Promise.resolve(cfg.awaited ?? { data: null, error: null }).then(resolve as any);
  c.maybeSingle = jest.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null, error: null });
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((table: string) => (chains[table] ??= makeChain()));
const mockRpc = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: fromSpy, rpc: mockRpc })),
}));

import { POST } from '../../app/api/stripe-connect-webhook/route';

const req = (): any => ({
  headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig' : null) },
  text: jest.fn().mockResolvedValue('{}'),
});

const paidEvent = () => ({
  type: 'checkout.session.completed',
  account: 'acct_box',
  data: { object: {
    id: 'cs_1', customer_details: { email: 'a@b.com' }, subscription: 'sub_1',
    metadata: { kind: 'membership', plan_id: 'plan-1', box_id: 'box-1', user_id: 'user-1', invitation_id: 'inv-1' },
  } },
});

const s = (iso: string) => Date.parse(iso) / 1000;
const deferredEvent = () => ({
  type: 'checkout.session.completed',
  account: 'acct_box',
  data: { object: {
    id: 'cs_setup_1', mode: 'setup', customer: 'cus_1', setup_intent: 'seti_1',
    customer_details: { email: 'a@b.com' },
    metadata: {
      kind: 'membership_deferred', plan_id: 'plan-1', box_id: 'box-1', price_id: 'price_1',
      user_id: 'user-1', invitation_id: 'inv-1', billing_day: '5', due_date: '2026-11-15',
      trial_end: String(s('2026-11-15T04:00:00Z')), merged_prorata_cents: '0', currency: 'eur',
      amount_cents: '6000', platform_fee_cents: '0', commitment_months: '0',
    },
  } },
});

function verdict(permise: boolean, raison: string) {
  mockRpc.mockImplementation(async (fn: string) => (fn === 'box_invitation_activation_permise'
    ? { data: { permise, raison }, error: null }
    : { data: { ok: true }, error: null }));
}

/** Adhésion lue (null = aucune) et lignes rendues par l'écriture conditionnelle. */
function membership(existing: string | null, written: { id: string }[] = existing ? [{ id: existing }] : []) {
  chains.box_members = makeChain({
    maybeSingle: { data: existing ? { id: existing } : null, error: null },
    awaited: { data: written, error: null },
  });
}

const journalRows = () => (chains.box_member_subscription_actions?.insert.mock.calls ?? []).map((c: any[]) => c[0]);
const accepted = () => mockRpc.mock.calls.some(([fn]) => fn === 'accept_box_invitation_after_payment');

let stripeStatus: Record<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  chains = {
    profiles: makeChain({ maybeSingle: { data: { id: 'user-1' }, error: null } }),
    boxes: makeChain({ maybeSingle: { data: { owner_id: 'owner-1' }, error: null } }),
    box_member_subscription_actions: makeChain({ awaited: { error: null } }),
  };
  stripeStatus = { sub_1: 'active' };
  mockSubsRetrieve.mockImplementation(async (id: string) => ({
    id, status: stripeStatus[id] ?? 'active', default_payment_method: { type: 'card' }, items: { data: [] },
  }));
  mockSubsCancel.mockImplementation(async (id: string) => { stripeStatus[id] = 'canceled'; return { id, status: 'canceled' }; });
  mockSubsList.mockResolvedValue({ data: [] });
  mockSubsCreate.mockImplementation(async (p: any) => ({ id: 'sub_new', status: 'trialing', metadata: p.metadata, items: { data: [] } }));
  mockSetupRetrieve.mockResolvedValue({ payment_method: { id: 'pm_1', type: 'card', customer: 'cus_1' } });
});

describe('activation permise', () => {
  it('PENDING_PAYMENT : la garde est appelée avec l’invitation et le membre, écriture conditionnée à pending_payment', async () => {
    verdict(true, 'PENDING_PAYMENT');
    membership('bm-1');
    mockConstructEvent.mockReturnValue(paidEvent());
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('box_invitation_activation_permise', { p_invitation_id: 'inv-1', p_user_id: 'user-1' });
    expect(chains.box_members.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', stripe_subscription_id: 'sub_1' }));
    expect(chains.box_members.eq).toHaveBeenCalledWith('id', 'bm-1');
    expect(chains.box_members.eq).toHaveBeenCalledWith('subscription_status', 'pending_payment');
    expect(accepted()).toBe(true);
    expect(mockSubsCancel).not.toHaveBeenCalled();
    expect(journalRows()).toEqual([]);
  });

  it('la garde passe avant toute écriture', async () => {
    verdict(true, 'PENDING_PAYMENT');
    membership('bm-1');
    mockConstructEvent.mockReturnValue(paidEvent());
    await POST(req());
    const garde = mockRpc.mock.invocationCallOrder[0];
    expect(mockRpc.mock.calls[0][0]).toBe('box_invitation_activation_permise');
    expect(garde).toBeLessThan(chains.box_members.update.mock.invocationCallOrder[0]);
  });

  it('NO_MEMBERSHIP_YET : création de l’adhésion', async () => {
    verdict(true, 'NO_MEMBERSHIP_YET');
    membership(null);
    mockConstructEvent.mockReturnValue(paidEvent());
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    expect(chains.box_members.insert).toHaveBeenCalledWith(expect.objectContaining({ box_id: 'box-1', member_id: 'user-1', status: 'active' }));
    expect(chains.box_members.update).not.toHaveBeenCalled();
    expect(mockSubsCancel).not.toHaveBeenCalled();
    expect(accepted()).toBe(true);
  });

  it('sans invitation : aucune garde, comportement inchangé', async () => {
    membership('bm-1');
    const ev = paidEvent();
    delete (ev.data.object.metadata as Record<string, string>).invitation_id;
    mockConstructEvent.mockReturnValue(ev);
    await POST(req());
    expect(mockRpc).not.toHaveBeenCalledWith('box_invitation_activation_permise', expect.anything());
    expect(chains.box_members.eq).not.toHaveBeenCalledWith('subscription_status', 'pending_payment');
    expect(chains.box_members.update).toHaveBeenCalled();
  });
});

describe('activation refusée', () => {
  function expectRefused() {
    expect(chains.box_members.update).not.toHaveBeenCalled();
    expect(chains.box_members.insert).not.toHaveBeenCalled();
    expect(accepted()).toBe(false);
    expect(mockSubsCancel).toHaveBeenCalledTimes(1);
    expect(mockSubsCancel).toHaveBeenCalledWith(
      'sub_1',
      { prorate: false, invoice_now: false },
      { stripeAccount: 'acct_box', idempotencyKey: 'invitation-refusee-annulation-sub_1' },
    );
    expect(journalRows()).toEqual([{
      box_id: 'box-1', box_member_id: 'bm-1', member_id: 'user-1', action: 'stop', mode: 'now',
      refund_cents: 0, stripe_subscription_id: 'sub_1', actor_id: 'owner-1',
    }]);
  }

  it('invitation révoquée : abonnement annulé, arrêt journalisé, adhésion intacte', async () => {
    verdict(false, 'REVOKED');
    membership('bm-1');
    mockConstructEvent.mockReturnValue(paidEvent());
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    expectRefused();
  });

  it('adhésion déjà active (au comptoir) : même refus', async () => {
    verdict(false, 'NOT_PENDING');
    membership('bm-1');
    mockConstructEvent.mockReturnValue(paidEvent());
    expect(((await POST(req())) as any)._status).toBe(200);
    expectRefused();
  });

  it('écriture conditionnelle sans ligne touchée (état changé entre-temps) : refus', async () => {
    verdict(true, 'PENDING_PAYMENT');
    membership('bm-1', []);
    mockConstructEvent.mockReturnValue(paidEvent());
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(chains.box_members.update).toHaveBeenCalledTimes(1);
    expect(accepted()).toBe(false);
    expect(mockSubsCancel).toHaveBeenCalledTimes(1);
    expect(journalRows()).toHaveLength(1);
  });

  it('NO_MEMBERSHIP_YET mais une adhésion apparaît (insertion en conflit) : refus', async () => {
    verdict(true, 'NO_MEMBERSHIP_YET');
    chains.box_members = makeChain({
      maybeSingle: { data: null, error: null },
      awaited: { data: null, error: { code: '23505', message: 'duplicate' } },
    });
    mockConstructEvent.mockReturnValue(paidEvent());
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(accepted()).toBe(false);
    expect(mockSubsCancel).toHaveBeenCalledTimes(1);
  });

  it('événement reçu deux fois : une seule annulation, une seule ligne de journal', async () => {
    verdict(false, 'REVOKED');
    membership('bm-1');
    mockConstructEvent.mockReturnValue(paidEvent());
    expect(((await POST(req())) as any)._status).toBe(200);
    // Rejeu : l'abonnement est annulé chez Stripe, l'index unique refuse la 2e ligne.
    chains.box_member_subscription_actions = makeChain({ awaited: { error: { code: '23505', message: 'duplicate' } } });
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(mockSubsCancel).toHaveBeenCalledTimes(1);
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledTimes(1);
    expect(fromSpy).not.toHaveBeenCalledWith('box_manager_notifications');
  });

  it('annulation Stripe en échec : 500 (Stripe rejoue), rien écrit', async () => {
    verdict(false, 'REVOKED');
    membership('bm-1');
    mockSubsCancel.mockRejectedValue(Object.assign(new Error('boom'), { type: 'StripeAPIError' }));
    mockConstructEvent.mockReturnValue(paidEvent());
    expect(((await POST(req())) as any)._status).toBe(500);
    expect(journalRows()).toEqual([]);
    expect(chains.box_members.update).not.toHaveBeenCalled();
  });

  it('échéance future refusée : aucun abonnement créé, celui d’un passage précédent annulé', async () => {
    verdict(false, 'REVOKED');
    membership('bm-1');
    mockSubsList.mockResolvedValue({ data: [{ id: 'sub_1', metadata: { checkout_session_id: 'cs_setup_1' } }] });
    mockConstructEvent.mockReturnValue(deferredEvent());
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(mockSubsCreate).not.toHaveBeenCalled();
    expect(mockSetupRetrieve).not.toHaveBeenCalled();
    expectRefused();
  });

  it('échéance future permise : abonnement créé puis écriture conditionnelle', async () => {
    verdict(true, 'PENDING_PAYMENT');
    membership('bm-1');
    mockConstructEvent.mockReturnValue(deferredEvent());
    expect(((await POST(req())) as any)._status).toBe(200);
    expect(mockSubsCreate).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls.filter(([fn]) => fn === 'box_invitation_activation_permise')).toHaveLength(1);
    expect(chains.box_members.eq).toHaveBeenCalledWith('subscription_status', 'pending_payment');
    expect(mockSubsCancel).not.toHaveBeenCalled();
  });
});
