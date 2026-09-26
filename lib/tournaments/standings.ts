import { formatWodScore } from '@/lib/tournamentScoring';

/**
 * Classement d'un tournoi, calculé par la base (athlex-app #359, #360, #361,
 * #363 à #365) : barème de la compétition classique (100, 97, 95, 93…), rang
 * de compétition (ex-aequo : même rang, mêmes points, le rang suivant sauté).
 * Le Manager n'a plus de barème : il lit et met en forme.
 *   - général : `tournament_classique_standings` (classique) ou
 *     `tournament_ligue_standings` (ligue, saison en cours ou passée) ;
 *   - par WOD : `tournament_classique_wod_ranks`.
 */

export const SCALE_NOTE = 'Barème : 100, 97, 95, 93… Ex-aequo : même rang, mêmes points, le rang suivant est sauté.';

export interface StandingRow { athlete_id: string; points: number; final_rank: number }
export interface WodRankRow { athlete_id: string; tournament_wod_id: string; wod_rank: number; points: number }
type Profile = { username: string; level: string; elo: number };

/** Général : le rang et les points de la base, dans l'ordre du rang. */
export function generalFromBase(
  rows: StandingRow[],
  profiles: Record<string, Profile>,
  eloChange: Record<string, number>,
) {
  return [...rows]
    .sort((a, b) => a.final_rank - b.final_rank || (profiles[a.athlete_id]?.username ?? '').localeCompare(profiles[b.athlete_id]?.username ?? ''))
    .map(r => ({
      rank: r.final_rank,
      athlete_id: r.athlete_id,
      total_score: r.points,
      username: profiles[r.athlete_id]?.username ?? null,
      level: profiles[r.athlete_id]?.level ?? null,
      elo: profiles[r.athlete_id]?.elo ?? null,
      elo_change: eloChange[r.athlete_id] ?? null,
    }));
}

/** Par WOD : le rang et les points de la base ; le score affiché vient du score validé. */
export function wodRankingsFromBase(
  wods: { id: string; title: string; order_index: number; type: string | null }[],
  ranks: WodRankRow[],
  scores: { athlete_id: string; tournament_wod_id: string; score_value: string; capped: boolean | null }[],
  profiles: Record<string, Profile>,
) {
  return wods.map(wod => {
    const rows = ranks.filter(r => r.tournament_wod_id === wod.id);
    return {
      wod_id: wod.id,
      wod_title: wod.title,
      order_index: wod.order_index,
      scores: [...rows]
        .sort((a, b) => a.wod_rank - b.wod_rank || (profiles[a.athlete_id]?.username ?? '').localeCompare(profiles[b.athlete_id]?.username ?? ''))
        .map(r => {
          const s = scores.find(x => x.tournament_wod_id === wod.id && x.athlete_id === r.athlete_id);
          return {
            rank: r.wod_rank,
            points: r.points,
            athlete_id: r.athlete_id,
            score_value: s?.score_value ?? '',
            score_display: s ? formatWodScore(s.score_value, s.capped, wod.type) : '—',
            is_ex_aequo: rows.some(o => o !== r && o.wod_rank === r.wod_rank),
            username: profiles[r.athlete_id]?.username ?? null,
            level: profiles[r.athlete_id]?.level ?? null,
          };
        }),
    };
  });
}

/** Choix de saison d'une ligue : la saison en cours, puis les saisons terminées (la plus récente d'abord). */
export function seasonOptions(currentSeason: number): { season: number | null; label: string }[] {
  const past = Array.from({ length: Math.max(0, currentSeason - 1) }, (_, i) => currentSeason - 1 - i);
  return [{ season: null, label: 'Saison en cours' }, ...past.map(n => ({ season: n, label: `Saison ${n}` }))];
}

/** Saison demandée dans l'adresse (`?saison=n`), seulement si elle est terminée ; sinon la saison en cours (null). */
export function requestedSeason(raw: string | undefined, currentSeason: number): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n < currentSeason ? n : null;
}
