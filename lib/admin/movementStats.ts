/**
 * Onglet « Statistiques » de /admin/movements : lectures de `user_movement_stats`
 * (policy `user_movement_stats_superadmin_read`) et des pseudos.
 *
 * Chaque réponse est lue avec son `error` : une lecture refusée ou en échec
 * rendait un tableau vide, affiché « Aucun mouvement trouvé » — une panne
 * déguisée en base vide. Le message remonte désormais à l'écran.
 */

export type MovementUnit = 'reps' | 'm' | 'cal';

export interface MovementStat {
  movement: string;
  unit: MovementUnit;
  /** Total dans `unit` (reps, mètres ou calories). */
  total_reps: number;
  athlete_count: number;
  best_weight: number | null;
}

export interface AthleteMovement {
  user_id: string;
  username: string;
  movement: string;
  unit: MovementUnit;
  total_reps: number;
  best_weight: number | null;
}

type Result<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Le sous-ensemble du client Supabase dont ces lectures ont besoin. */
export interface StatsReader {
  from: (table: string) => any;
}

export const STATS_READ_ERROR = 'Lecture des statistiques impossible';

/** Tous les cumuls, agrégés par mouvement × unité (mètres et calories d'un Row sont deux compteurs). */
export async function loadMovementTotals(supabase: StatsReader): Promise<{ stats: MovementStat[]; error: string | null }> {
  const { data, error } = await (supabase
    .from('user_movement_stats')
    .select('movement, unit, total_reps, best_weight, user_id')
    .order('total_reps', { ascending: false }) as Result<any>);
  if (error) return { stats: [], error: `${STATS_READ_ERROR} : ${error.message}` };

  const byKey = new Map<string, MovementStat>();
  for (const r of data ?? []) {
    const unit: MovementUnit = r.unit ?? 'reps';
    const key = `${r.movement}|${unit}`;
    const agg = byKey.get(key) ?? { movement: r.movement, unit, total_reps: 0, athlete_count: 0, best_weight: null };
    agg.total_reps += Number(r.total_reps);
    agg.athlete_count += 1;
    if (r.best_weight && (!agg.best_weight || r.best_weight > agg.best_weight)) agg.best_weight = r.best_weight;
    byKey.set(key, agg);
  }
  return { stats: [...byKey.values()].sort((a, b) => b.total_reps - a.total_reps), error: null };
}

/** Les 50 premiers athlètes d'un mouvement × unité, avec leur pseudo. */
export async function loadMovementAthletes(
  supabase: StatsReader,
  movement: string,
  unit: MovementUnit,
): Promise<{ athletes: AthleteMovement[]; error: string | null }> {
  const { data, error } = await (supabase
    .from('user_movement_stats')
    .select('user_id, movement, unit, total_reps, best_weight')
    .eq('movement', movement)
    .eq('unit', unit)
    .order('total_reps', { ascending: false })
    .limit(50) as Result<any>);
  if (error) return { athletes: [], error: `${STATS_READ_ERROR} : ${error.message}` };

  const rows = data ?? [];
  const { data: profiles, error: profilesError } = await (supabase
    .from('profiles')
    .select('id, username')
    .in('id', rows.map(r => r.user_id)) as Result<{ id: string; username: string }>);
  // Sans pseudos, la liste resterait lisible mais trompeuse (« ? » partout) :
  // on le dit plutôt que d'afficher des anonymes.
  if (profilesError) return { athletes: [], error: `${STATS_READ_ERROR} (pseudos) : ${profilesError.message}` };

  const names = new Map((profiles ?? []).map(p => [p.id, p.username]));
  return { athletes: rows.map(r => ({ ...r, username: names.get(r.user_id) ?? '?' })), error: null };
}
