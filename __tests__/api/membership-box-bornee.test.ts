// #470 : « Mon abonnement » borné à la box demandée (GET /api/membership/overview
// ?box_id=, POST /api/change-membership-plan/cancel { box_id }). Un membre de
// deux box : abonnement en ligne actif dans A, aucune formule dans B (plus
// récente). Sans box_id, A reste retenue comme avant. Base en mémoire, Stripe simulé.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockStripe = {
  subscriptions: { retrieve: jest.fn() },
  subscriptionSchedules: { retrieve: jest.fn(), release: jest.fn() },
  invoices: { list: jest.fn() },
  customers: { retrieve: jest.fn() },
};

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockStripe) }));
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }));
jest.mock('@/lib/auth/requestUser', () => ({ getRequestUser: jest.fn() }));

import { GET as overview } from '../../app/api/membership/overview/route';
import { POST as annuler } from '../../app/api/change-membership-plan/cancel/route';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/auth/requestUser';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const BOX_A = '11111111-1111-4111-8111-111111111111';
const BOX_B = '22222222-2222-4222-8222-222222222222';
const BOX_C = '33333333-3333-4333-8333-333333333333'; // adhésion inactive
const BOX_D = '44444444-4444-4444-8444-444444444444'; // aucune adhésion

const base = {
  member_id: 'ath-1', role: 'member', status: 'active', plan_id: null, subscription_status: null,
  stripe_subscription_id: null, subscription_current_period_end: null, subscription_cancel_at_period_end: false,
  subscription_paused: false, past_due_since: null, amount_cents: null, commitment_end_date: null,
  scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null,
};
const EN_LIGNE_A = {
  ...base, id: 'bm-a', box_id: BOX_A, joined_at: '2026-01-01', plan_id: 'mensuel', subscription_status: 'active',
  stripe_subscription_id: 'sub_1', amount_cents: 5000, scheduled_plan_id: 'illimite', stripe_schedule_id: 'sub_sched_1',
};
const SANS_FORMULE_B = { ...base, id: 'bm-b', box_id: BOX_B, joined_at: '2026-09-01' };
const INACTIVE_C = { ...base, id: 'bm-c', box_id: BOX_C, joined_at: '2026-10-01', status: 'inactive' };

let db: ReturnType<typeof fakeSupabase>;
let rpc: Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  rpc = { cancel_plan_change_request: jest.fn(async () => ({ data: true, error: null })) };
  db = fakeSupabase({
    boxes: [BOX_A, BOX_B, BOX_C, BOX_D].map((id, i) => ({
      id, name: `Box ${i + 1}`, owner_id: `owner-${i}`, stripe_account_id: `acct_${i}`,
      stripe_onboarding_complete: true, archived_at: null, archive_scheduled_at: null,
    })),
    membership_plans: [
      { id: 'mensuel', box_id: BOX_A, name: 'mensuel', description: null, price_cents: 5000, is_active: true, plan_type: 'subscription' },
      { id: 'illimite', box_id: BOX_A, name: 'illimite', description: null, price_cents: 7000, is_active: true, plan_type: 'subscription' },
    ],
    box_members: [{ ...EN_LIGNE_A }, { ...SANS_FORMULE_B }, { ...INACTIVE_C }],
    membership_cancellation_requests: [],
    box_plan_change_requests: [],
  }, rpc);
  (createServiceClient as jest.Mock).mockReturnValue(db.client);
  (getRequestUser as jest.Mock).mockResolvedValue({ id: 'ath-1' });
  mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', customer: null, default_payment_method: null });
  mockStripe.subscriptionSchedules.release.mockResolvedValue({ id: 'sub_sched_1', status: 'released' });
  mockStripe.invoices.list.mockResolvedValue({ data: [] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const get = (query = ''): any => ({ headers: { get: () => null }, nextUrl: new URL(`http://localhost/api/membership/overview${query}`) });
const post = (body?: unknown): any => ({
  headers: { get: () => null },
  json: body === undefined ? jest.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')) : jest.fn().mockResolvedValue(body),
});

describe('GET /api/membership/overview', () => {
  it('sans box_id : inchangé, l’adhésion avec abonnement Stripe vivant (A)', async () => {
    const res = (await overview(get())) as any;
    expect(res._status).toBe(200);
    expect(res._data).toMatchObject({ box: { id: BOX_A }, plan: { id: 'mensuel' }, mode: 'online' });
  });

  it('box_id = B : la box demandée, même avec un abonnement vivant ailleurs', async () => {
    const res = (await overview(get(`?box_id=${BOX_B}`))) as any;
    expect(res._status).toBe(200);
    expect(res._data).toMatchObject({ box: { id: BOX_B, name: 'Box 2' }, plan: null, mode: 'counter', next_billing_at: null });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('box_id = A : la box A', async () => {
    const res = (await overview(get(`?box_id=${BOX_A}`))) as any;
    expect(res._data).toMatchObject({ box: { id: BOX_A }, plan: { id: 'mensuel' } });
  });

  it.each([['adhésion inactive', BOX_C], ['aucune adhésion', BOX_D]])('box_id valide, %s → 404 comme aujourd’hui', async (_l, box) => {
    const res = (await overview(get(`?box_id=${box}`))) as any;
    expect(res._status).toBe(404);
    expect(res._data).toEqual({ error: "Tu n'as pas d'adhésion active." });
  });

  it.each(['pas-un-uuid', '', `${BOX_B}x`, "' or 1=1 --"])('box_id mal formé (%j) → 400 INVALID_BOX_ID, base non lue', async (raw) => {
    const res = (await overview(get(`?box_id=${encodeURIComponent(raw)}`))) as any;
    expect(res._status).toBe(400);
    expect(res._data.code).toBe('INVALID_BOX_ID');
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

describe('POST /api/change-membership-plan/cancel', () => {
  it.each([['corps absent', undefined], ['corps vide', {}], ['box_id null', { box_id: null }]])(
    'sans box_id (%s) : inchangé, l’échéancier de A est relâché', async (_l, body) => {
      const res = (await annuler(post(body))) as any;
      expect(res._data).toEqual({ ok: true, mode: 'online' });
      expect(mockStripe.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_1', {}, expect.objectContaining({ stripeAccount: 'acct_0' }));
      expect(rpc.cancel_plan_change_request).not.toHaveBeenCalled();
    });

  it('box_id = B : demande au comptoir annulée dans B, A intacte', async () => {
    const res = (await annuler(post({ box_id: BOX_B }))) as any;
    expect(res._data).toEqual({ ok: true, mode: 'counter' });
    expect(rpc.cancel_plan_change_request).toHaveBeenCalledWith({ p_member_id: 'ath-1', p_box_id: BOX_B });
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
    expect(db.tables.box_members[0]).toMatchObject({ stripe_schedule_id: 'sub_sched_1' });
  });

  it.each([['adhésion inactive', BOX_C], ['aucune adhésion', BOX_D]])('box_id valide, %s → PLAN_CHANGE_NOT_MEMBER, rien annulé', async (_l, box) => {
    const res = (await annuler(post({ box_id: box }))) as any;
    expect([res._status, res._data.code]).toEqual([409, 'PLAN_CHANGE_NOT_MEMBER']);
    expect(rpc.cancel_plan_change_request).not.toHaveBeenCalled();
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
  });

  it.each(['pas-un-uuid', '', 42, [BOX_B], { id: BOX_B }])('box_id mal formé (%j) → 400 INVALID_BOX_ID, rien annulé', async (raw) => {
    const res = (await annuler(post({ box_id: raw }))) as any;
    expect(res._status).toBe(400);
    expect(res._data.code).toBe('INVALID_BOX_ID');
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(rpc.cancel_plan_change_request).not.toHaveBeenCalled();
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
  });

  it('sans session : 401 avant toute lecture du corps', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue(null);
    expect(((await annuler(post({ box_id: 'pas-un-uuid' }))) as any)._status).toBe(401);
  });
});
