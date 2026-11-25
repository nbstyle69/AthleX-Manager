// #461 PR 3 — paiement « au prix de l'offre » : route create-programming-checkout
// (invitation relue côté serveur, offre « sur invitation », expiration de la
// session) et webhook Connect (abonnement lié à l'invitation, invitation
// acceptée une seule fois). Faux Stripe et fausse base : un faux ne prouve pas
// ce que Stripe accepte (expires_at est vérifié en mode test par Nab).

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockStripeCalls: { path: string; args: any[] }[] = [];
const mockConstructEvent = jest.fn();
const mockDeep = (path: string): any => new Proxy(function stripeFn() { /* appelable */ }, {
  get: (_t, k) => {
    if (k === 'then') return undefined;
    if (path === 'stripe.webhooks' && k === 'constructEvent') return mockConstructEvent;
    return mockDeep(`${path}.${String(k)}`);
  },
  apply: (_t, _this, args) => { mockStripeCalls.push({ path, args }); return Promise.resolve({ id: 'x', url: 'https://stripe.test/x', data: [] }); },
});
jest.mock('stripe', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockDeep('stripe')) }));

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn(), createClient: jest.fn() }));
jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn().mockResolvedValue(true) }));

import { createServiceClient, createClient } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';
import { POST as checkout } from '../../app/api/create-programming-checkout/route';
import { POST as webhook } from '../../app/api/stripe-connect-webhook/route';
import { OFFER_RESERVED_MESSAGE, INVITATION_TOO_SOON_MESSAGE } from '@/lib/programmingInvitations';

const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body), headers: new Map(), url: 'http://x/api' });
const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

let db: ReturnType<typeof fakeSupabase>;

function setup(opts: { visibility?: string; inv?: Record<string, any> } = {}) {
  db = fakeSupabase({
    boxes: [
      { id: 'pub', name: 'Box A', stripe_account_id: 'acct_pub', stripe_onboarding_complete: true, archived_at: null, archive_scheduled_at: null },
      { id: 'b1', name: 'Box B', archived_at: null, archive_scheduled_at: null },
      { id: 'b2', name: 'Box C', archived_at: null, archive_scheduled_at: null },
    ],
    box_programming: [{
      id: 'off', publisher_box_id: 'pub', title: 'Offre', description: null, price_cents: 2900, currency: 'eur',
      billing: 'monthly', is_published: true, visibility: opts.visibility ?? 'invitation', stripe_product_id: 'prod', stripe_price_id: 'price',
    }],
    box_programming_subscriptions: [],
    box_programming_invitations: [{
      id: 'inv', programming_id: 'off', invited_box_id: 'b1', pricing: 'offer_price', status: 'pending',
      expires_at: inMin(14 * 24 * 60), ...opts.inv,
    }],
  });
  (createServiceClient as jest.Mock).mockReturnValue(db.client);
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'owner', email: null } } }) } });
  mockStripeCalls.length = 0;
}

const sessionCreate = () => mockStripeCalls.find((c) => c.path === 'stripe.checkout.sessions.create');

describe('create-programming-checkout avec invitation', () => {
  it('invitation valable : session avec invitation_id et expires_at', async () => {
    setup();
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1', invitation_id: 'inv' }));
    expect(res.status).toBe(200);
    const params = sessionCreate()!.args[0];
    expect(params.metadata.invitation_id).toBe('inv');
    expect(params.subscription_data.metadata.invitation_id).toBe('inv');
    const max = Math.floor(Date.now() / 1000) + 24 * 3600;
    expect(params.expires_at).toBeGreaterThan(max - 60);
    expect(params.expires_at).toBeLessThanOrEqual(max);
  });

  it('invitation expirée : 409, aucun appel Stripe', async () => {
    setup({ inv: { expires_at: inMin(-1) } });
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1', invitation_id: 'inv' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Cette invitation a expiré.');
    expect(mockStripeCalls).toHaveLength(0);
  });

  it('invitation d’une autre box : 409', async () => {
    setup();
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b2', invitation_id: 'inv' }));
    expect(res.status).toBe(409);
    expect(mockStripeCalls).toHaveLength(0);
  });

  it('invitation « Offerte » : 409 (elle s’accepte sans paiement)', async () => {
    setup({ inv: { pricing: 'offered' } });
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1', invitation_id: 'inv' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/sans paiement/);
    expect(mockStripeCalls).toHaveLength(0);
  });

  it('invitation qui expire dans 30 min : 409 « trop tôt »', async () => {
    setup({ inv: { expires_at: inMin(30) } });
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1', invitation_id: 'inv' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(INVITATION_TOO_SOON_MESSAGE);
    expect(mockStripeCalls).toHaveLength(0);
  });

  it('offre « sur invitation » sans invitation : 403 avant de payer', async () => {
    setup();
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(OFFER_RESERVED_MESSAGE);
    expect(mockStripeCalls).toHaveLength(0);
  });

  it('non gérant de la box : 403, invitation non lue', async () => {
    setup();
    (isBoxOwnerAdmin as jest.Mock).mockResolvedValueOnce(false);
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1', invitation_id: 'inv' }));
    expect(res.status).toBe(403);
    expect(db.reads.some((r) => r.table === 'box_programming_invitations')).toBe(false);
  });

  it('offre au catalogue sans invitation : inchangé (ni invitation_id ni expires_at)', async () => {
    setup({ visibility: 'catalogue' });
    const res = await checkout(req({ programming_id: 'off', subscriber_box_id: 'b1' }));
    expect(res.status).toBe(200);
    const params = sessionCreate()!.args[0];
    expect(params.metadata.invitation_id).toBeUndefined();
    expect(params.expires_at).toBeUndefined();
  });
});

describe('webhook Connect, kind box_programming avec invitation', () => {
  const event = (md: Record<string, string>) => ({
    type: 'checkout.session.completed', account: 'acct_pub',
    data: { object: { id: 'cs_1', customer: 'cus_1', subscription: 'sub_1', metadata: {
      kind: 'box_programming', programming_id: 'off', subscriber_box_id: 'b1', created_by: 'owner', ...md,
    } } },
  });
  const whReq = (): any => ({ headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig' : null) }, text: jest.fn().mockResolvedValue('{}') });

  it('abonnement lié à l’invitation, invitation acceptée ; un rejeu ne réécrit rien', async () => {
    setup();
    mockConstructEvent.mockReturnValue(event({ invitation_id: 'inv' }));
    expect((await webhook(whReq())).status).toBe(200);
    const sub = db.tables.box_programming_subscriptions[0];
    expect(sub).toMatchObject({ programming_id: 'off', subscriber_box_id: 'b1', status: 'active', invitation_id: 'inv' });
    const inv = db.tables.box_programming_invitations[0];
    expect(inv).toMatchObject({ status: 'accepted', subscription_id: sub.id });
    const first = inv.responded_at;
    expect(first).toEqual(expect.any(String));

    // Rejeu : l'invitation n'attend plus, la mise à jour conditionnelle ne touche rien.
    inv.responded_at = 'premier';
    expect((await webhook(whReq())).status).toBe(200);
    expect(db.tables.box_programming_invitations[0]).toMatchObject({ status: 'accepted', responded_at: 'premier', subscription_id: sub.id });
  });

  it('invitation d’une autre box dans les métadonnées : rien n’est accepté', async () => {
    setup({ inv: { invited_box_id: 'b2' } });
    mockConstructEvent.mockReturnValue(event({ invitation_id: 'inv' }));
    expect((await webhook(whReq())).status).toBe(200);
    expect(db.tables.box_programming_invitations[0].status).toBe('pending');
  });

  it('sans invitation : upsert inchangé, aucune écriture sur les invitations', async () => {
    setup();
    mockConstructEvent.mockReturnValue(event({}));
    expect((await webhook(whReq())).status).toBe(200);
    expect(db.tables.box_programming_subscriptions[0].invitation_id).toBeUndefined();
    expect(db.writes.some((w) => w.table === 'box_programming_invitations')).toBe(false);
  });
});
