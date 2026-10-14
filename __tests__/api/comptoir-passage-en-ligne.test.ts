// Comptoir P1, PR 4 — passage au paiement en ligne : l'adhésion de l'acheteur
// connecté décide de l'échéance (accès comptoir en cours) ou refuse (abonnement
// en ligne déjà vivant). L'invitation reste prioritaire.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockSessionsCreate = jest.fn();
const mockPricesCreate = jest.fn();
const mockProductsCreate = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionsCreate } },
    prices: { create: mockPricesCreate },
    products: { create: mockProductsCreate },
  })),
}));

function makeChain(cfg: { single?: any } = {}) {
  const awaited = { data: null, error: null };
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'eq', 'ilike', 'is', 'in'].forEach((m) => (c[m] = jest.fn(ret)));
  c.then = (resolve: Function) => Promise.resolve(awaited).then(resolve as any);
  c.single = jest.fn().mockResolvedValue(cfg.single ?? awaited);
  c.maybeSingle = jest.fn().mockResolvedValue(cfg.single ?? awaited);
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((table: string) => (chains[table] ??= makeChain()));
const mockRpc = jest.fn();
const mockGetServerUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: fromSpy, rpc: mockRpc })),
  getServerUser: () => mockGetServerUser(),
}));

import { POST as checkout } from '../../app/api/create-membership-checkout/route';
import { POST as preview } from '../../app/api/membership-checkout-preview/route';

const s = (iso: string) => Date.parse(iso) / 1000;
// Aujourd'hui = 13 oct. 2026, comme les maquettes.
const NOW = '2026-10-13T10:00:00Z';

const BOX = { id: 'box-1', name: 'AthleX Fitness', slug: 'athlex-fitness', stripe_account_id: 'acct_1', stripe_onboarding_complete: true };
const PLAN = {
  id: 'plan-1', box_id: 'box-1', name: 'Mensuel illimité', description: null,
  price_cents: 4900, currency: 'eur', is_active: true,
  stripe_product_id: 'prod_1', stripe_price_id: 'price_1',
  plan_type: 'subscription', credits: null, validity_days: null, commitment_months: 0,
};

const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

function member(row: Record<string, unknown> | null, error: unknown = null) {
  chains.box_members = makeChain({ single: { data: row, error } });
}
const cash = (until: string, status = 'active') =>
  member({ stripe_subscription_id: null, subscription_status: status, cash_access_until: until });

function invitation(nextDueDate: string | null) {
  mockRpc.mockImplementation((fn: string) => Promise.resolve(
    fn === 'resolve_box_invitation_for_checkout'
      ? { data: { ok: true, id: 'inv-1', box_id: 'box-1', plan_id: 'plan-1', email: 'membre@b.com', status: 'accepted', next_due_date: nextDueDate }, error: null }
      : { data: null, error: null },
  ));
}

const readsMember = () => fromSpy.mock.calls.some(([t]) => t === 'box_members');

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  jest.setSystemTime(new Date(NOW));
  chains = {
    membership_plans: makeChain({ single: { data: PLAN, error: null } }),
    boxes: makeChain({ single: { data: BOX, error: null } }),
    profiles: makeChain({ single: { data: { id: 'user-42' }, error: null } }),
  };
  member(null);
  mockGetServerUser.mockResolvedValue({ id: 'user-42', email: 'membre@b.com' });
  mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.test/s' });
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('accès payé au comptoir en cours : échéance au lendemain de la fin', () => {
  it('Checkout en mode setup, essai jusqu’au lendemain de la fin d’accès à 06:00 Paris (exemple de la maquette)', async () => {
    cash('2026-11-12');
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    const [params, opts] = mockSessionsCreate.mock.calls[0];
    expect(opts).toEqual({ stripeAccount: 'acct_1' });
    expect(params.mode).toBe('setup');
    expect(params.line_items).toBeUndefined();
    expect(params.metadata).toEqual(expect.objectContaining({
      kind: 'membership_deferred',
      user_id: 'user-42',
      due_date: '2026-11-13',
      trial_end: String(s('2026-11-13T05:00:00Z')),
      billing_cycle_anchor: String(s('2026-12-05T05:00:00Z')),
      merged_prorata_cents: '0',
    }));
    expect(params.metadata.invitation_id).toBeUndefined();
    // La ligne lue est celle de l'acheteur, dans la box de la formule.
    expect(chains.box_members.eq).toHaveBeenCalledWith('box_id', 'box-1');
    expect(chains.box_members.eq).toHaveBeenCalledWith('member_id', 'user-42');
  });

  it('aperçu : 35,93 € le 13 novembre, puis 49 € le 5, et cash_until', async () => {
    cash('2026-11-12');
    const res = (await preview(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    expect(res._data).toEqual(expect.objectContaining({
      kind: 'deferred', today_cents: 0, first_charge_date: '2026-11-13', first_charge_cents: 3593,
      prorata_until: '2026-12-05', recurring_cents: 4900, due_date: '2026-11-13', cash_until: '2026-11-12',
    }));
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it('dernier jour d’accès aujourd’hui : rien aujourd’hui, premier prélèvement demain', async () => {
    cash('2026-10-13');
    await checkout(req({ plan_id: 'plan-1', billing_day: 5 }));
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.mode).toBe('setup');
    expect(params.metadata.due_date).toBe('2026-10-14');
  });
});

describe('accès échu : paiement immédiat habituel', () => {
  it.each([['expired'], ['active']])('fin d’accès hier (statut %s) : Checkout abonnement, prorata jusqu’au jour choisi', async (status) => {
    cash('2026-10-12', status);
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.mode).toBe('subscription');
    expect(params.subscription_data.billing_cycle_anchor).toBe(s('2026-11-05T05:00:00Z'));
    expect(params.metadata.kind).toBe('membership');
  });

  it('aperçu : paiement aujourd’hui, cash_until null', async () => {
    cash('2026-10-12', 'expired');
    const res = (await preview(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._data).toEqual(expect.objectContaining({ kind: 'now', cash_until: null }));
  });
});

describe('abonnement en ligne déjà en cours dans la box : refus', () => {
  it.each([['active'], ['trialing'], ['past_due']])('statut %s : 409 et rien créé chez Stripe (création et aperçu)', async (status) => {
    member({ stripe_subscription_id: 'sub_1', subscription_status: status, cash_access_until: '2026-11-12' });
    for (const route of [checkout, preview]) {
      const res = (await route(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
      expect(res._status).toBe(409);
      expect(res._data.error).toBe('Tu as déjà un abonnement en ligne dans cette box : change de formule depuis Mon compte.');
    }
    expect(mockSessionsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).not.toHaveBeenCalled();
    expect(mockProductsCreate).not.toHaveBeenCalled();
  });

  it('abonnement arrêté (canceled) : le membre peut se réabonner', async () => {
    member({ stripe_subscription_id: 'sub_1', subscription_status: 'canceled', cash_access_until: null });
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    expect(mockSessionsCreate.mock.calls[0][0].mode).toBe('subscription');
  });

  it('adhésion illisible : refus sans rien créer, journal sans donnée personnelle', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    member(null, { code: 'XX000', message: 'boom membre@b.com' });
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(500);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toMatch(/membre@b\.com|user-42/);
    spy.mockRestore();
  });
});

describe('accès qui finit à plus de 12 mois : refus avec la date d’ouverture', () => {
  it('fin le 12 nov. 2027 : possible à partir du 13 novembre 2026', async () => {
    cash('2027-11-12');
    for (const route of [checkout, preview]) {
      const res = (await route(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
      expect(res._status).toBe(409);
      expect(res._data.error).toBe('Ton accès payé à la box court jusqu’au 12 novembre 2027 : tu pourras passer au paiement en ligne à partir du 13 novembre 2026.');
    }
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it('« 1er » devant décembre', async () => {
    cash('2027-11-30');
    const res = (await preview(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._data.error).toBe('Ton accès payé à la box court jusqu’au 30 novembre 2027 : tu pourras passer au paiement en ligne à partir du 1er décembre 2026.');
  });

  it('le jour indiqué, le passage est accepté', async () => {
    jest.setSystemTime(new Date('2026-11-13T10:00:00Z'));
    cash('2027-11-12');
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    expect(mockSessionsCreate.mock.calls[0][0].metadata.due_date).toBe('2027-11-13');
  });
});

describe('invitation prioritaire', () => {
  it('l’échéance de l’invitation est retenue, l’adhésion n’est pas lue', async () => {
    cash('2026-11-12');
    invitation('2026-10-20');
    const res = (await checkout(req({ invitation_token: 'jeton', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    expect(mockSessionsCreate.mock.calls[0][0].metadata.due_date).toBe('2026-10-20');
    expect(readsMember()).toBe(false);
  });

  it('aperçu d’une invitation : cash_until null', async () => {
    cash('2026-11-12');
    invitation('2026-10-20');
    const res = (await preview(req({ invitation_token: 'jeton', billing_day: 5 }))) as any;
    expect(res._data).toEqual(expect.objectContaining({ kind: 'deferred', due_date: '2026-10-20', cash_until: null }));
  });
});

describe('hors périmètre du contrôle', () => {
  it('visiteur non connecté : aucune lecture d’adhésion, paiement immédiat', async () => {
    mockGetServerUser.mockResolvedValue(null);
    cash('2026-11-12');
    await checkout(req({ plan_id: 'plan-1', billing_day: 5 }));
    expect(readsMember()).toBe(false);
    expect(mockSessionsCreate.mock.calls[0][0].mode).toBe('subscription');
  });

  it('Drop-in : aucune lecture d’adhésion (le contrôle vise les abonnements)', async () => {
    member({ stripe_subscription_id: 'sub_1', subscription_status: 'active', cash_access_until: null });
    chains.membership_plans = makeChain({ single: { data: { ...PLAN, plan_type: 'drop_in', credits: 1, validity_days: 14 }, error: null } });
    const res = (await checkout(req({ plan_id: 'plan-1' }))) as any;
    expect(res._status).toBe(200);
    expect(readsMember()).toBe(false);
  });
});
