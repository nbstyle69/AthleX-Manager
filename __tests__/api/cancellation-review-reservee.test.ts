// #442 — réponse à une demande de résiliation réservée avant Stripe, l'e-mail
// et le push. Base en mémoire (vraies lignes, vraie garde gérant), Stripe et
// Resend simulés.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.RESEND_API_KEY = 're_dummy';

const mockSubUpdate = jest.fn();
const mockSubRetrieve = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    subscriptions: { update: mockSubUpdate, retrieve: mockSubRetrieve },
  })),
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createServiceClient: jest.fn(),
}));

import { POST as review } from '../../app/api/cancellation-request/review/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';
import { withPushEnv, pushesOf } from '../__fixtures__/pushEnv';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateService = createServiceClient as jest.Mock;

const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

let db: ReturnType<typeof fakeSupabase>;
let fetchSpy: jest.SpyInstance;

const emails = () => fetchSpy.mock.calls
  .filter(c => String(c[0]).includes('resend'))
  .map(c => ({ key: c[1].headers['Idempotency-Key'], ...JSON.parse(c[1].body) }));
const request = () => db.tables.membership_cancellation_requests[0];

withPushEnv();

beforeEach(() => {
  jest.clearAllMocks();
  db = fakeSupabase({
    boxes: [{ id: 'box-1', owner_id: 'owner-1', name: 'AthleX Fitness', stripe_account_id: 'acct_1', contact_email: 'salle@exemple.fr' }],
    box_members: [
      {
        id: 'bm-1', box_id: 'box-1', member_id: 'ath-1', role: 'member', status: 'active', plan_id: 'plan-1',
        stripe_subscription_id: 'sub_1', subscription_status: 'active',
        subscription_current_period_end: '2026-10-12T10:00:00Z', subscription_cancel_at_period_end: false,
        commitment_end_date: '2027-01-01',
      },
      { id: 'bm-co', box_id: 'box-1', member_id: 'coowner-1', role: 'owner', status: 'active' },
      { id: 'bm-coach', box_id: 'box-1', member_id: 'coach-1', role: 'coach', status: 'active' },
    ],
    profiles: [{ id: 'ath-1', email: 'membre@exemple.fr', username: 'cam', full_name: 'Camille Dupont' }],
    membership_plans: [{ id: 'plan-1', name: 'Illimité' }],
    membership_cancellation_requests: [{
      id: 'req-1', box_id: 'box-1', member_id: 'ath-1', status: 'pending',
      review_note: null, reviewed_by: null, reviewed_at: null,
    }],
  });
  mockCreateService.mockReturnValue(db.client);
  mockGetServerUser.mockResolvedValue({ id: 'owner-1' });
  mockSubUpdate.mockImplementation(async (id: string) => ({ id, cancel_at_period_end: true }));
  mockSubRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active', schedule: null }));
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, text: async () => '' } as any);
});
afterEach(() => fetchSpy.mockRestore());

describe('#442 — une seule réponse passe', () => {
  it('deux « Accepter » simultanés (double clic) : un seul passe, l’autre 409 ; un arrêt, un e-mail, un push', async () => {
    const [a, b]: any[] = await Promise.all([
      review(req({ request_id: 'req-1', action: 'approve' })),
      review(req({ request_id: 'req-1', action: 'approve' })),
    ]);
    expect([a._status ?? 200, b._status ?? 200].sort()).toEqual([200, 409]);
    expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    expect(emails()).toHaveLength(1);
    expect(pushesOf(fetchSpy)).toHaveLength(1);
    expect(request()).toMatchObject({ status: 'approved', reviewed_by: 'owner-1' });
  });

  it('gérant et co-gérant en même temps (Accepter / Refuser) : une seule décision, et l’e-mail dit celle qui est écrite', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'owner-1' }).mockResolvedValueOnce({ id: 'coowner-1' });
    const [a, b]: any[] = await Promise.all([
      review(req({ request_id: 'req-1', action: 'approve' })),
      review(req({ request_id: 'req-1', action: 'reject', note: 'Engagement signé' })),
    ]);
    expect([a._status ?? 200, b._status ?? 200].sort()).toEqual([200, 409]);
    const mails = emails();
    expect(mails).toHaveLength(1);
    const status = request().status;
    expect(['approved', 'rejected']).toContain(status);
    if (status === 'approved') {
      expect(mails[0].subject).toContain('est acceptée');
      expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    } else {
      expect(mails[0].subject).toContain("n'a pas pu accepter");
      expect(mockSubUpdate).not.toHaveBeenCalled();
    }
  });

  it('acceptation puis refus : le refus est refusé (409), rien n’est envoyé ni écrit', async () => {
    await review(req({ request_id: 'req-1', action: 'approve' }));
    fetchSpy.mockClear();
    mockSubUpdate.mockClear();
    const res: any = await review(req({ request_id: 'req-1', action: 'reject', note: 'Non' }));
    expect(res._status).toBe(409);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(emails()).toHaveLength(0);
    expect(pushesOf(fetchSpy)).toHaveLength(0);
    expect(request()).toMatchObject({ status: 'approved', review_note: null });
  });

  it('la réservation est conditionnelle : demande passée entre la lecture et l’écriture → 409, rien n’est envoyé', async () => {
    // Un autre gérant décide pendant que celui-ci est vérifié (lecture déjà faite).
    const from = db.client.from;
    db.client.from = jest.fn((t: string) => {
      if (t === 'boxes' && request().status === 'pending') request().status = 'rejected';
      return from(t);
    });
    const res: any = await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(res._status).toBe(409);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(emails()).toHaveLength(0);
    expect(pushesOf(fetchSpy)).toHaveLength(0);
    expect(request().status).toBe('rejected');
  });
});

describe('#442 — échec Stripe après réservation', () => {
  it('statut rendu à `pending`, aucun e-mail ni push, erreur renvoyée et journal sans donnée personnelle', async () => {
    const stripeErr = Object.assign(new Error('No such subscription: sub_1 (membre@exemple.fr)'), {
      type: 'StripeInvalidRequestError', code: 'resource_missing', statusCode: 404,
    });
    mockSubUpdate.mockRejectedValue(stripeErr);
    const res: any = await review(req({ request_id: 'req-1', action: 'approve', note: 'ok' }));
    expect(res._status).toBe(502);
    expect(res._data.error).toContain('La demande reste en attente');
    expect(request()).toMatchObject({ status: 'pending', review_note: null, reviewed_by: null, reviewed_at: null });
    expect(emails()).toHaveLength(0);
    expect(pushesOf(fetchSpy)).toHaveLength(0);
    // L'engagement n'est pas levé.
    expect(db.tables.box_members[0]).toMatchObject({ commitment_end_date: '2027-01-01', subscription_cancel_at_period_end: false });
    const logged = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(logged).toContain('resource_missing');
    expect(logged).not.toContain('membre@exemple.fr');
    expect(logged).not.toContain('sub_1');
  });

  it('le retour à `pending` ne défait que cette décision : une autre écriture entre-temps est gardée', async () => {
    // La RLS `cancel_req_update` laisse le gérant écrire la ligne sans passer par la route.
    mockSubUpdate.mockImplementation(async () => {
      request().status = 'rejected';
      throw Object.assign(new Error('boom'), { type: 'StripeAPIError' });
    });
    const res: any = await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(res._status).toBe(502);
    expect(request()).toMatchObject({ status: 'rejected', reviewed_by: 'owner-1' });
  });

  it('nouvelle tentative du gérant : le même arrêt est rejoué avec la même clé, puis e-mail et push partent', async () => {
    mockSubUpdate.mockRejectedValueOnce(Object.assign(new Error('boom'), { type: 'StripeAPIError' }));
    await review(req({ request_id: 'req-1', action: 'approve' }));
    const res: any = await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(res._data).toEqual({ ok: true });
    expect(mockSubUpdate.mock.calls.map(c => c[2].idempotencyKey)).toEqual(['review:req-1', 'review:req-1']);
    expect(emails()).toHaveLength(1);
    expect(pushesOf(fetchSpy)).toHaveLength(1);
    expect(request().status).toBe('approved');
  });
});

describe('#442 — clés d’idempotence tirées de la demande, jamais de l’heure', () => {
  it('Stripe et Resend reçoivent `review:<request_id>`', async () => {
    await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true },
      { stripeAccount: 'acct_1', idempotencyKey: 'review:req-1' });
    expect(emails().map(m => m.key)).toEqual(['review:req-1']);
  });
});

describe('#442 — droits inchangés', () => {
  it.each([['coach', 'coach-1'], ['membre', 'ath-1']])('un %s ne peut pas répondre : 403, demande intacte', async (_r, uid) => {
    mockGetServerUser.mockResolvedValue({ id: uid });
    const res: any = await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(res._status).toBe(403);
    expect(request()).toMatchObject({ status: 'pending', reviewed_by: null });
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(emails()).toHaveLength(0);
  });

  it('le co-gérant peut répondre', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coowner-1' });
    const res: any = await review(req({ request_id: 'req-1', action: 'reject' }));
    expect(res._data).toEqual({ ok: true });
    expect(request()).toMatchObject({ status: 'rejected', reviewed_by: 'coowner-1' });
  });
});
