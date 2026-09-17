// Tests pour app/api/admin/boxes/[id]/auto-programming/route.ts

const makeChain = (result: any = { data: null, error: null }) => {
  const c: any = {};
  for (const m of ['select', 'update', 'eq']) c[m] = jest.fn(() => c);
  c.single = jest.fn().mockResolvedValue(result);
  c.then = (resolve: Function) => Promise.resolve(result).then(resolve as any);
  return c;
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
  getServerUser: jest.fn(),
  createClient: jest.fn(),
}));

import { PATCH } from '../../app/api/admin/boxes/[id]/auto-programming/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateServiceClient = createServiceClient as jest.Mock;

const BOX = 'box-athlex';
const params = { params: Promise.resolve({ id: BOX }) };
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

/** Premier appel : la vérification du rôle. Les suivants : l'écriture. */
function asAdmin(role = 'super_admin') {
  mockGetServerUser.mockResolvedValue({ id: 'admin-1' });
  mockCreateServiceClient.mockReturnValueOnce({
    from: jest.fn(() => makeChain({ data: { role } })),
  });
}

describe('PATCH /api/admin/boxes/[id]/auto-programming', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuse un visiteur non authentifié', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const res: any = await PATCH(req({ auto_programming: true }), params);
    expect(res._status).toBe(403);
  });

  it('refuse un utilisateur qui n’est pas admin', async () => {
    asAdmin('member');
    const res: any = await PATCH(req({ auto_programming: true, tracks: ['functional'] }), params);
    expect(res._status).toBe(403);
  });

  it('refuse un gérant de box : l’interrupteur est réservé à la plateforme', async () => {
    asAdmin('owner');
    const res: any = await PATCH(req({ auto_programming: true, tracks: ['functional'] }), params);
    expect(res._status).toBe(403);
  });

  it('refuse une piste inconnue avant d’écrire', async () => {
    asAdmin();
    const res: any = await PATCH(req({ tracks: ['hyrox'] }), params);
    expect(res._status).toBe(400);
  });

  it('écrit l’interrupteur et les pistes en service role', async () => {
    asAdmin();
    const boxes = makeChain({
      data: { id: BOX, auto_programming: true, auto_programming_tracks: ['functional'] },
      error: null,
    });
    mockCreateServiceClient.mockReturnValueOnce({ from: jest.fn(() => boxes) });

    const res: any = await PATCH(req({ auto_programming: true, tracks: ['functional'] }), params);
    const body = await res.json();

    expect(res._status).toBe(200);
    expect(boxes.update).toHaveBeenCalledWith(expect.objectContaining({
      auto_programming: true,
      auto_programming_tracks: ['functional'],
    }));
    expect(boxes.eq).toHaveBeenCalledWith('id', BOX);
    expect(body.auto_programming).toBe(true);
  });

  it('rend le refus du trigger tel quel, sans le contourner', async () => {
    asAdmin();
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        data: null,
        error: { code: '42501', message: 'Accès refusé : programmation automatique réservée à un administrateur' },
      })),
    });

    const res: any = await PATCH(req({ auto_programming: true, tracks: ['functional'] }), params);
    const body = await res.json();

    expect(res._status).toBe(403);
    expect(body.error).toContain('boxes_auto_programming_guard');
  });

  it('écrit quand même l’interrupteur si les colonnes de révélation manquent', async () => {
    asAdmin();
    let call = 0;
    const second = makeChain({
      data: { id: BOX, auto_programming: true, auto_programming_tracks: ['functional'] },
      error: null,
    });
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => {
        call += 1;
        // 1er essai : la base ne connaît pas `auto_programming_reveal_mode`.
        return call === 1
          ? makeChain({ data: null, error: { code: '42703', message: 'column does not exist' } })
          : second;
      }),
    });

    const res: any = await PATCH(req({
      auto_programming: true, tracks: ['functional'], reveal_mode: 'daily', reveal_time: '07:00',
    }), params);
    const body = await res.json();

    expect(res._status).toBe(200);
    expect(body.reveal_saved).toBe(false);
    // Le second essai ne porte plus aucune colonne de révélation.
    const written = second.update.mock.calls[0][0];
    expect(Object.keys(written)).toEqual(['auto_programming', 'auto_programming_tracks']);
  });
});
