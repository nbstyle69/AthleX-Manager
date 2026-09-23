// Tests pour lib/admin/movementStats.ts (onglet Statistiques de /admin/movements).
//
// Le défaut corrigé : le champ `error` des réponses n'était pas lu, donc une
// lecture refusée s'affichait « Aucun mouvement trouvé », comme une base vide.

import { loadMovementAthletes, loadMovementTotals, STATS_READ_ERROR } from '@/lib/admin/movementStats';

type Res = { data: any[] | null; error: { message: string } | null };

/** Client dont chaque table rend, dans l'ordre des appels, la réponse donnée. */
function client(responses: Record<string, Res[]>) {
  const calls: string[] = [];
  return {
    calls,
    from: (table: string) => {
      calls.push(table);
      const res = responses[table].shift()!;
      const chain: any = {};
      for (const m of ['select', 'order', 'eq', 'limit', 'in']) chain[m] = () => chain;
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
    ] }] });

    const { stats, error } = await loadMovementTotals(c);

    expect(error).toBeNull();
    expect(stats).toEqual([
      { movement: 'row', unit: 'm', total_reps: 5000, athlete_count: 1, best_weight: null },
      { movement: 'thruster', unit: 'reps', total_reps: 500, athlete_count: 2, best_weight: 60 },
      { movement: 'row', unit: 'cal', total_reps: 100, athlete_count: 1, best_weight: null },
    ]);
  });

  it('base vide : aucune erreur, liste vide (« Aucun mouvement trouvé » est alors juste)', async () => {
    const c = client({ user_movement_stats: [{ data: [], error: null }] });
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
