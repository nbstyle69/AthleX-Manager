// Tests pour app/api/create-box/route.ts — issue #342.
//
// Le défaut corrigé : un e-mail déjà connu, avec le bon mot de passe, faisait
// que la route se connectait, créait une box, et basculait le profil en
// gérant. Un athlète est devenu gérant sans l'avoir demandé.

/** Chaîne PostgREST minimale : chaque table rend le résultat qu'on lui donne. */
const makeChain = (result: any = { data: null, error: null }) => {
  const c: any = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'eq', 'ilike', 'limit']) c[m] = jest.fn(() => c);
  c.single = jest.fn().mockResolvedValue(result);
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.then = (resolve: Function) => Promise.resolve(result).then(resolve as any);
  return c;
};

const mockCreateUser = jest.fn();
const mockSignIn = jest.fn();
const tables: Record<string, any> = {};
const mockFrom = jest.fn((table: string) => tables[table] ?? makeChain());

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    rpc: jest.fn().mockResolvedValue({ data: 10 }),
    auth: { admin: { createUser: mockCreateUser }, signInWithPassword: mockSignIn },
  })),
}));
jest.mock('@/lib/supabase/server', () => ({ getServerUser: jest.fn() }));
jest.mock('@/lib/trialRateLimit', () => ({
  clientIp: () => '127.0.0.1',
  takeToken: jest.fn(() => ({ allowed: true })),
}));

import { POST } from '../../app/api/create-box/route';
import { getServerUser } from '@/lib/supabase/server';
import { takeToken } from '@/lib/trialRateLimit';

const mockGetServerUser = getServerUser as jest.Mock;
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body), headers: new Map() });

const BOX = { box_name: 'Crossfit lyon', box_address: '' };
const EXISTANT = 'chachou@test.local';

function profils(existe: boolean) {
  tables.profiles = makeChain({ data: existe ? { id: 'u-existant' } : null, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(tables)) delete tables[k];
  tables.boxes = makeChain({ data: null, error: null });
  tables.box_subscriptions = makeChain();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-de-test';
});

describe('mode check — l’e-mail est vérifié dès la première étape', () => {
  it('dit qu’un compte existe, sans rien écrire', async () => {
    profils(true);
    const res: any = await POST(req({ mode: 'check', email: EXISTANT }));
    const body = await res.json();
    expect(res._status ?? 200).toBe(200);
    expect(body.exists).toBe(true);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(tables.boxes.insert).not.toHaveBeenCalled();
  });

  it('dit qu’aucun compte n’existe', async () => {
    profils(false);
    const res: any = await POST(req({ mode: 'check', email: 'neuf@test.local' }));
    expect((await res.json()).exists).toBe(false);
  });

  it('est borné en débit', async () => {
    (takeToken as jest.Mock).mockReturnValueOnce({ allowed: false, retryAfterSeconds: 60 });
    const res: any = await POST(req({ mode: 'check', email: EXISTANT }));
    expect(res._status).toBe(429);
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });
});

describe('mode signup — un compte existant ne crée ni box ni rôle', () => {
  it('refuse un e-mail connu AVANT toute création, avec le message explicite', async () => {
    profils(true);
    const res: any = await POST(req({ mode: 'signup', email: EXISTANT, password: 'le-bon-mot-de-passe', ...BOX }));
    const body = await res.json();

    expect(res._status).toBe(409);
    expect(body.error).toBe('Un compte existe déjà avec cet e-mail. Connecte-toi, puis crée ta box depuis ton compte.');
    expect(body.account_exists).toBe(true);
    // Ni tentative de connexion, ni compte, ni box, ni rôle.
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(tables.boxes.insert).not.toHaveBeenCalled();
    expect(tables.profiles.update).not.toHaveBeenCalled();
  });

  it('refuse aussi si seul le compte auth existe, sans repli sur la connexion', async () => {
    profils(false);
    mockCreateUser.mockResolvedValue({ data: null, error: { message: 'User already registered' } });
    const res: any = await POST(req({ mode: 'signup', email: EXISTANT, password: 'x-y-z-1', ...BOX }));
    expect(res._status).toBe(409);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(tables.boxes.insert).not.toHaveBeenCalled();
  });

  it('un compte neuf suit le tunnel : compte, profil, box, rôle', async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'u-neuf' } }, error: null });
    // `profiles` répond deux fois : d'abord « aucun compte » (contrôle
    // d'existence), puis le profil créé (boucle d'attente avant la box).
    tables.profiles = makeChain({ data: { id: 'u-neuf' }, error: null });
    tables.profiles.maybeSingle = jest.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({ data: { id: 'u-neuf' }, error: null });
    tables.boxes = makeChain({ data: { id: 'box-neuve' }, error: null });

    const res: any = await POST(req({ mode: 'signup', email: 'neuf@test.local', password: 'x-y-z-1', ...BOX }));
    const body = await res.json();

    expect(res._status ?? 200).toBe(200);
    expect(body.box_id).toBe('box-neuve');
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(tables.boxes.insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'u-neuf', name: 'Crossfit lyon' }));
    expect(tables.profiles.update).toHaveBeenCalledWith({ role: 'box_owner' });
  }, 10000);
});

describe('mode login — ne crée plus rien', () => {
  it('refuse avec le message explicite, sans se connecter', async () => {
    const res: any = await POST(req({ mode: 'login', email: EXISTANT, password: 'le-bon-mot-de-passe', ...BOX }));
    expect(res._status).toBe(409);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(tables.boxes.insert).not.toHaveBeenCalled();
  });
});

describe('mode existing_account — l’intention est la session, pas un champ', () => {
  it('refuse sans session', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const res: any = await POST(req({ mode: 'existing_account', ...BOX }));
    expect(res._status).toBe(401);
    expect(tables.boxes.insert).not.toHaveBeenCalled();
  });

  it('ignore e-mail et mot de passe du corps : seule la session compte', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'u-athlete', email: 'athlete@test.local' });
    tables.boxes = makeChain({ data: null, error: null });
    const boxesInsert = makeChain({ data: { id: 'box-athlete' }, error: null });
    tables.boxes.insert = jest.fn(() => boxesInsert);
    tables.profiles = makeChain();

    const res: any = await POST(req({ mode: 'existing_account', email: 'autre@test.local', password: 'p', ...BOX }));
    const body = await res.json();

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(body.box_id).toBe('box-athlete');
    expect(tables.boxes.insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'u-athlete' }));
    expect(tables.profiles.update).toHaveBeenCalledWith({ role: 'box_owner' });
  });

  it('un compte qui possède déjà une box y est renvoyé, sans en créer une deuxième', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'u-gerant' });
    tables.boxes = makeChain({ data: { id: 'box-deja' }, error: null });
    const res: any = await POST(req({ mode: 'existing_account', ...BOX }));
    const body = await res.json();
    expect(body.already_exists).toBe(true);
    expect(body.box_id).toBe('box-deja');
    expect(tables.boxes.insert).not.toHaveBeenCalled();
  });
});
