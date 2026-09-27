// Lot 3 — webhook Connect : jour de prélèvement enregistré, abonnement créé
// pour une échéance future (idempotent), `trialing` vaut membre actif.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockConstructEvent = jest.fn();
const mockSubsRetrieve = jest.fn();
const mockSubsList = jest.fn();
const mockSubsCreate = jest.fn();
const mockSetupRetrieve = jest.fn();
const mockCustomersUpdate = jest.fn();
const mockItemsList = jest.fn();
const mockItemsCreate = jest.fn();
const mockPmAttach = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubsRetrieve, list: mockSubsList, create: mockSubsCreate },
    setupIntents: { retrieve: mockSetupRetrieve },
    customers: { update: mockCustomersUpdate },
    invoiceItems: { list: mockItemsList, create: mockItemsCreate },
    paymentMethods: { attach: mockPmAttach },
  })),
}));

function makeChain(cfg: { awaited?: any; maybeSingle?: any } = {}) {
  const awaited = cfg.awaited ?? { data: null, error: null };
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'ilike', 'in', 'order'].forEach(
    (m) => (c[m] = jest.fn(ret)),
  );
  c.then = (resolve: Function) => Promise.resolve(awaited).then(resolve as any);
  c.maybeSingle = jest.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null });
  c.single = jest.fn().mockResolvedValue(awaited);
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

const s = (iso: string) => Date.parse(iso) / 1000;

function membershipEvent(metadata: Record<string, string>) {
  return {
    type: 'checkout.session.completed',
    account: 'acct_1',
    data: { object: { id: 'cs_1', customer_details: { email: 'a@b.com' }, subscription: 'sub_1', metadata: { kind: 'membership', plan_id: 'plan-1', box_id: 'box-1', ...metadata } } },
  };
}

function deferredEvent(extra: Record<string, string> = {}) {
  return {
    type: 'checkout.session.completed',
    account: 'acct_1',
    data: {
      object: {
        id: 'cs_setup_1', mode: 'setup', customer: 'cus_1', setup_intent: 'seti_1',
        customer_details: { email: 'invite@b.com' },
        metadata: {
          kind: 'membership_deferred', plan_id: 'plan-1', box_id: 'box-1', price_id: 'price_1',
          user_id: 'user-1', invitation_id: 'inv-1', billing_day: '5', due_date: '2026-10-15',
          trial_end: String(s('2026-10-15T04:00:00Z')), billing_cycle_anchor: String(s('2026-11-05T05:00:00Z')),
          merged_prorata_cents: '0', currency: 'eur', amount_cents: '6000', platform_fee_cents: '0',
          commitment_months: '12',
          ...extra,
        },
      },
    },
  };
}

// Stripe simulé avec mémoire : ce qui a été créé se retrouve à la lecture suivante.
let createdSubs: any[];
let createdItems: any[];

beforeEach(() => {
  jest.clearAllMocks();
  chains = {
    profiles: makeChain({ maybeSingle: { data: { id: 'user-1' } } }),
    box_members: makeChain({ maybeSingle: { data: { id: 'bm-1' } }, awaited: { error: null } }),
  };
  mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
  createdSubs = [];
  createdItems = [];
  mockSubsRetrieve.mockResolvedValue({ default_payment_method: { type: 'card' }, items: { data: [{ current_period_end: s('2026-10-05T04:00:00Z') }] } });
  mockSetupRetrieve.mockResolvedValue({ payment_method: { id: 'pm_1', type: 'sepa_debit' } });
  mockCustomersUpdate.mockResolvedValue({});
  mockPmAttach.mockResolvedValue({});
  mockSubsList.mockImplementation(async () => ({ data: [...createdSubs] }));
  mockSubsCreate.mockImplementation(async (params: any) => {
    const sub = { id: `sub_${createdSubs.length + 1}`, status: 'trialing', metadata: params.metadata, items: { data: [{ current_period_end: params.trial_end }] } };
    createdSubs.push(sub);
    return sub;
  });
  mockItemsList.mockImplementation(async () => ({ data: [...createdItems] }));
  mockItemsCreate.mockImplementation(async (params: any) => { createdItems.push(params); return { id: 'ii_1' }; });
});

describe('abonnement payé aujourd’hui : billing_day', () => {
  it('écrit billing_day sur box_members quand le compte existe', async () => {
    mockConstructEvent.mockReturnValue(membershipEvent({ billing_day: '7' }));
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    expect(chains.box_members.update).toHaveBeenCalledWith(expect.objectContaining({ billing_day: 7, status: 'active' }));
  });

  it('paiement avant le compte : billing_day dans la colonne de pending_entitlements, jamais dans payload', async () => {
    chains.profiles = makeChain({ maybeSingle: { data: null } });
    chains.pending_entitlements = makeChain({ awaited: { error: null } });
    mockConstructEvent.mockReturnValue(membershipEvent({ billing_day: '7' }));
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    const [row] = chains.pending_entitlements.insert.mock.calls[0];
    expect(row.billing_day).toBe(7);
    expect(row.payload).not.toHaveProperty('billing_day');
    expect(chains.box_members.update).not.toHaveBeenCalled();
  });

  it('ignore un jour hors de 1 à 10 (ancien checkout sans jour)', async () => {
    mockConstructEvent.mockReturnValue(membershipEvent({}));
    await POST(req());
    expect(chains.box_members.update.mock.calls[0][0]).not.toHaveProperty('billing_day');
  });
});

describe('échéance future : abonnement créé par le webhook', () => {
  it('crée l’abonnement en essai jusqu’à l’échéance, ancré au jour choisi, moyen de paiement par défaut', async () => {
    mockConstructEvent.mockReturnValue(deferredEvent());
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);

    expect(mockSetupRetrieve).toHaveBeenCalledWith('seti_1', { expand: ['payment_method'] }, { stripeAccount: 'acct_1' });
    expect(mockCustomersUpdate).toHaveBeenCalledWith('cus_1', { invoice_settings: { default_payment_method: 'pm_1' } }, { stripeAccount: 'acct_1' });
    expect(mockSubsCreate).toHaveBeenCalledTimes(1);
    const [params, opts] = mockSubsCreate.mock.calls[0];
    expect(params).toEqual(expect.objectContaining({
      customer: 'cus_1',
      items: [{ price: 'price_1' }],
      default_payment_method: 'pm_1',
      trial_end: s('2026-10-15T04:00:00Z'),
      billing_cycle_anchor: s('2026-11-05T05:00:00Z'),
      proration_behavior: 'create_prorations',
    }));
    expect(params.metadata).toEqual(expect.objectContaining({ checkout_session_id: 'cs_setup_1', plan_id: 'plan-1', box_id: 'box-1' }));
    expect(opts).toEqual({ stripeAccount: 'acct_1', idempotencyKey: 'membership-deferred-sub-cs_setup_1' });
    expect(mockItemsCreate).not.toHaveBeenCalled();
    // Moyen de paiement pas encore associé au client créé par Checkout : on l'associe.
    expect(mockPmAttach).toHaveBeenCalledWith('pm_1', { customer: 'cus_1' }, { stripeAccount: 'acct_1' });

    const patch = chains.box_members.update.mock.calls[0][0];
    expect(patch).toEqual(expect.objectContaining({
      status: 'active', subscription_status: 'active', billing_day: 5,
      stripe_subscription_id: 'sub_1', payment_method_type: 'sepa_debit',
      subscription_current_period_end: '2026-10-15T04:00:00.000Z',
    }));
    // Engagement de 12 mois compté depuis l'échéance.
    expect(patch.commitment_end_date).toBe('2027-10-14T22:00:00.000Z');
    expect(mockRpc).toHaveBeenCalledWith('accept_box_invitation_after_payment', { p_invitation_id: 'inv-1', p_user_id: 'user-1' });
  });

  it('moyen de paiement déjà associé au client : pas de nouvelle association', async () => {
    mockSetupRetrieve.mockResolvedValue({ payment_method: { id: 'pm_1', type: 'card', customer: 'cus_1' } });
    mockConstructEvent.mockReturnValue(deferredEvent());
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    expect(mockPmAttach).not.toHaveBeenCalled();
    expect(mockCustomersUpdate).toHaveBeenCalledTimes(1);
  });

  it('même événement reçu deux fois : un seul abonnement', async () => {
    mockConstructEvent.mockReturnValue(deferredEvent());
    await POST(req());
    await POST(req());
    expect(mockSubsCreate).toHaveBeenCalledTimes(1);
    expect(chains.box_members.update).toHaveBeenLastCalledWith(expect.objectContaining({ stripe_subscription_id: 'sub_1' }));
  });

  it('fusion à moins de 7 jours : prorata ajouté une seule fois à la facture de fin d’essai', async () => {
    mockConstructEvent.mockReturnValue(deferredEvent({
      due_date: '2026-10-02', trial_end: String(s('2026-10-05T04:00:00Z')), billing_cycle_anchor: '', merged_prorata_cents: '600',
    }));
    await POST(req());
    await POST(req());
    const [params] = mockSubsCreate.mock.calls[0];
    expect(params.trial_end).toBe(s('2026-10-05T04:00:00Z'));
    expect(params.billing_cycle_anchor).toBeUndefined();
    expect(mockItemsCreate).toHaveBeenCalledTimes(1);
    expect(mockItemsCreate.mock.calls[0][0]).toEqual(expect.objectContaining({
      customer: 'cus_1', subscription: 'sub_1', amount: 600, currency: 'eur',
    }));
    expect(mockItemsCreate.mock.calls[0][1]).toEqual({ stripeAccount: 'acct_1', idempotencyKey: 'membership-deferred-item-cs_setup_1' });
  });

  it('échec de création chez Stripe : 500 (Stripe réessaie), journalisé, rien écrit', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSubsCreate.mockRejectedValueOnce(new Error('card_declined'));
    mockConstructEvent.mockReturnValue(deferredEvent());
    const res = (await POST(req())) as any;
    expect(res._status).toBe(500);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cs_setup_1'));
    expect(chains.box_members.update).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('paiement avant le compte : billing_day dans la colonne de pending_entitlements', async () => {
    chains.profiles = makeChain({ maybeSingle: { data: null } });
    chains.pending_entitlements = makeChain({ awaited: { error: null } });
    mockConstructEvent.mockReturnValue(deferredEvent({ user_id: '' }));
    const res = (await POST(req())) as any;
    expect(res._status).toBe(200);
    const [row] = chains.pending_entitlements.insert.mock.calls[0];
    expect(row.billing_day).toBe(5);
    expect(row.payload).not.toHaveProperty('billing_day');
    expect(row.payload.stripe_subscription_id).toBe('sub_1');
  });
});

describe('statuts d’abonnement', () => {
  it('trialing vaut membre actif', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      account: 'acct_1',
      data: { object: { id: 'sub_1', status: 'trialing', metadata: {}, items: { data: [] } } },
    });
    await POST(req());
    expect(chains.box_members.update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'active' }));
  });
});
