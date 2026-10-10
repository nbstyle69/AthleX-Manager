// getRequestUser : session cookie du site OU `Authorization: Bearer` de l'app,
// vérifiés tous deux par GoTrue (/auth/v1/user) ; jamais d'identité lue dans le corps.

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projet.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_test';

import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { getRequestUser } from '@/lib/auth/requestUser';

const VALIDES: Record<string, { id: string }> = { jeton_cookie: { id: 'user-cookie' }, jeton_app: { id: 'user-app' } };

let fetchSpy: jest.SpyInstance;

function req(headers: Record<string, string> = {}): any {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null }, json: jest.fn() };
}

function cookie(value: string | undefined) {
  (cookies as jest.Mock).mockResolvedValue({ get: (n: string) => (n === 'sb-access-token' && value ? { value } : undefined) });
}

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation(async (_url: any, init: any) => {
    const jeton = String(init?.headers?.Authorization ?? '').replace('Bearer ', '');
    const user = VALIDES[jeton];
    return { ok: !!user, json: async () => user ?? {} } as any;
  });
  cookie(undefined);
});
afterEach(() => fetchSpy.mockRestore());

describe('getRequestUser', () => {
  it('sans cookie ni jeton : null, sans appel à GoTrue', async () => {
    expect(await getRequestUser(req())).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cookie seul : l’utilisateur du cookie', async () => {
    cookie('jeton_cookie');
    expect((await getRequestUser(req()))?.id).toBe('user-cookie');
  });

  it('Bearer seul : l’utilisateur du jeton, vérifié par /auth/v1/user', async () => {
    const r = req({ Authorization: 'Bearer jeton_app' });
    expect((await getRequestUser(r))?.id).toBe('user-app');
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://projet.supabase.co/auth/v1/user');
    expect(fetchSpy.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer jeton_app', apikey: 'anon_test' });
    expect(r.json).not.toHaveBeenCalled();
  });

  it('jeton invalide ou expiré : null, même avec un cookie valide', async () => {
    cookie('jeton_cookie');
    expect(await getRequestUser(req({ Authorization: 'Bearer expire' }))).toBeNull();
  });

  it('en-tête mal formé (pas Bearer, jeton vide) : null', async () => {
    cookie('jeton_cookie');
    expect(await getRequestUser(req({ Authorization: 'Basic abc' }))).toBeNull();
    expect(await getRequestUser(req({ Authorization: 'Bearer ' }))).toBeNull();
  });

  it('réservé aux routes membres du changement de formule', () => {
    const api = path.join(process.cwd(), 'app', 'api');
    const trouves: string[] = [];
    const parcourir = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name === 'route.ts' && fs.readFileSync(p, 'utf8').includes('getRequestUser')) {
        trouves.push(path.relative(api, path.dirname(p)).split(path.sep).join('/'));
      }
    });
    parcourir(api);
    expect(trouves.sort()).toEqual([
      'change-membership-plan', 'change-membership-plan/cancel', 'membership/overview', 'membership/payment-portal',
    ]);
  });
});
