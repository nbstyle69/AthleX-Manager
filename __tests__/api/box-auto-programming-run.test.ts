// Tests pour app/api/box/[id]/auto-programming/run/route.ts

const makeChain = (result: any = { data: null, error: null }) => {
  const c: any = {};
  for (const m of ['select', 'eq', 'in']) c[m] = jest.fn(() => c);
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

import { POST } from '../../app/api/box/[id]/auto-programming/run/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateServiceClient = createServiceClient as jest.Mock;

const BOX = 'box-athlex';
const params = { params: Promise.resolve({ id: BOX }) };
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

/**
 * Tables lues par la route : `boxes` (garde + réglage) et `box_members`
 * (garde). `staff` décide si l'appelant passe la garde.
 */
function service({ staff, tracks = ['functional', 'musculation'], enabled = true }: {
  staff: boolean; tracks?: string[]; enabled?: boolean;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'box_members') return makeChain({ data: staff ? { id: 'm-1' } : null });
      // `boxes` sert deux fois : la garde (owner_id) puis le réglage.
      return makeChain({
        data: staff
          ? { id: BOX, auto_programming: enabled, auto_programming_tracks: tracks }
          : null,
      });
    }),
  };
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    CRON_SECRET: 'secret-de-test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-de-test',
  };
  global.fetch = jest.fn();
});
afterAll(() => { process.env = ORIGINAL_ENV; });

const fnOk = (outcomes: any[]) => ({
  ok: true,
  json: async () => ({ ok: true, outcomes }),
});

describe('POST /api/box/[id]/auto-programming/run', () => {
  it('refuse un visiteur non authentifié', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const res: any = await POST(req({ mode: 'next' }), params);
    expect(res._status).toBe(401);
  });

  it('refuse un utilisateur qui n’est ni gérant ni coach de la box', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'intrus' });
    mockCreateServiceClient.mockReturnValue(service({ staff: false }));
    const res: any = await POST(req({ mode: 'next' }), params);
    expect(res._status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('échoue explicitement quand CRON_SECRET manque, sans appeler la fonction', async () => {
    delete process.env.CRON_SECRET;
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));

    const res: any = await POST(req({ mode: 'next' }), params);
    const body = await res.json();

    expect(res._status).toBe(500);
    expect(body.error).toContain('CRON_SECRET');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('« Générer maintenant » envoie { box_id } et le secret en en-tête', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    (global.fetch as jest.Mock).mockResolvedValue(fnOk([
      { box_id: BOX, track: 'functional', iso_year: 2026, iso_week: 40, status: 'done', inserted: 21 },
    ]));

    const res: any = await POST(req({ mode: 'next' }), params);
    const body = await res.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://ref.supabase.co/functions/v1/generate-box-week');
    expect(init.headers['x-cron-secret']).toBe('secret-de-test');
    expect(JSON.parse(init.body)).toEqual({ box_id: BOX });
    expect(body.inserted).toBe(21);
  });

  it('« Régénérer » fait un appel par piste active, sur la semaine demandée', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(fnOk([{ box_id: BOX, track: 'functional', iso_year: 2026, iso_week: 39, status: 'done', inserted: 4, kept_dates: ['2026-09-21'] }]))
      .mockResolvedValueOnce(fnOk([{ box_id: BOX, track: 'musculation', iso_year: 2026, iso_week: 39, status: 'done', inserted: 5, kept_dates: [] }]));

    const res: any = await POST(req({ mode: 'regen', iso_year: 2026, iso_week: 39 }), params);
    const body = await res.json();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const bodies = (global.fetch as jest.Mock).mock.calls.map(c => JSON.parse(c[1].body));
    expect(bodies).toEqual([
      { regen: { box_id: BOX, track: 'functional' }, iso_year: 2026, iso_week: 39 },
      { regen: { box_id: BOX, track: 'musculation' }, iso_year: 2026, iso_week: 39 },
    ]);
    expect(body.inserted).toBe(9);
    // Le jour scoré ou modifié remonte à l'utilisateur : c'est la promesse
    // faite dans la confirmation.
    expect(body.kept_days).toEqual(['2026-09-21']);
  });

  it('refuse une semaine ISO absente en régénération', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    const res: any = await POST(req({ mode: 'regen' }), params);
    expect(res._status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse une box dont la programmation automatique est éteinte', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true, enabled: false }));
    const res: any = await POST(req({ mode: 'next' }), params);
    expect(res._status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('un échec sur une seule piste ne se rend pas comme un succès', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(fnOk([{ box_id: BOX, track: 'functional', iso_year: 2026, iso_week: 39, status: 'done', inserted: 4 }]))
      .mockResolvedValueOnce(fnOk([{ box_id: BOX, track: 'musculation', iso_year: 2026, iso_week: 39, status: 'error', error: 'catalogue vide' }]));

    const res: any = await POST(req({ mode: 'regen', iso_year: 2026, iso_week: 39 }), params);
    const body = await res.json();

    expect(res._status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.errors).toEqual(['musculation : catalogue vide']);
  });
});
