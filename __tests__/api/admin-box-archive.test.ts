// Tests pour app/api/admin/boxes/[id]/archive et .../deletion

const makeChain = (result: any = { data: null, error: null }) => {
  const c: any = {};
  for (const m of ['select', 'update', 'delete', 'eq', 'neq', 'not', 'is']) c[m] = jest.fn(() => c);
  c.single = jest.fn().mockResolvedValue(result);
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.then = (resolve: Function) => Promise.resolve(result).then(resolve as any);
  return c;
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
  getServerUser: jest.fn(),
  createClient: jest.fn(),
}));

import { PATCH } from '../../app/api/admin/boxes/[id]/archive/route';
import { DELETE, GET } from '../../app/api/admin/boxes/[id]/deletion/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateServiceClient = createServiceClient as jest.Mock;

const BOX = 'box-fantome';
const NOM = 'Crossfit lyon';
const params = { params: Promise.resolve({ id: BOX }) };
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body), url: 'http://x/api' });

/** Premier client = contrôle du rôle. Les suivants = le travail. */
function role(r: string) {
  mockGetServerUser.mockResolvedValue({ id: 'admin-1' });
  mockCreateServiceClient.mockReturnValueOnce({ from: jest.fn(() => makeChain({ data: { role: r } })) });
}

/**
 * Client de service pour les routes de suppression : chaque table rend le
 * compte demandé, `boxes` rend la box, `box_members` et `box_subscriptions`
 * servent aux deux exceptions (gérant seul, essai sans Stripe).
 */
function service({ counts = {}, otherMembers = 0, stripeSubs = 0, deleteError = null as any }: {
  counts?: Record<string, number>; otherMembers?: number; stripeSubs?: number; deleteError?: any;
}) {
  const del = makeChain({ data: null, error: deleteError });
  const from = jest.fn((table: string) => {
    if (table === 'boxes') {
      const c = makeChain({ data: { id: BOX, name: NOM, owner_id: 'owner-1' }, error: null });
      c.delete = jest.fn(() => del);
      return c;
    }
    if (table === 'box_members') {
      const c = makeChain({ data: null, count: counts.box_members ?? 0, error: null });
      // `neq(member_id, owner)` = les membres AUTRES que le gérant.
      c.neq = jest.fn(() => makeChain({ data: null, count: otherMembers, error: null }));
      return c;
    }
    if (table === 'box_subscriptions') {
      const c = makeChain({ data: null, count: 0, error: null });
      c.not = jest.fn(() => makeChain({ data: null, count: stripeSubs, error: null }));
      return c;
    }
    return makeChain({ data: null, count: counts[table] ?? 0, error: null });
  });
  return { from, _del: del };
}

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/admin/boxes/[id]/archive', () => {
  it('refuse un simple admin : archiver coupe l’accès de tous les membres', async () => {
    role('admin');
    const res: any = await PATCH(req({ archived: true }), params);
    expect(res._status).toBe(403);
  });

  it('refuse un visiteur', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const res: any = await PATCH(req({ archived: true }), params);
    expect(res._status).toBe(403);
  });

  it('refuse un corps sans booléen', async () => {
    role('super_admin');
    const res: any = await PATCH(req({ archived: 'oui' }), params);
    expect(res._status).toBe(400);
  });

  // Archivage PR 2 : archiver passe par archive-schedule, qui arrête d'abord
  // les abonnements Stripe. Le PATCH direct laisserait prélever une box archivée.
  it('refuse d’archiver directement (409), sans rien écrire', async () => {
    role('super_admin');
    const boxes = makeChain({ data: null, error: null });
    mockCreateServiceClient.mockReturnValue({ from: jest.fn(() => boxes) });

    const res: any = await PATCH(req({ archived: true }), params);
    expect(res._status).toBe(409);
    expect((await res.json()).error).toContain('programmation de l’archivage');
    expect(boxes.update).not.toHaveBeenCalled();
    mockCreateServiceClient.mockReset();
  });

  it('réactive en remettant les deux colonnes à null', async () => {
    role('super_admin');
    const boxes = makeChain({ data: { id: BOX, name: NOM, archived_at: null }, error: null });
    mockCreateServiceClient.mockReturnValueOnce({ from: jest.fn(() => boxes) });

    await PATCH(req({ archived: false }), params);
    expect(boxes.update.mock.calls[0][0]).toEqual({ archived_at: null, archived_by: null });
  });

  it('dit que la migration manque plutôt que de rendre une erreur de colonne', async () => {
    role('super_admin');
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({ data: null, error: { code: '42703', message: 'column does not exist' } })),
    });
    const res: any = await PATCH(req({ archived: false }), params);
    const body = await res.json();
    expect(res._status).toBe(409);
    expect(body.error).toContain('20261224');
  });
});

describe('DELETE /api/admin/boxes/[id]/deletion', () => {
  it('refuse un simple admin', async () => {
    role('admin');
    const res: any = await DELETE(req({ name: NOM }), params);
    expect(res._status).toBe(403);
  });

  it('refuse un nom qui ne correspond pas, sans rien supprimer', async () => {
    role('super_admin');
    const svc = service({});
    mockCreateServiceClient.mockReturnValueOnce(svc);
    const res: any = await DELETE(req({ name: 'crossfit lyon' }), params);
    expect(res._status).toBe(400);
    expect(svc._del.eq).not.toHaveBeenCalled();
  });

  it('supprime une box vide malgré un essai local et le gérant seul', async () => {
    role('super_admin');
    const svc = service({ counts: { box_members: 1 }, otherMembers: 0, stripeSubs: 0 });
    mockCreateServiceClient.mockReturnValueOnce(svc);
    const res: any = await DELETE(req({ name: NOM }), params);
    expect(res._status).toBe(200);
  });

  it('refuse une box non vide en nommant les postes, sans supprimer', async () => {
    role('super_admin');
    const svc = service({ counts: { box_wods: 12, wod_scores: 3 } });
    mockCreateServiceClient.mockReturnValueOnce(svc);

    const res: any = await DELETE(req({ name: NOM }), params);
    const body = await res.json();

    expect(res._status).toBe(409);
    expect(body.error).toContain('12 WODs');
    expect(body.error).toContain('3 scores');
    expect(body.error).toContain('Archive-la');
    expect(svc._del.eq).not.toHaveBeenCalled();
  });

  it('refait le décompte côté serveur : la garde d’écran ne suffit pas', async () => {
    // L'écran a pu être ouvert quand la box était vide.
    role('super_admin');
    const svc = service({ counts: { box_cash_payments: 2 } });
    mockCreateServiceClient.mockReturnValueOnce(svc);
    const res: any = await DELETE(req({ name: NOM }), params);
    expect(res._status).toBe(409);
  });

  it('traduit une violation de contrainte au lieu de rendre le code', async () => {
    role('super_admin');
    mockCreateServiceClient.mockReturnValueOnce(
      service({ deleteError: { code: '23503', message: 'violates foreign key constraint' } }),
    );
    const res: any = await DELETE(req({ name: NOM }), params);
    const body = await res.json();
    expect(res._status).toBe(409);
    expect(body.error).toContain('BLOCKING_TABLES');
  });
});

describe('GET /api/admin/boxes/[id]/deletion', () => {
  it('refuse un simple admin', async () => {
    role('admin');
    const res: any = await GET(req({}), params);
    expect(res._status).toBe(403);
  });

  it('rend le décompte et le verdict', async () => {
    role('super_admin');
    mockCreateServiceClient.mockReturnValueOnce(service({ counts: { box_wods: 4 } }));
    const res: any = await GET(req({}), params);
    const body = await res.json();
    expect(res._status).toBe(200);
    expect(body.empty).toBe(false);
    expect(body.blockers).toContain('4 WODs');
    expect(body.name).toBe(NOM);
  });
});
