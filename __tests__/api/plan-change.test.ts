// Changement de formule par le membre (« Mon abonnement », PR serveur) :
// app/api/change-membership-plan (+ /cancel), members/plan-change-requests/decide,
// membership/payment-portal, membership/overview. Base en mémoire, Stripe simulé.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockStripe = {
  subscriptions: { retrieve: jest.fn(), update: jest.fn() },
  subscriptionSchedules: { create: jest.fn(), retrieve: jest.fn(), update: jest.fn(), release: jest.fn() },
  products: { create: jest.fn() },
  prices: { create: jest.fn() },
  invoices: { create: jest.fn(), list: jest.fn() },
  customers: { retrieve: jest.fn() },
  billingPortal: { configurations: { create: jest.fn() }, sessions: { create: jest.fn() } },
};

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockStripe) }));
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn(), getServerUser: jest.fn() }));
jest.mock('@/lib/auth/requestUser', () => ({ getRequestUser: jest.fn() }));
jest.mock('@/lib/members/membershipPush', () => ({ sendPlanChangeDecisionPush: jest.fn().mockResolvedValue(true) }));

import { POST as changer } from '../../app/api/change-membership-plan/route';
import { POST as annuler } from '../../app/api/change-membership-plan/cancel/route';
import { POST as decider } from '../../app/api/members/plan-change-requests/decide/route';
import { POST as portail } from '../../app/api/membership/payment-portal/route';
import { GET as overview } from '../../app/api/membership/overview/route';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/auth/requestUser';
import { sendPlanChangeDecisionPush } from '@/lib/members/membershipPush';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const PERIOD_END = 1793534400; // 2026-11-01T10:00:00Z
const EFFECTIVE = new Date(PERIOD_END * 1000).toISOString();

const plan = (id: string, o: Record<string, unknown> = {}) => ({
  id, box_id: 'box-1', name: id, description: null, price_cents: 5000, currency: 'eur', is_active: true,
  plan_type: 'subscription', stripe_product_id: `prod_${id}`, stripe_price_id: `price_${id}`, ...o,
});

const ENLIGNE = {
  id: 'bm-1', box_id: 'box-1', member_id: 'ath-1', role: 'member', status: 'active', joined_at: '2026-01-01',
  plan_id: 'mensuel', subscription_status: 'active', stripe_subscription_id: 'sub_1',
  subscription_current_period_end: EFFECTIVE, subscription_cancel_at_period_end: false, subscription_paused: false,
  past_due_since: null, amount_cents: 5000, commitment_end_date: '2027-06-30',
  scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null,
};
const COMPTOIR = { ...ENLIGNE, subscription_status: null, stripe_subscription_id: null, amount_cents: null };

let db: ReturnType<typeof fakeSupabase>;
let rpc: Record<string, jest.Mock>;

function monde(membre: Record<string, unknown> = ENLIGNE, extra: Record<string, any[]> = {}) {
  rpc = {
    request_plan_change: jest.fn(async () => ({ data: 'req-1', error: null })),
    cancel_plan_change_request: jest.fn(async () => ({ data: true, error: null })),
    decide_plan_change_request: jest.fn(async () => ({ data: { decided: true, status: 'accepted' }, error: null })),
  };
  db = fakeSupabase({
    boxes: [
      { id: 'box-1', name: 'AthleX Fitness', owner_id: 'owner-1', stripe_account_id: 'acct_1', stripe_onboarding_complete: true, archived_at: null, archive_scheduled_at: null },
      { id: 'box-2', name: 'Autre', owner_id: 'owner-2', stripe_account_id: 'acct_2', stripe_onboarding_complete: true, archived_at: null, archive_scheduled_at: null },
    ],
    membership_plans: [
      plan('mensuel'), plan('illimite', { price_cents: 7000 }), plan('gratuite', { price_cents: 0 }),
      plan('ancienne', { is_active: false }), plan('carnet', { plan_type: 'pack' }), plan('autre', { box_id: 'box-2' }),
    ],
    // Copies : le faux Supabase écrit dans ses lignes, les constantes restent intactes.
    box_members: [
      { ...membre },
      { ...COMPTOIR, id: 'bm-coach', member_id: 'coach-1', role: 'coach', plan_id: null },
      { ...COMPTOIR, id: 'bm-cog', member_id: 'cog-1', role: 'owner', plan_id: null },
    ],
    membership_cancellation_requests: [],
    box_plan_change_requests: [],
    box_stripe_portal: [],
    ...extra,
  }, rpc);
  (createServiceClient as jest.Mock).mockReturnValue(db.client);
}

const req = (body: unknown = {}): any => ({ json: jest.fn().mockResolvedValue(body), headers: { get: () => null } });
const ecritures = (table: string) => db.writes.filter((w) => w.table === table);

function stripeParDefaut() {
  mockStripe.subscriptions.retrieve.mockResolvedValue({
    id: 'sub_1', customer: 'cus_1', schedule: null, metadata: { plan_id: 'mensuel', box_id: 'box-1' },
    current_period_end: PERIOD_END, default_payment_method: null,
    items: { data: [{ id: 'si_1', quantity: 1, price: { id: 'price_mensuel', unit_amount: 5000 } }] },
  });
  const cree = {
    id: 'sub_sched_1', status: 'active', metadata: {}, current_phase: { start_date: 1790856000, end_date: PERIOD_END },
    phases: [{ start_date: 1790856000, end_date: PERIOD_END, items: [{ price: 'price_mensuel', quantity: 1 }] }],
  };
  mockStripe.subscriptionSchedules.create.mockResolvedValue(cree);
  mockStripe.subscriptionSchedules.retrieve.mockResolvedValue(cree);
  mockStripe.subscriptionSchedules.update.mockImplementation(async (id: string) => ({ id, phases: [], metadata: {} }));
  mockStripe.subscriptionSchedules.release.mockResolvedValue({ id: 'sub_sched_1', status: 'released' });
  mockStripe.billingPortal.configurations.create.mockResolvedValue({ id: 'bpc_1' });
  mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/p/session_1' });
  mockStripe.invoices.list.mockResolvedValue({ data: [] });
}

beforeEach(() => {
  jest.clearAllMocks();
  monde();
  stripeParDefaut();
  (getRequestUser as jest.Mock).mockResolvedValue({ id: 'ath-1' });
  (getServerUser as jest.Mock).mockResolvedValue({ id: 'owner-1' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

/** Aucune facturation le jour même : jamais de mise à jour d'abonnement, ni de facture, ni de prorata. */
function aucuneFacturationImmediate() {
  expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  expect(mockStripe.invoices.create).not.toHaveBeenCalled();
  const appels = JSON.stringify([
    ...mockStripe.subscriptionSchedules.create.mock.calls, ...mockStripe.subscriptionSchedules.update.mock.calls,
  ]);
  expect(appels).not.toMatch(/always_invoice|create_prorations/);
}

describe('POST /api/change-membership-plan : refus', () => {
  it('sans session : 401', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue(null);
    expect((await changer(req({ new_plan_id: 'illimite' })) as any)._status).toBe(401);
  });

  it.each([
    ['impayé (statut)', { subscription_status: 'past_due' }, 'PLAN_CHANGE_PAST_DUE'],
    ['impayé (date)', { past_due_since: '2026-10-01T00:00:00Z' }, 'PLAN_CHANGE_PAST_DUE'],
    ['pause', { subscription_paused: true }, 'PLAN_CHANGE_PAUSED'],
    ['résiliation programmée', { subscription_cancel_at_period_end: true }, 'PLAN_CHANGE_CANCEL_SCHEDULED'],
  ])('%s → 409 %s, rien chez Stripe ni en base', async (_l, patch, code) => {
    monde({ ...ENLIGNE, ...patch });
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect([res._status, res._data.code]).toEqual([409, code]);
    expect(mockStripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(ecritures('box_members')).toEqual([]);
  });

  it('demande de résiliation en attente → 409 PLAN_CHANGE_CANCEL_SCHEDULED', async () => {
    monde(ENLIGNE, { membership_cancellation_requests: [{ id: 'mcr-1', box_id: 'box-1', member_id: 'ath-1', status: 'pending' }] });
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect([res._status, res._data.code]).toEqual([409, 'PLAN_CHANGE_CANCEL_SCHEDULED']);
  });

  it.each([
    ['archivée', { archived_at: '2026-10-01T00:00:00Z' }, 'BOX_ARCHIVEE'],
    ['en archivage', { archive_scheduled_at: '2026-11-01T00:00:00Z' }, 'BOX_ARCHIVAGE_PROGRAMME'],
  ])(
    'box %s → 409 %s (refus commun des routes d’entrée)', async (_l, patch, code) => {
      Object.assign(db.tables.boxes[0], patch);
      const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
      expect([res._status, res._data.code]).toEqual([409, code]);
      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

  it.each([
    ['même formule', 'mensuel', 'PLAN_CHANGE_SAME_PLAN'],
    ['formule gratuite', 'gratuite', 'PLAN_CHANGE_INVALID_PLAN'],
    ['formule inactive', 'ancienne', 'PLAN_CHANGE_INVALID_PLAN'],
    ['carnet (pas un abonnement)', 'carnet', 'PLAN_CHANGE_INVALID_PLAN'],
    ["formule d'une autre box", 'autre', 'PLAN_CHANGE_NOT_MEMBER'],
  ])('%s → 409 %s', async (_l, planId, code) => {
    const res = (await changer(req({ new_plan_id: planId }))) as any;
    expect([res._status, res._data.code]).toEqual([409, code]);
    expect(mockStripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(rpc.request_plan_change).not.toHaveBeenCalled();
  });

  it('échéancier étranger sur l’abonnement → 409, rien de modifié', async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue({ ...(await mockStripe.subscriptions.retrieve()), schedule: 'sub_sched_box' });
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({ id: 'sub_sched_box', metadata: {}, phases: [] });
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect([res._status, res._data.code]).toEqual([409, 'PLAN_CHANGE_FOREIGN_SCHEDULE']);
    expect(mockStripe.subscriptionSchedules.update).not.toHaveBeenCalled();
    expect(ecritures('box_members')).toEqual([]);
  });
});

describe('POST /api/change-membership-plan : en ligne, programmé à l’échéance', () => {
  it('crée l’échéancier : phase 1 actuelle jusqu’à la fin de période, phase 2 nouvelle formule, sans prorata', async () => {
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect(res._status).toBe(200);
    expect(res._data).toEqual({ ok: true, mode: 'online', effective_at: EFFECTIVE, plan_name: 'illimite' });

    const [cree, creeOpts] = mockStripe.subscriptionSchedules.create.mock.calls[0];
    expect(cree).toMatchObject({ from_subscription: 'sub_1' });
    expect(creeOpts).toMatchObject({ stripeAccount: 'acct_1' });
    expect(creeOpts.idempotencyKey).toBeTruthy();

    const [id, maj, majOpts] = mockStripe.subscriptionSchedules.update.mock.calls[0];
    expect(id).toBe('sub_sched_1');
    expect(majOpts).toMatchObject({ stripeAccount: 'acct_1' });
    expect(majOpts.idempotencyKey).toBeTruthy();
    expect(maj.end_behavior).toBe('release');
    expect(maj.proration_behavior).toBe('none');
    expect(maj.phases).toEqual([
      { start_date: 1790856000, end_date: PERIOD_END, items: [{ price: 'price_mensuel', quantity: 1 }], proration_behavior: 'none', metadata: { plan_id: 'mensuel', box_id: 'box-1' } },
      { items: [{ price: 'price_illimite', quantity: 1 }], iterations: 1, proration_behavior: 'none', metadata: { plan_id: 'illimite', box_id: 'box-1', member_id: 'ath-1' } },
    ]);
    aucuneFacturationImmediate();

    // En base : seulement le programmé, jamais plan_id ni amount_cents.
    expect(ecritures('box_members')).toEqual([expect.objectContaining({
      op: 'update',
      values: { scheduled_plan_id: 'illimite', scheduled_change_at: EFFECTIVE, stripe_schedule_id: 'sub_sched_1' },
      match: { id: 'bm-1', stripe_subscription_id: 'sub_1' },
    })]);
    expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'mensuel', amount_cents: 5000, commitment_end_date: '2027-06-30' });
  });

  it('reprend l’échéancier enregistré et remplace la phase 2 (aucun nouvel échéancier)', async () => {
    monde({ ...ENLIGNE, scheduled_plan_id: 'illimite', scheduled_change_at: EFFECTIVE, stripe_schedule_id: 'sub_sched_1' });
    mockStripe.subscriptions.retrieve.mockResolvedValue({ ...(await mockStripe.subscriptions.retrieve()), schedule: 'sub_sched_1' });
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({
      id: 'sub_sched_1', metadata: {}, current_phase: { start_date: 1790856000 },
      phases: [
        { start_date: 1790856000, end_date: PERIOD_END, items: [] },
        { start_date: PERIOD_END, end_date: PERIOD_END + 2592000, items: [{ price: 'price_illimite' }] },
      ],
    });
    db.tables.membership_plans.push(plan('premium', { price_cents: 9000 }));
    const res = (await changer(req({ new_plan_id: 'premium' }))) as any;
    expect(res._status).toBe(200);
    expect(mockStripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    const maj = mockStripe.subscriptionSchedules.update.mock.calls[0][1];
    expect(maj.phases).toHaveLength(2);
    expect(maj.phases[1].items).toEqual([{ price: 'price_premium', quantity: 1 }]);
    expect(db.tables.box_members[0].scheduled_plan_id).toBe('premium');
    aucuneFacturationImmediate();
  });

  it('reprend un échéancier marqué à son nom après la bascule (colonnes déjà vidées)', async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue({ ...(await mockStripe.subscriptions.retrieve()), schedule: 'sub_sched_9' });
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({
      id: 'sub_sched_9', metadata: { athlex_plan_change: '1', member_id: 'ath-1' },
      current_phase: { start_date: 1790856000 }, phases: [{ start_date: 1790856000, end_date: PERIOD_END, items: [] }],
    });
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect(res._status).toBe(200);
    expect(mockStripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(db.tables.box_members[0].stripe_schedule_id).toBe('sub_sched_9');
  });

  it('échec de l’écriture en base après Stripe : échéancier relâché, erreur, rien en base', async () => {
    const from = db.client.from.getMockImplementation();
    db.client.from.mockImplementation((t: string) => {
      const c = from(t);
      if (t === 'box_members') {
        const update = c.update;
        c.update = (v: any) => { update(v); c.select = () => Promise.resolve({ data: null, error: { message: 'panne' } }); return c; };
      }
      return c;
    });
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect(res._status).toBe(500);
    expect(mockStripe.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_1', {}, expect.objectContaining({ stripeAccount: 'acct_1' }));
    aucuneFacturationImmediate();
  });
});

describe('POST /api/change-membership-plan : au comptoir, demande au gérant', () => {
  beforeEach(() => monde(COMPTOIR));

  it('request_plan_change avec l’id de l’appelant, rien chez Stripe', async () => {
    const res = (await changer(req({ new_plan_id: 'illimite', member_id: 'quelqu-un-d-autre' }))) as any;
    expect(res._data).toEqual({ ok: true, mode: 'counter', plan_name: 'illimite' });
    expect(rpc.request_plan_change).toHaveBeenCalledWith({ p_member_id: 'ath-1', p_box_id: 'box-1', p_to_plan_id: 'illimite' });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(ecritures('box_members')).toEqual([]);
  });

  it('code de la base traduit en message français (409)', async () => {
    rpc.request_plan_change.mockResolvedValue({ data: null, error: { message: 'PLAN_CHANGE_PENDING_EXISTS: une demande de changement est déjà en attente.' } });
    const res = (await changer(req({ new_plan_id: 'illimite' }))) as any;
    expect(res._status).toBe(409);
    expect(res._data).toEqual({ code: 'PLAN_CHANGE_PENDING_EXISTS', error: 'Une demande de changement est déjà en attente.' });
  });
});

describe('POST /api/change-membership-plan/cancel', () => {
  it('sans session : 401, rien annulé', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue(null);
    expect(((await annuler(req())) as any)._status).toBe(401);
    expect(rpc.cancel_plan_change_request).not.toHaveBeenCalled();
  });

  it('en ligne : échéancier relâché puis colonnes vidées (conditionnel sur l’échéancier)', async () => {
    monde({ ...ENLIGNE, scheduled_plan_id: 'illimite', scheduled_change_at: EFFECTIVE, stripe_schedule_id: 'sub_sched_1' });
    const res = (await annuler(req())) as any;
    expect(res._data).toEqual({ ok: true, mode: 'online' });
    expect(mockStripe.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_1', {}, expect.objectContaining({ stripeAccount: 'acct_1', idempotencyKey: expect.any(String) }));
    expect(ecritures('box_members')).toEqual([expect.objectContaining({
      values: { scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null },
      match: { id: 'bm-1', stripe_schedule_id: 'sub_sched_1' },
    })]);
    expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'mensuel', stripe_schedule_id: null });
    aucuneFacturationImmediate();
  });

  it('en ligne, déjà relâché chez Stripe : colonnes vidées quand même', async () => {
    monde({ ...ENLIGNE, scheduled_plan_id: 'illimite', stripe_schedule_id: 'sub_sched_1' });
    mockStripe.subscriptionSchedules.release.mockRejectedValue(new Error('already released'));
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({ id: 'sub_sched_1', status: 'released' });
    expect(((await annuler(req())) as any)._status).toBe(200);
    expect(db.tables.box_members[0].stripe_schedule_id).toBeNull();
  });

  it('au comptoir : cancel_plan_change_request pour l’appelant', async () => {
    monde(COMPTOIR);
    const res = (await annuler(req())) as any;
    expect(res._data).toEqual({ ok: true, mode: 'counter' });
    expect(rpc.cancel_plan_change_request).toHaveBeenCalledWith({ p_member_id: 'ath-1', p_box_id: 'box-1' });
  });

  it.each([['au comptoir', COMPTOIR], ['en ligne', ENLIGNE]])('rien à annuler (%s) → 409 explicite', async (_l, m) => {
    monde(m);
    rpc.cancel_plan_change_request.mockResolvedValue({ data: false, error: null });
    const res = (await annuler(req())) as any;
    expect([res._status, res._data.code]).toEqual([409, 'PLAN_CHANGE_NOTHING_TO_CANCEL']);
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
  });
});

describe('POST /api/members/plan-change-requests/decide', () => {
  beforeEach(() => monde(COMPTOIR, {
    box_plan_change_requests: [{ id: 'req-1', box_id: 'box-1', member_id: 'ath-1', to_plan_id: 'illimite', status: 'pending' }],
  }));

  it('acceptée par le gérant : décision de la base avec son id, un push au membre', async () => {
    const res = (await decider(req({ request_id: 'req-1', accept: true }))) as any;
    expect(res._data).toEqual({ ok: true, decided: true, status: 'accepted' });
    expect(rpc.decide_plan_change_request).toHaveBeenCalledWith({ p_request_id: 'req-1', p_actor_id: 'owner-1', p_accept: true });
    expect(sendPlanChangeDecisionPush).toHaveBeenCalledTimes(1);
    expect(sendPlanChangeDecisionPush).toHaveBeenCalledWith({ userId: 'ath-1', boxId: 'box-1', accepted: true, planName: 'illimite' });
  });

  it('refusée par un co-gérant : push « refusé »', async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ id: 'cog-1' });
    rpc.decide_plan_change_request.mockResolvedValue({ data: { decided: true, status: 'refused' }, error: null });
    await decider(req({ request_id: 'req-1', accept: false }));
    expect(sendPlanChangeDecisionPush).toHaveBeenCalledWith({ userId: 'ath-1', boxId: 'box-1', accepted: false, planName: null });
  });

  it('double décision (decided false) : aucune seconde notification', async () => {
    rpc.decide_plan_change_request.mockResolvedValue({ data: { decided: false, status: 'accepted' }, error: null });
    const res = (await decider(req({ request_id: 'req-1', accept: true }))) as any;
    expect(res._data).toEqual({ ok: true, decided: false, status: 'accepted' });
    expect(sendPlanChangeDecisionPush).not.toHaveBeenCalled();
  });

  it('coach : 403 sans appel à la base', async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ id: 'coach-1' });
    const res = (await decider(req({ request_id: 'req-1', accept: true }))) as any;
    expect([res._status, res._data.code]).toEqual([403, 'PLAN_CHANGE_FORBIDDEN']);
    expect(rpc.decide_plan_change_request).not.toHaveBeenCalled();
    expect(sendPlanChangeDecisionPush).not.toHaveBeenCalled();
  });

  it('refus de la base (FORBIDDEN) : 403, sans push', async () => {
    rpc.decide_plan_change_request.mockResolvedValue({ data: null, error: { message: 'PLAN_CHANGE_FORBIDDEN: seuls le gérant et les co-gérants de la box décident.' } });
    const res = (await decider(req({ request_id: 'req-1', accept: true }))) as any;
    expect([res._status, res._data.code]).toEqual([403, 'PLAN_CHANGE_FORBIDDEN']);
    expect(sendPlanChangeDecisionPush).not.toHaveBeenCalled();
  });

  it('demande inconnue : 404 ; sans session : 401', async () => {
    expect(((await decider(req({ request_id: 'req-x', accept: true }))) as any)._status).toBe(404);
    (getServerUser as jest.Mock).mockResolvedValue(null);
    expect(((await decider(req({ request_id: 'req-1', accept: true }))) as any)._status).toBe(401);
  });
});

describe('POST /api/membership/payment-portal', () => {
  it('sans session : 401', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue(null);
    expect(((await portail(req())) as any)._status).toBe(401);
    expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('configuration créée une seule fois sur le compte connecté, fonctions limitées, retour /compte', async () => {
    const res = (await portail(req())) as any;
    expect(res._data).toEqual({ url: 'https://billing.stripe.com/p/session_1' });
    const [config, opts] = mockStripe.billingPortal.configurations.create.mock.calls[0];
    expect(opts).toMatchObject({ stripeAccount: 'acct_1', idempotencyKey: expect.any(String) });
    expect(config.features).toEqual({
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
      customer_update: { enabled: false },
    });
    expect(db.tables.box_stripe_portal).toEqual([expect.objectContaining({ box_id: 'box-1', stripe_portal_configuration_id: 'bpc_1' })]);
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      { customer: 'cus_1', configuration: 'bpc_1', return_url: expect.stringMatching(/\/compte$/) },
      { stripeAccount: 'acct_1' },
    );

    await portail(req());
    expect(mockStripe.billingPortal.configurations.create).toHaveBeenCalledTimes(1);
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenLastCalledWith(expect.objectContaining({ configuration: 'bpc_1' }), expect.anything());
  });

  it('sans abonnement en ligne (comptoir) : 409, aucun appel Stripe', async () => {
    monde(COMPTOIR);
    const res = (await portail(req())) as any;
    expect([res._status, res._data.code]).toEqual([409, 'NO_ONLINE_SUBSCRIPTION']);
    expect(mockStripe.billingPortal.configurations.create).not.toHaveBeenCalled();
    expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/membership/overview', () => {
  it('sans session : 401', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue(null);
    expect(((await overview(req())) as any)._status).toBe(401);
  });

  it('en ligne : formule, prix, échéance, carte, formules proposables, aucun identifiant Stripe', async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      ...(await mockStripe.subscriptions.retrieve()),
      default_payment_method: { id: 'pm_1', type: 'card', card: { last4: '4242' } },
    });
    const res = (await overview(req())) as any;
    expect(res._data).toMatchObject({
      box: { id: 'box-1', name: 'AthleX Fitness' }, plan: { id: 'mensuel', name: 'mensuel' }, price_cents: 5000,
      mode: 'online', next_billing_at: EFFECTIVE, payment_method: 'Carte •••• 4242', block_reason: null,
      scheduled_change: null, pending_request: null, unpaid_invoice_url: null,
      available_plans: [{ id: 'illimite', name: 'illimite', price_cents: 7000 }],
    });
    expect(JSON.stringify(res._data)).not.toMatch(/:"(sub|acct|cus|pm|price|bpc)_/);
  });

  it('bornée à l’appelant : la ligne d’un autre membre, même plus récente, n’est jamais lue', async () => {
    monde(COMPTOIR);
    db.tables.box_members.push({ ...ENLIGNE, id: 'bm-autre', member_id: 'ath-2', plan_id: 'illimite', joined_at: '2026-09-01' });
    const res = (await overview(req())) as any;
    expect(res._data).toMatchObject({ mode: 'counter', plan: { id: 'mensuel' } });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('en impayé : motif et page de la dernière facture ouverte', async () => {
    monde({ ...ENLIGNE, subscription_status: 'past_due', past_due_since: '2026-10-01T00:00:00Z' });
    mockStripe.invoices.list.mockResolvedValue({ data: [{ hosted_invoice_url: 'https://invoice.stripe.com/i/1' }] });
    const res = (await overview(req())) as any;
    expect(res._data).toMatchObject({ block_reason: 'past_due', unpaid_invoice_url: 'https://invoice.stripe.com/i/1' });
    expect(mockStripe.invoices.list).toHaveBeenCalledWith({ subscription: 'sub_1', status: 'open', limit: 1 }, { stripeAccount: 'acct_1' });
  });

  it('au comptoir : demande en attente, prix de la formule, rien chez Stripe', async () => {
    monde(COMPTOIR, { box_plan_change_requests: [{ id: 'req-1', box_id: 'box-1', member_id: 'ath-1', to_plan_id: 'illimite', status: 'pending', created_at: '2026-10-09T08:00:00Z' }] });
    const res = (await overview(req())) as any;
    expect(res._data).toMatchObject({
      mode: 'counter', price_cents: 5000, payment_method: null, next_billing_at: null,
      pending_request: { plan: { id: 'illimite', name: 'illimite' }, at: '2026-10-09T08:00:00Z' },
    });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});

describe('idempotence : clés dérivées de l’état (faux Stripe qui rejoue une clé déjà vue)', () => {
  let effectifs: string[];
  let schedules: Record<string, any>;
  let attache: string | null;

  /** Comme Stripe : une clé déjà vue rend la réponse d'alors, sans rien exécuter. */
  function idem<T>(cles: Map<string, T>, cle: string, run: () => T): T {
    if (!cles.has(cle)) cles.set(cle, run());
    return JSON.parse(JSON.stringify(cles.get(cle)));
  }

  beforeEach(() => {
    effectifs = [];
    schedules = {};
    attache = null;
    let n = 0;
    const cles = new Map<string, any>();
    db.tables.membership_plans.push(plan('premium', { price_cents: 9000 }));
    mockStripe.subscriptions.retrieve.mockImplementation(async () => ({
      id: 'sub_1', customer: 'cus_1', schedule: attache, metadata: { plan_id: 'mensuel', box_id: 'box-1' },
      current_period_end: PERIOD_END, items: { data: [{ quantity: 1, price: { id: 'price_mensuel' } }] },
    }));
    mockStripe.subscriptionSchedules.create.mockImplementation(async (params: any, o: any) => idem(cles, o.idempotencyKey, () => {
      const id = `sub_sched_${++n}`;
      effectifs.push(`create ${id}`);
      schedules[id] = { id, status: 'active', metadata: params.metadata, current_phase: { start_date: 1790856000 }, phases: [{ start_date: 1790856000, end_date: PERIOD_END, items: [] }] };
      attache = id;
      return schedules[id];
    }));
    mockStripe.subscriptionSchedules.retrieve.mockImplementation(async (id: string) => JSON.parse(JSON.stringify(schedules[id])));
    mockStripe.subscriptionSchedules.update.mockImplementation(async (id: string, params: any, o: any) => idem(cles, o.idempotencyKey, () => {
      const prix = params.phases[1].items[0].price;
      effectifs.push(`phase2 ${id} ${prix}`);
      schedules[id].phase2 = prix;
      return { ...schedules[id] };
    }));
    mockStripe.subscriptionSchedules.release.mockImplementation(async (id: string, _p: any, o: any) => idem(cles, o.idempotencyKey, () => {
      effectifs.push(`release ${id}`);
      schedules[id].status = 'released';
      attache = null;
      return { ...schedules[id] };
    }));
  });

  it('B → C → B : Stripe et la base finissent sur B', async () => {
    for (const choix of ['illimite', 'premium', 'illimite']) {
      expect(((await changer(req({ new_plan_id: choix }))) as any)._status).toBe(200);
    }
    expect(effectifs).toEqual([
      'create sub_sched_1', 'phase2 sub_sched_1 price_illimite', 'phase2 sub_sched_1 price_premium', 'phase2 sub_sched_1 price_illimite',
    ]);
    expect(schedules.sub_sched_1.phase2).toBe('price_illimite');
    expect(db.tables.box_members[0]).toMatchObject({ scheduled_plan_id: 'illimite', stripe_schedule_id: 'sub_sched_1' });
  });

  it('double clic (deux envois simultanés) : un seul appel effectif chez Stripe', async () => {
    const [a, b] = await Promise.all([changer(req({ new_plan_id: 'illimite' })), changer(req({ new_plan_id: 'illimite' }))]) as any[];
    expect([a._status, b._status]).toEqual([200, 200]);
    expect(effectifs).toEqual(['create sub_sched_1', 'phase2 sub_sched_1 price_illimite']);
    expect(db.tables.box_members[0]).toMatchObject({ scheduled_plan_id: 'illimite', stripe_schedule_id: 'sub_sched_1' });
  });

  it('annuler puis refaire le même choix : nouvel échéancier, pas la réponse rejouée de l’ancien', async () => {
    await changer(req({ new_plan_id: 'illimite' }));
    expect(((await annuler(req())) as any)._status).toBe(200);
    expect(((await changer(req({ new_plan_id: 'illimite' }))) as any)._status).toBe(200);
    expect(effectifs).toEqual([
      'create sub_sched_1', 'phase2 sub_sched_1 price_illimite', 'release sub_sched_1',
      'create sub_sched_2', 'phase2 sub_sched_2 price_illimite',
    ]);
    expect(db.tables.box_members[0]).toMatchObject({ scheduled_plan_id: 'illimite', stripe_schedule_id: 'sub_sched_2' });
  });
});
