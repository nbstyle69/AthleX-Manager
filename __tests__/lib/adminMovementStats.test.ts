// Tests pour lib/admin/movementStats.ts (onglet Statistiques de /admin/movements).
//
// Le défaut corrigé : le champ `error` des réponses n'était pas lu, donc une
// lecture refusée s'affichait « Aucun mouvement trouvé », comme une base vide.

import { loadMovementAthletes, loadMovementTotals, STATS_PAGE_SIZE, STATS_READ_ERROR } from '@/lib/admin/movementStats';

type Res = { data: any[] | null; error: { message: string } | null; count?: number | null };

/** Client dont chaque table rend, dans l'ordre des appels, la réponse donnée. */
function client(responses: Record<string, Res[]>) {
  const calls: string[] = [];
  return {
    calls,
    from: (table: string) => {
      calls.push(table);
      const res = responses[table].shift()!;
      const chain: any = {};
      for (const m of ['select', 'order', 'eq', 'limit', 'in', 'range']) chain[m] = () => chain;
      chain.then = (ok: (r: Res) => unknown) => Promise.resolve(res).then(ok);
      return chain;
    },
  };
}

const DENIED = { data: null, error: { message: 'permission denied for table user_movement_stats' } };

describe('loadMovementTotals', () => {
  it('agrège par mouvement × unité et trie par total', async () => {
    const c = client({ user_movement_stats: [{ error: null, data: [
      { movement: 'row', unit: 'cal', total_reps: 100, best_weight: null, user_id: 'a' },
      { movement: 'row', unit: 'm', total_reps: 5000, best_weight: null, user_id: 'a' },
      { movement: 'thruster', unit: 'reps', total_reps: 300, best_weight: 40, user_id: 'a' },
      { movement: 'thruster', unit: 'reps', total_reps: 200, best_weight: 60, user_id: 'b' },
    ], count: 4 }] });

    const { stats, error } = await loadMovementTotals(c);

    expect(error).toBeNull();
    expect(stats).toEqual([
      { movement: 'row', unit: 'm', total_reps: 5000, athlete_count: 1, best_weight: null },
      { movement: 'thruster', unit: 'reps', total_reps: 500, athlete_count: 2, best_weight: 60 },
      { movement: 'row', unit: 'cal', total_reps: 100, athlete_count: 1, best_weight: null },
    ]);
  });

  it('base vide : aucune erreur, liste vide (« Aucun mouvement trouvé » est alors juste)', async () => {
    const c = client({ user_movement_stats: [{ data: [], error: null, count: 0 }] });
    await expect(loadMovementTotals(c)).resolves.toEqual({ stats: [], error: null });
  });

  it('lecture refusée : rend le message, jamais une fausse liste vide silencieuse', async () => {
    const c = client({ user_movement_stats: [DENIED] });
    const { stats, error } = await loadMovementTotals(c);
    expect(stats).toEqual([]);
    expect(error).toBe(`${STATS_READ_ERROR} : permission denied for table user_movement_stats`);
  });
});

describe('loadMovementAthletes', () => {
  it('rend les athlètes avec leur pseudo', async () => {
    const c = client({
      user_movement_stats: [{ error: null, data: [
        { user_id: 'a', movement: 'run', unit: 'm', total_reps: 8000, best_weight: null },
        { user_id: 'b', movement: 'run', unit: 'm', total_reps: 4000, best_weight: null },
      ] }],
      profiles: [{ error: null, data: [{ id: 'a', username: 'alice' }, { id: 'b', username: 'bob' }] }],
    });

    const { athletes, error } = await loadMovementAthletes(c, 'run', 'm');

    expect(error).toBeNull();
    expect(athletes.map(a => [a.username, a.total_reps])).toEqual([['alice', 8000], ['bob', 4000]]);
  });

  it('lecture des cumuls refusée : message, et les pseudos ne sont pas lus', async () => {
    const c = client({ user_movement_stats: [DENIED], profiles: [] });
    const { athletes, error } = await loadMovementAthletes(c, 'run', 'm');
    expect(athletes).toEqual([]);
    expect(error).toBe(`${STATS_READ_ERROR} : permission denied for table user_movement_stats`);
    expect(c.calls).toEqual(['user_movement_stats']);
  });

  it('lecture des pseudos en échec : message, pas une liste d’anonymes', async () => {
    const c = client({
      user_movement_stats: [{ error: null, data: [{ user_id: 'a', movement: 'run', unit: 'm', total_reps: 8000, best_weight: null }] }],
      profiles: [{ data: null, error: { message: 'JWT expired' } }],
    });
    const { athletes, error } = await loadMovementAthletes(c, 'run', 'm');
    expect(athletes).toEqual([]);
    expect(error).toBe(`${STATS_READ_ERROR} (pseudos) : JWT expired`);
  });
});

describe('loadMovementTotals — au-delà d’une page', () => {
  // Le défaut corrigé : une seule requête, plafonnée par PostgREST (1 000
  // lignes par défaut) ; les totaux au-delà étaient tronqués sans erreur.

  /** `n` lignes : `run` en mètres pour chaque athlète, 10 m chacune. */
  const rowsOf = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ movement: 'run', unit: 'm', total_reps: 10, best_weight: null, user_id: `u${String(i).padStart(5, '0')}` }));

  /** Faux PostgREST : `range` servi dans la limite de `maxRows`, `count` exact si demandé. */
  function server(rows: any[], { maxRows = 1000, withCount = true, failOnCall = -1 } = {}) {
    const log = { ranges: [] as [number, number][], orders: [] as string[], countAsked: false };
    let call = 0;
    const c = {
      from: () => {
        let from = 0, to = 0;
        const chain: any = {
          select: (_cols: string, opts?: { count?: string }) => { if (opts?.count === 'exact') log.countAsked = true; return chain; },
          order: (col: string) => { if (call === 0) log.orders.push(col); return chain; },
          range: (a: number, b: number) => { from = a; to = b; log.ranges.push([a, b]); return chain; },
          then: (ok: (r: any) => unknown) => {
            const i = call++;
            if (i === failOnCall) return Promise.resolve({ data: null, error: { message: 'timeout' }, count: null }).then(ok);
            const data = rows.slice(from, Math.min(to + 1, from + maxRows));
            return Promise.resolve({ data, error: null, count: withCount ? rows.length : null }).then(ok);
          },
        };
        return chain;
      },
    };
    return { c, log };
  }

  it.each([
    ['2 500 lignes, plafond serveur 1 000', 2500, 1000],
    ['2 500 lignes, plafond serveur 300 (plus bas que la page)', 2500, 300],
    ['exactement 1 000 lignes', 1000, 1000],
    ['1 001 lignes', 1001, 1000],
  ])('%s : totaux exacts', async (_label, n, maxRows) => {
    const { c, log } = server(rowsOf(n), { maxRows });
    const { stats, error } = await loadMovementTotals(c);
    expect(error).toBeNull();
    expect(stats).toEqual([{ movement: 'run', unit: 'm', total_reps: n * 10, athlete_count: n, best_weight: null }]);
    expect(log.countAsked).toBe(true);
    // Ordre stable : celui de la contrainte d'unicité, pour ne rien sauter ni doubler.
    expect(log.orders).toEqual(['user_id', 'movement', 'unit']);
    // Pages contiguës, sans trou ni chevauchement.
    log.ranges.forEach(([a], i) => { if (i > 0) expect(a).toBeGreaterThan(log.ranges[i - 1][0]); });
    expect(log.ranges[0]).toEqual([0, STATS_PAGE_SIZE - 1]);
  });

  it('sans nombre total dans la réponse : lit jusqu’à une page vide', async () => {
    const { c } = server(rowsOf(2300), { withCount: false });
    const { stats, error } = await loadMovementTotals(c);
    expect(error).toBeNull();
    expect(stats[0].athlete_count).toBe(2300);
  });

  it('erreur sur une page suivante : message, pas de totaux partiels', async () => {
    const { c } = server(rowsOf(2500), { failOnCall: 1 });
    const { stats, error } = await loadMovementTotals(c);
    expect(stats).toEqual([]);
    expect(error).toBe(`${STATS_READ_ERROR} : timeout`);
  });

  it('lignes manquantes par rapport au total annoncé : signalé, jamais affiché comme juste', async () => {
    // Le serveur annonce 1 500 lignes mais n'en sert que 1 200 (disparues entre deux pages).
    const shrunk = rowsOf(1200);
    const s2 = server(shrunk, { maxRows: 1000 });
    const lying = { from: () => { const ch = s2.c.from(); const then = ch.then; ch.then = (ok: any) => then((r: any) => ok({ ...r, count: 1500 })); return ch; } };
    const { stats, error } = await loadMovementTotals(lying);
    expect(stats).toEqual([]);
    expect(error).toBe(`${STATS_READ_ERROR} : 1200 lignes lues sur 1500, totaux incomplets`);
  });
});
