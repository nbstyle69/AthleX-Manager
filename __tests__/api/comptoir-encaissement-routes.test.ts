// Comptoir P1, PR 5 — routes serveur : lecture des fins d'accès pour Abonnés
// (GET /api/members/counter-access) et réglage du renouvellement au comptoir
// (/api/box/counter-renewal). Gérant ou co-gérant seulement, clé serveur.
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

let fake: ReturnType<typeof fakeSupabase>;
let user: { id: string } | null;
let activeBox: { id: string } | null;

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fake.client,
  createClient: async () => ({}),
  getServerUser: async () => user,
  getActiveBox: async () => activeBox,
}));

import { GET as readAccess } from '../../app/api/members/counter-access/route';
import { GET as readRenewal, POST as writeRenewal } from '../../app/api/box/counter-renewal/route';

const getReq = (boxId: string): any => ({ nextUrl: new URL(`https://x.test/api/members/counter-access?box_id=${boxId}`) });
const postReq = (body: unknown): any => ({ json: async () => body });

function seed() {
  return fakeSupabase({
    boxes: [
      { id: 'box-1', owner_id: 'gerant', allow_counter_renewal: false, stripe_account_id: 'acct_1', stripe_onboarding_complete: true },
      { id: 'box-2', owner_id: 'autre', allow_counter_renewal: true, stripe_account_id: null, stripe_onboarding_complete: false },
    ],
    membership_plans: [
      { id: 'p49', box_id: 'box-1', price_cents: 4900, is_active: true, stripe_price_id: 'price_1' },
      { id: 'p0', box_id: 'box-1', price_cents: 0, is_active: true, stripe_price_id: null },
    ],
    box_members: [
      { id: 'bm-co', box_id: 'box-1', member_id: 'cogerant', role: 'owner', status: 'active' },
      { id: 'bm-coach', box_id: 'box-1', member_id: 'coach', role: 'coach', status: 'active' },
      { id: 'bm-leo', box_id: 'box-1', member_id: 'leo', role: 'member', status: 'active', joined_at: '2026-01-20T10:00:00Z', plan_id: 'p49',
        subscription_status: 'active', payment_method_type: 'cash', stripe_subscription_id: null, cash_access_until: '2026-10-20' },
      { id: 'bm-zoe', box_id: 'box-1', member_id: 'zoe', role: 'member', status: 'inactive', joined_at: '2026-10-09T10:00:00Z', plan_id: 'p49',
        subscription_status: 'pending_cash', payment_method_type: 'cash', stripe_subscription_id: null, cash_access_until: null },
      { id: 'bm-web', box_id: 'box-1', member_id: 'web', role: 'member', status: 'active', joined_at: '2026-05-01T10:00:00Z', plan_id: 'p49',
        subscription_status: 'active', payment_method_type: 'card', stripe_subscription_id: 'sub_1', cash_access_until: null },
    ],
    // Le faux ignore le tri : l'ordre ci-dessous éprouve les filtres de la route
    // (message pas encore parti, message d'une fin d'accès précédente).
    box_member_access_notices: [
      { box_id: 'box-1', box_member_id: 'bm-leo', kind: 'j1', access_until: '2026-10-20', sent_at: null },
      { box_id: 'box-1', box_member_id: 'bm-leo', kind: 'fin', access_until: '2026-09-20', sent_at: '2026-09-21T07:41:00Z' },
      { box_id: 'box-1', box_member_id: 'bm-leo', kind: 'j7', access_until: '2026-10-20', sent_at: '2026-10-13T07:41:00Z' },
    ],
    box_cash_payments: [
      { box_id: 'box-1', member_id: 'leo', source: 'renewal' },
      { box_id: 'box-1', member_id: 'zoe', source: 'program' },
    ],
    box_invitations: [
      { id: 'inv-zoe', box_id: 'box-1', accepted_by: 'zoe', payment_mode: 'box', cash_collected: false, created_at: '2026-10-06T09:00:00Z' },
      { id: 'inv-old', box_id: 'box-1', accepted_by: 'leo', payment_mode: 'box', cash_collected: true, created_at: '2026-01-10T09:00:00Z' },
    ],
  });
}

beforeEach(() => {
  fake = seed();
  user = { id: 'gerant' };
  activeBox = { id: 'box-1' };
});

describe('GET /api/members/counter-access : droits', () => {
  it('gérant : 200', async () => {
    expect(((await readAccess(getReq('box-1'))) as any)._status).toBe(200);
  });
  it('co-gérant : 200', async () => {
    user = { id: 'cogerant' };
    expect(((await readAccess(getReq('box-1'))) as any)._status).toBe(200);
  });
  it('coach : 403, rien lu au-delà du contrôle', async () => {
    user = { id: 'coach' };
    const res = (await readAccess(getReq('box-1'))) as any;
    expect(res._status).toBe(403);
    expect(fake.reads.map((r) => r.table)).not.toContain('box_member_access_notices');
  });
  it('gérant d’une autre box : 403', async () => {
    expect(((await readAccess(getReq('box-2'))) as any)._status).toBe(403);
  });
  it('sans session : 401 ; sans box_id : 400', async () => {
    expect(((await readAccess(getReq(''))) as any)._status).toBe(400);
    user = null;
    expect(((await readAccess(getReq('box-1'))) as any)._status).toBe(401);
  });
});

describe('GET /api/members/counter-access : contenu', () => {
  it('fin d’accès, prix, dernier message parti pour la fin en cours, invitation à encaisser, réglage et vente en ligne', async () => {
    const { _data } = (await readAccess(getReq('box-1'))) as any;
    expect(_data.box).toEqual({ allow_counter_renewal: false, sells_online: true });
    expect(_data.members.map((m: any) => m.box_member_id)).toEqual(['bm-leo', 'bm-zoe', 'bm-web']);
    const [leo, zoe, web] = _data.members;
    expect(leo).toEqual(expect.objectContaining({
      cash_access_until: '2026-10-20', subscription_status: 'active', payment_method_type: 'cash',
      has_stripe_subscription: false, plan_id: 'p49', price_cents: 4900, has_counter_period: true,
      last_notice: { kind: 'j7', sent_at: '2026-10-13T07:41:00Z' }, pending_invitation: null,
    }));
    // Un encaissement de programme n'est pas une période d'adhésion.
    expect(zoe).toEqual(expect.objectContaining({
      has_counter_period: false, last_notice: null, pending_invitation: { id: 'inv-zoe', created_at: '2026-10-06T09:00:00Z' },
    }));
    expect(web.has_stripe_subscription).toBe(true);
    expect(JSON.stringify(_data)).not.toContain('sub_1');
  });

  it('lecture en échec : 500 sans donnée de membre dans le journal', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const from = fake.client.from;
    fake.client.from = jest.fn((t: string) => {
      const c = from(t);
      if (t !== 'box_member_access_notices') return c;
      c.then = (res: any) => Promise.resolve({ data: null, error: { code: '42501', message: 'refus leo@exemple.fr' } }).then(res);
      return c;
    });
    const res = (await readAccess(getReq('box-1'))) as any;
    expect(res._status).toBe(500);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/leo|exemple/);
    spy.mockRestore();
  });
});

describe('/api/box/counter-renewal', () => {
  it('lecture : réglage et vente en ligne', async () => {
    const { _data } = (await readRenewal()) as any;
    expect(_data).toEqual({ allow_counter_renewal: false, sells_online: true });
  });

  it('gérant et co-gérant écrivent la seule ligne de leur box', async () => {
    let res = (await writeRenewal(postReq({ allow_counter_renewal: true }))) as any;
    expect(res._status).toBe(200);
    expect(res._data).toEqual({ allow_counter_renewal: true });
    expect(fake.writes).toEqual([{ table: 'boxes', op: 'update', values: { allow_counter_renewal: true }, match: { id: 'box-1' } }]);
    user = { id: 'cogerant' };
    res = (await writeRenewal(postReq({ allow_counter_renewal: false }))) as any;
    expect(res._status).toBe(200);
    expect(fake.tables.boxes.find((b) => b.id === 'box-2')!.allow_counter_renewal).toBe(true);
  });

  it('coach, autre box, sans session : refusés, rien écrit', async () => {
    user = { id: 'coach' };
    expect(((await writeRenewal(postReq({ allow_counter_renewal: true }))) as any)._status).toBe(403);
    user = { id: 'autre' };
    expect(((await writeRenewal(postReq({ allow_counter_renewal: true }))) as any)._status).toBe(403);
    user = null;
    expect(((await writeRenewal(postReq({ allow_counter_renewal: true }))) as any)._status).toBe(401);
    expect(((await readRenewal()) as any)._status).toBe(401);
    expect(fake.writes).toEqual([]);
  });

  it('valeur non booléenne : 400, rien écrit', async () => {
    for (const v of ['true', 1, null, undefined]) {
      expect(((await writeRenewal(postReq({ allow_counter_renewal: v }))) as any)._status).toBe(400);
    }
    expect(fake.writes).toEqual([]);
  });
});
