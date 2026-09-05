/**
 * Une seule règle de classement « Classique » : lib/tournamentScoring (TS) et
 * tournament_classique_standings (SQL, migration athlex-app
 * 20261128_finalize_tournament_elo.sql) doivent rendre les mêmes points pour les
 * mêmes scores. Si l'une des deux bouge sans l'autre, ce test le dit.
 *
 * Il tourne contre la pile Supabase jetable d'athlex-app :
 *   (athlex-app) ./scripts/test-stack.sh up
 *   set -a; . /tmp/athlex-test-stack.env; set +a
 *   (AthleX-Manager) npx jest tournamentScoring.sqlParity
 * Sans TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY il est ignoré (skip),
 * jamais joué contre la production.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseScoreVal, rankClassique, type RawScore } from '@/lib/tournamentScoring';

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

d('rankClassique (TS) = tournament_classique_standings (SQL)', () => {
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
  it.each([1, 2, 3, 4, 5])('graine %i : points SQL = points TS, rangs identiques', async (seed) => {
    const r = rng(seed * 7919);
    const nAth = 4 + Math.floor(r() * 6);
    const nWod = 1 + Math.floor(r() * 3);
    const athletes: string[] = [];
    for (let i = 0; i < nAth; i++) athletes.push(await mkUser(`a${seed}_${i}`));

    const today = new Date().toISOString().slice(0, 10);
    const { data: t, error: tErr } = await db.from('tournaments').insert({
      box_id: boxId, created_by: ownerId, name: `[TEST] parity ${seed} ${TAG}`, status: 'open',
      level: 'rx', format: 'simple', start_date: today, end_date: today, max_participants: 16,
    }).select('id').single();
    if (tErr) throw new Error(tErr.message);
    for (const a of athletes) await db.from('tournament_participants').insert({ tournament_id: t.id, athlete_id: a, score: 0 });

    const raw: RawScore[] = [];
    for (let w = 0; w < nWod; w++) {
      const wodType = pick(r, ['For Time', 'AMRAP', 'Max Reps', 'Strength']);
      const { data: wod, error: wErr } = await db.from('tournament_wods').insert({
        tournament_id: t.id, order_index: w + 1, title: `[TEST] W${w}`, type: wodType,
        duration_minutes: 12, movements: '[]', scoring: wodType === 'For Time' ? 'Temps' : 'Reps', status: 'active',
      }).select('id').single();
      if (wErr) throw new Error(wErr.message);
      for (const a of athletes) {
        if (r() < 0.1) continue; // sans score sur ce WOD
        const sc = randomScore(r, wodType === 'For Time');
        const { error: sErr } = await db.from('tournament_scores').insert({
          tournament_id: t.id, tournament_wod_id: wod.id, athlete_id: a,
          score_value: sc.score_value, capped: sc.capped ?? false, status: 'validated',
        });
        if (sErr) throw new Error(sErr.message);
        raw.push({ athlete_id: a, tournament_wod_id: wod.id, wod_type: wodType, score_value: sc.score_value, capped: sc.capped });
      }
    }

    const ts = rankClassique(raw);
    const { data: sql, error } = await db.rpc('tournament_classique_standings', { p_tournament_id: t.id });
    expect(error).toBeNull();
    const sqlPoints = Object.fromEntries((sql as { athlete_id: string; points: number; final_rank: number }[]).map(x => [x.athlete_id, x.points]));
    const tsPoints = Object.fromEntries(athletes.map(a => [a, ts[a] ?? 0]));
    expect(sqlPoints).toEqual(tsPoints);

    // Rang : compétition (1, 2, 2, 4) sur les points décroissants, les deux côtés.
    const sorted = [...athletes].sort((a, b) => tsPoints[b] - tsPoints[a]);
    const tsRank = Object.fromEntries(sorted.map(a => [a, sorted.findIndex(x => tsPoints[x] === tsPoints[a]) + 1]));
    const sqlRank = Object.fromEntries((sql as { athlete_id: string; final_rank: number }[]).map(x => [x.athlete_id, x.final_rank]));
    expect(sqlRank).toEqual(tsRank);
  });
});
