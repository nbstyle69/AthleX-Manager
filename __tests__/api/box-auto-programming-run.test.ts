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
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40 }), params);
    expect(res._status).toBe(401);
  });

  it('refuse un utilisateur qui n’est ni gérant ni coach de la box', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'intrus' });
    mockCreateServiceClient.mockReturnValue(service({ staff: false }));
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40 }), params);
    expect(res._status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('échoue explicitement quand CRON_SECRET manque, sans appeler la fonction', async () => {
    delete process.env.CRON_SECRET;
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));

    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40 }), params);
    const body = await res.json();

    expect(res._status).toBe(500);
    expect(body.error).toContain('CRON_SECRET');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('« Générer » vise la semaine demandée, pas « la suivante »', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    (global.fetch as jest.Mock).mockResolvedValue(fnOk([
      { box_id: BOX, track: 'functional', iso_year: 2026, iso_week: 41, status: 'done', inserted: 21 },
    ]));

    // Semaine 41 = celle du 5 octobre 2026, loin devant la semaine suivante.
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 41 }), params);
    const body = await res.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://ref.supabase.co/functions/v1/generate-box-week');
    expect(init.headers['x-cron-secret']).toBe('secret-de-test');
    expect(JSON.parse(init.body)).toEqual({ box_id: BOX, iso_year: 2026, iso_week: 41, tracks: ['functional', 'musculation'] });
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
    // `tracks: [track]` sur chaque appel : sans lui, la boucle de la fonction
    // traiterait aussi les autres pistes de la box.
    expect(bodies).toEqual([
      { regen: { box_id: BOX, track: 'functional' }, iso_year: 2026, iso_week: 39, tracks: ['functional'] },
      { regen: { box_id: BOX, track: 'musculation' }, iso_year: 2026, iso_week: 39, tracks: ['musculation'] },
    ]);
    expect(body.inserted).toBe(9);
    // Le jour scoré ou modifié remonte à l'utilisateur : c'est la promesse
    // faite dans la confirmation.
    expect(body.kept_days).toEqual(['2026-09-21']);
  });

  it.each(['next', 'regen'])('refuse une semaine ISO absente en mode %s', async (mode) => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    const res: any = await POST(req({ mode }), params);
    expect(res._status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse une semaine ISO hors bornes', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 54 }), params);
    expect(res._status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse une box dont la programmation automatique est éteinte', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true, enabled: false }));
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40 }), params);
    expect(res._status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('« Régénérer » fait trois appels quand les trois pistes sont actives', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(
      service({ staff: true, tracks: ['functional', 'hybrid', 'musculation'] }),
    );
    (global.fetch as jest.Mock).mockResolvedValue(fnOk([]));

    await POST(req({ mode: 'regen', iso_year: 2026, iso_week: 39 }), params);

    // Hybrid est une piste à part entière : elle a son propre appel, la
    // fonction ne régénérant qu'une piste à la fois.
    const bodies = (global.fetch as jest.Mock).mock.calls.map(c => JSON.parse(c[1].body));
    expect(bodies.map((b: any) => b.regen.track)).toEqual(['functional', 'hybrid', 'musculation']);
  });

  it('« Générer » n’envoie que les pistes cochées, en un seul appel', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(
      service({ staff: true, tracks: ['functional', 'hybrid', 'musculation'] }),
    );
    (global.fetch as jest.Mock).mockResolvedValue(fnOk([]));

    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40, tracks: ['hybrid'] }), params);
    const body = await res.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body))
      .toEqual({ box_id: BOX, iso_year: 2026, iso_week: 40, tracks: ['hybrid'] });
    expect(body.tracks).toEqual(['hybrid']);
  });

  it('« Régénérer » ne fait un appel que pour les pistes cochées', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(
      service({ staff: true, tracks: ['functional', 'hybrid', 'musculation'] }),
    );
    (global.fetch as jest.Mock).mockResolvedValue(fnOk([]));

    await POST(req({ mode: 'regen', iso_year: 2026, iso_week: 39, tracks: ['musculation', 'functional'] }), params);

    // Ordre du moteur, pas ordre de la requête : la piste est une clé, pas
    // une préférence.
    const bodies = (global.fetch as jest.Mock).mock.calls.map(c => JSON.parse(c[1].body));
    expect(bodies.map((b: any) => b.regen.track)).toEqual(['functional', 'musculation']);
    expect(bodies.every((b: any) => b.tracks.length === 1 && b.tracks[0] === b.regen.track)).toBe(true);
  });

  it('refuse une piste cochée qui n’est pas active sur la box', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true, tracks: ['functional'] }));
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40, tracks: ['hybrid'] }), params);
    const body = await res.json();
    expect(res._status).toBe(400);
    expect(body.error).toContain('hybrid');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([[[]], [['crossfit']], ['functional']])('refuse tracks = %j', async (tracks) => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockCreateServiceClient.mockReturnValue(service({ staff: true }));
    const res: any = await POST(req({ mode: 'next', iso_year: 2026, iso_week: 40, tracks }), params);
    expect(res._status).toBe(400);
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
