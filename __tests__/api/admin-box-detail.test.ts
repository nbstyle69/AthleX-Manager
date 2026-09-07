// Tests for app/api/admin/boxes/[id]/route.ts (GET)

const makeChain = (thenValue: any = { data: null, error: null }) => {
  const c: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) c[m] = jest.fn(() => c);
  c.then = (resolve: Function) => Promise.resolve(thenValue).then(resolve as any);
  c.single = jest.fn().mockResolvedValue(thenValue);
  return c;
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
  getServerUser: jest.fn(),
  createClient: jest.fn(),
}));

import { GET } from '../../app/api/admin/boxes/[id]/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateServiceClient = createServiceClient as jest.Mock;

const BOX = 'box-athlex';
const TOURNAMENTS = Array.from({ length: 7 }, (_, i) => ({ id: `t-${i}`, name: `Tournoi ${i}`, status: 'open' }));
const WODS = Array.from({ length: 50 }, (_, i) => ({ id: `w-${i}`, title: `WOD ${i}` }));

function serviceClient(tables: Record<string, any>) {
  const from = jest.fn((table: string) => tables[table] ?? makeChain());
  return { from };
}

describe('GET /api/admin/boxes/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lit les tournois dans `tournaments` (pas `competitions`) et compte les WODs au-delà des 50 listés', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'admin-1' });
    mockCreateServiceClient.mockReturnValueOnce(serviceClient({
      profiles: makeChain({ data: { role: 'super_admin' } }),
    }));

    const boxWods = makeChain({ data: WODS, error: null });
    // 2e appel à box_wods = compteur exact (head:true)
    boxWods.select = jest.fn((_cols: string, opts?: any) =>
      opts?.count === 'exact' ? makeChain({ data: null, count: 658, error: null }) : boxWods);
    const tables = {
      profiles: makeChain({ data: { role: 'super_admin' } }),
      boxes: makeChain({ data: { id: BOX, name: 'AthleX Fitness' }, error: null }),
      box_subscriptions: makeChain({ data: [], error: null }),
      box_members: makeChain({ data: [], error: null }),
      box_wods: boxWods,
      wod_scores: makeChain({ data: [], error: null }),
      tournaments: makeChain({ data: TOURNAMENTS, error: null }),
      competitions: makeChain({ data: [], error: null }),
    };
    const client = serviceClient(tables);
    mockCreateServiceClient.mockReturnValueOnce(client);

    const res: any = await GET({} as any, { params: Promise.resolve({ id: BOX }) });
    const body = await res.json();

    expect(client.from).toHaveBeenCalledWith('tournaments');
    expect(client.from).not.toHaveBeenCalledWith('competitions');
    expect(tables.tournaments.eq).toHaveBeenCalledWith('box_id', BOX);
    expect(body.competitions).toHaveLength(7);
    expect(body.wods).toHaveLength(50);
    expect(body.wod_count).toBe(658);
  });

  it('renvoie 0 tournoi et wod_count 0 pour une box vide', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'admin-1' });
    mockCreateServiceClient.mockReturnValueOnce(serviceClient({
      profiles: makeChain({ data: { role: 'super_admin' } }),
    }));
    const boxWods = makeChain({ data: [], error: null });
    boxWods.select = jest.fn((_cols: string, opts?: any) =>
      opts?.count === 'exact' ? makeChain({ data: null, count: 0, error: null }) : boxWods);
    mockCreateServiceClient.mockReturnValueOnce(serviceClient({
      boxes: makeChain({ data: { id: 'box-nbs2', name: 'Crossfit NBS2' }, error: null }),
      box_subscriptions: makeChain({ data: [], error: null }),
      box_members: makeChain({ data: [], error: null }),
      box_wods: boxWods,
      tournaments: makeChain({ data: [], error: null }),
    }));

    const res: any = await GET({} as any, { params: Promise.resolve({ id: 'box-nbs2' }) });
    const body = await res.json();
    expect(body.competitions).toHaveLength(0);
    expect(body.wod_count).toBe(0);
  });
});
