// Lot 3 — jour de prélèvement et échéance : paramètres envoyés à Stripe par
// create-membership-checkout, et route d'aperçu (même calcul, rien créé).

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

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: fromSpy, rpc: mockRpc })),
  getServerUser: jest.fn().mockResolvedValue(null),
}));

import { POST as checkout } from '../../app/api/create-membership-checkout/route';
import { POST as preview } from '../../app/api/membership-checkout-preview/route';

const s = (iso: string) => Date.parse(iso) / 1000;
const NOW = '2026-09-27T10:00:00Z';

const BOX = {
  id: 'box-1', name: 'CrossFit Test', slug: 'cf-test',
  stripe_account_id: 'acct_1', stripe_onboarding_complete: true,
};
const PLAN = {
  id: 'plan-1', box_id: 'box-1', name: 'Illimité', description: null,
  price_cents: 6000, currency: 'eur', is_active: true,
  stripe_product_id: 'prod_1', stripe_price_id: 'price_1',
  plan_type: 'subscription', credits: null, validity_days: null, commitment_months: 12,
};

const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

function invitation(nextDueDate: string | null) {
  mockRpc.mockImplementation((fn: string) => Promise.resolve(
    fn === 'resolve_box_invitation_for_checkout'
      ? { data: { ok: true, id: 'inv-1', box_id: 'box-1', plan_id: 'plan-1', email: 'invite@b.com', status: 'accepted', next_due_date: nextDueDate }, error: null }
      : { data: null, error: null },
  ));
}

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
  mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.test/s' });
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('jour de prélèvement validé côté serveur', () => {
  it.each([[undefined], [0], [11], [2.5], ['5']])('refuse %p sans rien créer chez Stripe', async (day) => {
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: day }))) as any;
    expect(res._status).toBe(400);
    expect(res._data.error).toMatch(/jour de prélèvement/);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).not.toHaveBeenCalled();
  });

  it('ne l’exige pas pour un Drop-in', async () => {
    chains.membership_plans = makeChain({ single: { data: { ...PLAN, plan_type: 'drop_in', credits: 1, validity_days: 14 }, error: null } });
    const res = (await checkout(req({ plan_id: 'plan-1' }))) as any;
    expect(res._status).toBe(200);
    expect(mockSessionsCreate.mock.calls[0][0].mode).toBe('payment');
  });
});

describe('sans échéance : abonnement ancré au jour choisi', () => {
  it('ancre au prochain jour choisi à 06:00 Paris, prorata, session close avant l’ancre', async () => {
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    const [params, opts] = mockSessionsCreate.mock.calls[0];
    expect(opts).toEqual({ stripeAccount: 'acct_1' });
    expect(params.mode).toBe('subscription');
    expect(params.subscription_data.billing_cycle_anchor).toBe(s('2026-10-05T04:00:00Z'));
    expect(params.subscription_data.proration_behavior).toBe('create_prorations');
    expect(params.expires_at).toBe(s('2026-09-28T10:00:00Z'));
    expect(params.metadata).toEqual(expect.objectContaining({ kind: 'membership', billing_day: '5' }));
    expect(params.allow_promotion_codes).toBe(true);
  });

  it('jour choisi = aujourd’hui : aucune ancre, plein tarif tout de suite', async () => {
    jest.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    const res = (await checkout(req({ plan_id: 'plan-1', billing_day: 7 }))) as any;
    expect(res._status).toBe(200);
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.subscription_data.billing_cycle_anchor).toBeUndefined();
    expect(params.subscription_data.proration_behavior).toBeUndefined();
    expect(params.expires_at).toBe(s('2026-10-07T22:00:00Z'));
  });
});

describe('avec une échéance future : enregistrement du moyen de paiement', () => {
  it('aucun montant aujourd’hui : Checkout en mode setup, sans ligne ni code promo', async () => {
    invitation('2026-10-15');
    const res = (await checkout(req({ invitation_token: 'jeton', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    const [params, opts] = mockSessionsCreate.mock.calls[0];
    expect(opts).toEqual({ stripeAccount: 'acct_1' });
    expect(params.mode).toBe('setup');
    expect(params.line_items).toBeUndefined();
    expect(params.subscription_data).toBeUndefined();
    expect(params.allow_promotion_codes).toBeUndefined();
    expect(params.payment_method_types).toEqual(['card', 'sepa_debit']);
    expect(params.customer_creation).toBe('always');
    expect(params.customer_email).toBe('invite@b.com');
    expect(params.metadata).toEqual(expect.objectContaining({
      kind: 'membership_deferred',
      billing_day: '5',
      price_id: 'price_1',
      due_date: '2026-10-15',
      trial_end: String(s('2026-10-15T04:00:00Z')),
      billing_cycle_anchor: String(s('2026-11-05T05:00:00Z')),
      merged_prorata_cents: '0',
      invitation_id: 'inv-1',
    }));
  });

  it('échéance à moins de 7 jours du jour choisi : essai jusqu’au jour choisi, prorata fusionné', async () => {
    invitation('2026-10-02');
    await checkout(req({ invitation_token: 'jeton', billing_day: 5 }));
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.mode).toBe('setup');
    expect(params.metadata.trial_end).toBe(String(s('2026-10-05T04:00:00Z')));
    expect(params.metadata.billing_cycle_anchor).toBeUndefined();
    // 3 jours sur 30 (5 sept. → 5 oct.)
    expect(params.metadata.merged_prorata_cents).toBe('600');
  });

  it('échéance du jour ou passée : bascule sur le paiement immédiat', async () => {
    invitation('2026-09-27');
    await checkout(req({ invitation_token: 'jeton', billing_day: 5 }));
    const [params] = mockSessionsCreate.mock.calls[0];
    expect(params.mode).toBe('subscription');
    expect(params.subscription_data.billing_cycle_anchor).toBe(s('2026-10-05T04:00:00Z'));
  });

  it('échéance à plus de 12 mois modifiée en base : invitation non payable, rien créé chez Stripe', async () => {
    invitation('2027-12-01');
    const res = (await checkout(req({ invitation_token: 'jeton', billing_day: 5 }))) as any;
    expect(res._status).toBe(409);
    expect(res._data.error).toMatch(/plus de 12 mois/);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).not.toHaveBeenCalled();
    expect(mockProductsCreate).not.toHaveBeenCalled();
  });

  it('échéance mal formée : invitation non payable', async () => {
    invitation('2026-02-30');
    const res = (await checkout(req({ invitation_token: 'jeton', billing_day: 5 }))) as any;
    expect(res._status).toBe(409);
    expect(res._data.error).toMatch(/mal renseignée/);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});

describe('aperçu : même calcul, rien créé chez Stripe', () => {
  it('sans échéance', async () => {
    const res = (await preview(req({ plan_id: 'plan-1', billing_day: 5 }))) as any;
    expect(res._status).toBe(200);
    expect(res._data).toEqual({
      kind: 'now', billing_day: 5, currency: 'eur', today_cents: 1550, prorata_until: '2026-10-05',
      next_charge_date: '2026-10-05', recurring_cents: 6000, due_date_ignored: false,
    });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).not.toHaveBeenCalled();
  });

  it('avec une échéance', async () => {
    invitation('2026-10-15');
    const res = (await preview(req({ invitation_token: 'jeton', billing_day: 5 }))) as any;
    expect(res._data).toEqual(expect.objectContaining({
      kind: 'deferred', today_cents: 0, first_charge_date: '2026-10-15',
      first_charge_cents: 4073, merged_prorata_cents: 0, prorata_until: '2026-11-05', recurring_cents: 6000, due_date: '2026-10-15',
    }));
  });

  it('refuse un jour hors de 1 à 10 et une échéance trop lointaine', async () => {
    expect(((await preview(req({ plan_id: 'plan-1', billing_day: 12 }))) as any)._status).toBe(400);
    invitation('2027-12-01');
    expect(((await preview(req({ invitation_token: 'jeton', billing_day: 5 }))) as any)._status).toBe(409);
  });

  it('refuse une offre à paiement unique', async () => {
    chains.membership_plans = makeChain({ single: { data: { ...PLAN, plan_type: 'pack', credits: 10 }, error: null } });
    expect(((await preview(req({ plan_id: 'plan-1', billing_day: 5 }))) as any)._status).toBe(400);
  });
});
