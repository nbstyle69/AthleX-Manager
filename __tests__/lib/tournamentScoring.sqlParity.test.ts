/**
 * Lecture d'un score : parseScoreVal (TS, conversion d'un temps saisi dans
 * l'onglet Scores) et parse_score_val (SQL) doivent lire la même valeur. Le
 * classement lui-même est calculé par la base seule (athlex-app #359 à #361) :
 * le Manager n'a plus de barème à comparer.
 *
 * Il tourne contre la pile Supabase jetable d'athlex-app :
 *   (athlex-app) ./scripts/test-stack.sh up
 *   set -a; . /tmp/athlex-test-stack.env; set +a
 *   (AthleX-Manager) npx jest tournamentScoring.sqlParity
 * Sans TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY il est ignoré (skip),
 * jamais joué contre la production.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseScoreVal } from '@/lib/tournamentScoring';

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const live = !!(URL && KEY && !/supabase\.co/.test(URL));
const d = live ? describe : describe.skip;

// Générateur déterministe (LCG) : la même graine rejoue le même jeu.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
function pick<T>(r: () => number, arr: T[]): T { return arr[Math.floor(r() * arr.length)]; }

// Valeurs brutes telles qu'un gérant les saisit : temps, reps, décimales à
// virgule, unité, encodage DNF hérité, vide, texte.
function randomScore(r: () => number, isTime: boolean): { score_value: string; capped: boolean | null } {
  const roll = r();
  if (roll < 0.08) return { score_value: pick(r, ['abc', '', '  ', 'DNF', '-']), capped: null };
  if (isTime) {
    if (roll < 0.20) return { score_value: String(999999 + Math.floor(r() * 200)), capped: null }; // DNF hérité
    if (roll < 0.45) return { score_value: `${Math.floor(r() * 20)}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, capped: r() < 0.3 };
    if (roll < 0.55) return { score_value: `1:${String(Math.floor(r() * 60)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, capped: false };
    return { score_value: String(Math.floor(r() * 900) + 60), capped: r() < 0.3 };
  }
  if (roll < 0.25) return { score_value: `${Math.floor(r() * 100)},${Math.floor(r() * 10)}`, capped: null };
  if (roll < 0.40) return { score_value: `${Math.floor(r() * 150)} kg`, capped: null };
  return { score_value: String(Math.floor(r() * 300)), capped: null };
}

d('parse_score_val (SQL) = parseScoreVal (TS)', () => {
  jest.setTimeout(120_000);
  const db: SupabaseClient = createClient(URL ?? 'http://x', KEY ?? 'x', { auth: { persistSession: false } });
  const TAG = `parity_${Date.now()}`;
  const userIds: string[] = [];
  let boxId: string | null = null;
  let ownerId: string | null = null;

  async function mkUser(username: string): Promise<string> {
    const { data, error } = await db.auth.admin.createUser({
      email: `zz.${username}.${TAG}@athlex.test`, password: `Tt!${TAG}x9`, email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const id = data.user.id;
    userIds.push(id);
    const { error: pErr } = await db.from('profiles').upsert(
      { id, email: `zz.${username}.${TAG}@athlex.test`, username: `${username}_${TAG}`.slice(0, 30), role: 'athlete', level: 'rx', elo: 1000, total_matches: 0, wins: 0 },
      { onConflict: 'id' },
    );
    if (pErr) throw new Error(pErr.message);
    return id;
  }

  beforeAll(async () => {
    ownerId = await mkUser('owner');
    const { data: box, error } = await db.from('boxes').insert({
      name: `[TEST] ${TAG}`, slug: `test-${TAG}`.toLowerCase(), owner_id: ownerId,
      invite_code: `P${Date.now()}`.slice(0, 10),
    }).select('id').single();
    if (error) throw new Error(error.message);
    boxId = box.id;
  });

  afterAll(async () => {
    if (boxId) await db.from('boxes').delete().eq('id', boxId);
    for (const id of userIds) await db.auth.admin.deleteUser(id);
  });

  // parseScoreVal ↔ parse_score_val, valeur par valeur.
  it('parse_score_val (SQL) = parseScoreVal (TS) sur un échantillon fuzzé', async () => {
    const r = rng(7);
    const samples = ['8:30', '1:02:03', '42,5', '80 kg', 'abc', '', '  12 ', ':', '8:ab', '.5', '1.2.3', '8,5:10', 'DNF', '-'];
    for (let i = 0; i < 60; i++) samples.push(randomScore(r, r() < 0.5).score_value);
    for (const s of samples) {
      const { data, error } = await db.rpc('parse_score_val', { p_raw: s });
      expect(error).toBeNull();
      const sql = data == null ? null : Number(data);
      expect({ s, sql }).toEqual({ s, sql: parseScoreVal(s) });
    }
  });

  // Tournois fuzzés : mêmes scores → mêmes points, même classement.
});
