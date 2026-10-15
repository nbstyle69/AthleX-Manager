// A2 (#438) — les deux webhooks Stripe répondent 500 dès qu'une requête
// Supabase (écriture, RPC, lecture qui pilote une écriture) renvoie une
// erreur, pour que Stripe rejoue l'événement. Pour chaque événement traité :
// un passage nominal (200) fixe la liste exacte des requêtes, puis chaque
// requête de cette liste est mise en échec à son tour → 500.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockConstructEvent = jest.fn();
const mockRetrieve = jest.fn();
const mockCancel = jest.fn().mockResolvedValue({ status: 'canceled' });

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const { withAccount, rereadFromEvent } = require('../__fixtures__/stripeRelu');
    return {
      webhooks: { constructEvent: withAccount(mockConstructEvent) },
      subscriptions: {
        retrieve: (id: string, ...rest: any[]) => rereadFromEvent(mockConstructEvent, () => mockRetrieve(id, ...rest))(id),
        cancel: mockCancel,
      },
    };
  }),
}));

// ── Faux Supabase : chaque requête attendue est notée `table.op` (ou
// `rpc.nom`). `failAt` met la n-ième en erreur ; `rows` donne les données
// renvoyées (un tableau = une valeur par appel, dans l'ordre).
let ops: string[];
let failAt: number | null;
let failCode: string;
let rows: Record<string, any>;

function settle(label: string) {
  const i = ops.push(label) - 1;
  if (i === failAt) return { data: null, error: { message: 'panne simulée', code: failCode } };
  const r = rows[label];
  return { data: r?.__queue ? r.shift() : r ?? null, error: null };
}

function from(table: string) {
  let op: string | null = null;
  const b: any = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete']) {
    b[m] = () => { op ??= m; return b; };
  }
  for (const m of ['eq', 'neq', 'is', 'ilike', 'in', 'order']) b[m] = () => b;
  b.maybeSingle = () => Promise.resolve(settle(`${table}.${op}`));
  b.then = (res: any, rej: any) => Promise.resolve(settle(`${table}.${op}`)).then(res, rej);
  return b;
}

const rpc = (name: string) => Promise.resolve(settle(`rpc.${name}`));

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from, rpc })),
}));

import { POST as platformPOST } from '../../app/api/stripe-webhook/route';
import { POST as connectPOST } from '../../app/api/stripe-connect-webhook/route';

const req = (): any => ({
  headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig_dummy' : null) },
  text: jest.fn().mockResolvedValue('{}'),
});

/** Une valeur par appel successif (sinon la même valeur à chaque appel). */
const queue = (...values: any[]) => Object.assign(values, { __queue: true });

// Identifiants au format uuid et e-mail réel : le test des journaux vérifie
// qu'ils ne sortent jamais.
const USER = '11111111-1111-4111-8111-111111111111';
const BOX = '22222222-2222-4222-8222-222222222222';
const PLAN = '33333333-3333-4333-8333-333333333333';
const EMAIL = 'membre@exemple.fr';

interface Scenario {
  name: string;
  post: (r: any) => Promise<any>;
  event: any;
  rows?: Record<string, any>;
  ops: string[];
}

const checkout = (metadata: Record<string, string>, extra: Record<string, unknown> = {}) => ({
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_test_1', customer: 'cus_1', subscription: 'sub_1', payment_intent: 'pi_1', customer_details: { email: EMAIL }, metadata, ...extra } },
});

const SCENARIOS: Scenario[] = [
  // ── Plateforme ──
  { name: 'plateforme checkout Multi', post: platformPOST,
    event: checkout({ owner_subscription: '1', supabase_owner_id: USER, box_quota: '3' }),
    ops: ['owner_subscriptions.upsert'] },
  { name: 'plateforme checkout box', post: platformPOST,
    event: checkout({ box_id: BOX }),
    ops: ['box_subscriptions.upsert'] },
  { name: 'plateforme customer.subscription.updated', post: platformPOST,
    event: { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: 1800000000 } } },
    ops: ['box_subscriptions.update', 'owner_subscriptions.update'] },
  { name: 'plateforme customer.subscription.deleted', post: platformPOST,
    event: { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1' } } },
    ops: ['box_subscriptions.update', 'owner_subscriptions.update'] },
  { name: 'plateforme invoice.payment_failed', post: platformPOST,
    event: { type: 'invoice.payment_failed', data: { object: { customer: 'cus_1' } } },
    ops: ['box_subscriptions.update', 'owner_subscriptions.update'] },
  { name: 'plateforme invoice.paid', post: platformPOST,
    event: { type: 'invoice.paid', data: { object: { customer: 'cus_1' } } },
    ops: ['box_subscriptions.update', 'owner_subscriptions.update'] },

  // ── Connect ──
  { name: 'connect checkout membership (membre existant, invitation)', post: connectPOST,
    event: checkout({ kind: 'membership', plan_id: PLAN, box_id: BOX, user_id: USER, invitation_id: 'inv-1' }),
    rows: {
      'profiles.select': { id: USER }, 'box_members.select': { id: 'bm-1' }, 'box_members.update': [{ id: 'bm-1' }],
      'rpc.box_invitation_activation_permise': { permise: true, raison: 'PENDING_PAYMENT' },
      'rpc.accept_box_invitation_after_payment': { ok: true },
    },
    ops: ['profiles.select', 'rpc.box_invitation_activation_permise', 'box_members.select', 'box_members.update', 'rpc.accept_box_invitation_after_payment'] },
  { name: 'connect checkout membership (nouvelle ligne)', post: connectPOST,
    event: checkout({ kind: 'membership', plan_id: PLAN, box_id: BOX }),
    rows: { 'profiles.select': { id: USER } },
    ops: ['profiles.select', 'box_members.select', 'box_members.insert'] },
  { name: 'connect checkout membership (sans compte → attente)', post: connectPOST,
    event: checkout({ kind: 'membership', plan_id: PLAN, box_id: BOX }),
    ops: ['profiles.select', 'pending_entitlements.insert'] },
  { name: 'connect checkout credit', post: connectPOST,
    event: checkout({ kind: 'credit', box_id: BOX, plan_id: PLAN, credits: '10', validity_days: '30' }),
    rows: { 'profiles.select': { id: USER } },
    ops: ['profiles.select', 'member_class_credits.insert'] },
  { name: 'connect checkout box_programming', post: connectPOST,
    event: checkout({ kind: 'box_programming', programming_id: PLAN, subscriber_box_id: BOX }),
    ops: ['box_programming_subscriptions.upsert'] },
  { name: 'connect checkout program', post: connectPOST,
    event: checkout({ kind: 'program', program_id: PLAN }),
    rows: { 'profiles.select': { id: USER } },
    ops: ['profiles.select', 'rpc.join_program'] },
  { name: 'connect customer.subscription.deleted', post: connectPOST,
    event: { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } },
    rows: { 'box_programming_subscriptions.select': [{ id: 'bps-1' }, { id: 'bps-2' }] },
    ops: ['program_members.update', 'box_programming_subscriptions.select',
      'rpc.unsubscribe_programming', 'rpc.unsubscribe_programming',
      'box_programming_subscriptions.update', 'box_members.update', 'box_members.update'] },
  { name: 'connect customer.subscription.updated (past_due, formule par le prix)', post: connectPOST,
    event: { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'past_due', items: { data: [{ price: { id: 'price_1' } }] } } } },
    rows: { 'membership_plans.select': { id: PLAN, price_cents: 5000 }, 'box_members.update': [] },
    ops: ['program_members.update', 'box_programming_subscriptions.update', 'membership_plans.select',
      'box_members.update', 'box_members.update', 'box_members.update'] },
  { name: 'connect invoice.payment_failed', post: connectPOST,
    event: { type: 'invoice.payment_failed', id: 'evt_1', data: { object: { id: 'in_1', subscription: 'sub_1' } } },
    rows: { 'box_members.select': { id: 'bm-1', past_due_since: null, dunning_attempts: 0 } },
    ops: ['box_members.select', 'box_members.update'] },
  { name: 'connect invoice.paid', post: connectPOST,
    event: { type: 'invoice.paid', id: 'evt_1', data: { object: { id: 'in_1', subscription: 'sub_1' } } },
    ops: ['box_members.update'] },
  { name: 'connect charge.refunded', post: connectPOST,
    event: { type: 'charge.refunded', data: { object: { payment_intent: 'pi_1' } } },
    ops: ['program_members.update', 'member_class_credits.update'] },
  { name: 'connect subscription_schedule.released', post: connectPOST,
    event: { type: 'subscription_schedule.released', data: { object: { id: 'sub_sched_1' } } },
    ops: ['box_members.update'] },
  // Comptoir P1, PR 5b : activation refusée (invitation révoquée) → abonnement
  // annulé chez Stripe, arrêt journalisé ; aucune écriture sur l'adhésion.
  { name: 'connect checkout membership (invitation refusée)', post: connectPOST,
    event: { ...checkout({ kind: 'membership', plan_id: PLAN, box_id: BOX, user_id: USER, invitation_id: 'inv-1' }), account: 'acct_1' },
    rows: {
      'profiles.select': { id: USER }, 'box_members.select': { id: 'bm-1' }, 'boxes.select': { owner_id: USER },
      'rpc.box_invitation_activation_permise': { permise: false, raison: 'REVOKED' },
    },
    ops: ['profiles.select', 'rpc.box_invitation_activation_permise', 'box_members.select', 'boxes.select', 'box_member_subscription_actions.insert'] },
];

let logs: string[];

beforeEach(() => {
  jest.clearAllMocks();
  ops = [];
  failAt = null;
  rows = {};
  logs = [];
  mockRetrieve.mockResolvedValue({ status: 'active', current_period_end: 1800000000, trial_end: null });
  for (const level of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')); });
  }
});

afterEach(() => jest.restoreAllMocks());

function run(s: Scenario, fail: number | null = null, code = 'XX000') {
  ops = [];
  failAt = fail;
  failCode = code;
  rows = Object.fromEntries(Object.entries(s.rows ?? {}).map(([k, v]) => [k, v?.__queue ? queue(...v) : v]));
  mockConstructEvent.mockReturnValue(s.event);
  return s.post(req());
}

/** Aucune donnée personnelle ni identifiant de base dans les journaux. */
function expectCleanLogs() {
  const all = logs.join('\n');
  expect(all).not.toMatch(/[^\s@]+@[^\s@]+\.[a-z]+/i);
  expect(all).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
}

describe.each(SCENARIOS)('$name', (s) => {
  it('toutes les requêtes passent → 200', async () => {
    const res = await run(s);
    expect(res._status).toBe(200);
    expect(ops).toEqual(s.ops);
    expectCleanLogs();
  });

  it.each(s.ops.map((label, i) => [i, label]))('requête %i (%s) en erreur → 500', async (i) => {
    const res = await run(s, i as number);
    expect(res._status).toBe(500);
    expect(res._data).toEqual({ error: 'Webhook processing failed' });
    expectCleanLogs();
  });
});

// ── Lectures : seule l'erreur fait 500, un résultat vide garde le
// comportement d'avant ──────────────────────────────────────────────

describe('lecture vide : comportement inchangé, 200', () => {
  it('resolveUserId (L64) sans compte → achat mis en attente', async () => {
    const res = await run(SCENARIOS.find((x) => x.name.includes('sans compte'))!);
    expect(res._status).toBe(200);
    expect(ops).toEqual(['profiles.select', 'pending_entitlements.insert']);
  });

  it('profil de la metadata (L95) inconnu → repli sur l’e-mail vérifié', async () => {
    const res = await run({
      name: 'x', post: connectPOST, ops: [],
      event: checkout({ kind: 'program', program_id: PLAN, user_id: USER }),
      rows: { 'profiles.select': queue(null, { id: USER }) },
    });
    expect(res._status).toBe(200);
    expect(ops).toEqual(['profiles.select', 'profiles.select', 'rpc.join_program']);
  });

  it('adhésion existante (L214) absente → insert', async () => {
    const res = await run(SCENARIOS.find((x) => x.name.includes('nouvelle ligne'))!);
    expect(res._status).toBe(200);
    expect(ops).toContain('box_members.insert');
  });

  it('abonnements programmation (L560) absents → aucune RPC, la suite s’exécute', async () => {
    const s = SCENARIOS.find((x) => x.name === 'connect customer.subscription.deleted')!;
    const res = await run({ ...s, rows: { 'box_programming_subscriptions.select': [] } });
    expect(res._status).toBe(200);
    expect(ops).toEqual(['program_members.update', 'box_programming_subscriptions.select',
      'box_programming_subscriptions.update', 'box_members.update', 'box_members.update']);
  });

  it('formule introuvable par le prix (L632) → ni formule ni bascule', async () => {
    const s = SCENARIOS.find((x) => x.name.includes('formule par le prix'))!;
    const res = await run({ ...s, rows: { 'membership_plans.select': null } });
    expect(res._status).toBe(200);
    expect(ops).toEqual(['program_members.update', 'box_programming_subscriptions.update', 'membership_plans.select',
      'box_members.update', 'box_members.update']);
  });

  it('adhérent introuvable (L712) → aucune écriture', async () => {
    const s = SCENARIOS.find((x) => x.name === 'connect invoice.payment_failed')!;
    const res = await run({ ...s, rows: {} });
    expect(res._status).toBe(200);
    expect(ops).toEqual(['box_members.select']);
  });
});

describe('cas particuliers', () => {
  it('C8 : un échec de unsubscribe_programming n’arrête pas la boucle, puis 500', async () => {
    const s = SCENARIOS.find((x) => x.name === 'connect customer.subscription.deleted')!;
    const res = await run(s, 2); // première RPC
    expect(res._status).toBe(500);
    expect(ops.filter((o) => o === 'rpc.unsubscribe_programming')).toHaveLength(2);
    expect(ops).not.toContain('box_programming_subscriptions.update');
  });

  it('C1 : refus métier de l’invitation (ok: false) → journalisé, 200', async () => {
    const s = SCENARIOS[6];
    const res = await run({ ...s, rows: { ...s.rows, 'rpc.accept_box_invitation_after_payment': { ok: false, reason: 'EMAIL_MISMATCH' } } });
    expect(res._status).toBe(200);
    expect(logs.join('\n')).toContain('EMAIL_MISMATCH');
  });

  it('rejeu d’un paiement déjà déposé en attente (23505) → 200', async () => {
    const s = SCENARIOS.find((x) => x.name.includes('sans compte'))!;
    const res = await run(s, 1, '23505');
    expect(res._status).toBe(200);
  });

  it('rejeu d’un achat de crédits déjà traité (23505) → 200', async () => {
    const s = SCENARIOS.find((x) => x.name === 'connect checkout credit')!;
    const res = await run(s, 1, '23505');
    expect(res._status).toBe(200);
  });

  it('les erreurs de base journalisées passent par logStripeError, sans donnée personnelle', async () => {
    await run(SCENARIOS[6], 3);
    expect(logs.join('\n')).toContain('stripe-connect-webhook error');
    expect(logs.join('\n')).toContain('box_members.write_membership');
    expectCleanLogs();
  });
});
