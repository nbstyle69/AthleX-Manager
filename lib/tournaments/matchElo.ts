/**
 * Écart d'ELO d'un match de tableau, lu dans `tournament_match_elo_history`
 * (écrit par la base, athlex-app #348) : une ligne par athlète et par match.
 * Le Manager ne calcule rien : il affiche ce que la base a appliqué.
 */

export interface MatchEloRow { match_id: string; athlete_id: string; elo_delta: number }

/** match → athlète → écart appliqué. */
export type MatchEloDeltas = Record<string, Record<string, number>>;

export function matchEloDeltas(rows: MatchEloRow[]): MatchEloDeltas {
  const out: MatchEloDeltas = {};
  for (const r of rows) (out[r.match_id] ??= {})[r.athlete_id] = r.elo_delta;
  return out;
}

/**
 * Écart à afficher pour un athlète : seulement sur un match terminé (un forfait
 * ou une exemption ne bouge pas l'ELO, un match remis à jouer l'a rendu).
 */
export function matchEloDelta(
  deltas: MatchEloDeltas,
  match: { id: string; status: string },
  athleteId: string | null,
): number | null {
  if (!athleteId || match.status !== 'completed') return null;
  const d = deltas[match.id]?.[athleteId];
  return typeof d === 'number' ? d : null;
}

/** « +12 » / « −12 » (vrai signe moins) / « 0 », et le ton : gain = succès, perte = danger. */
export function eloDeltaDisplay(d: number): { text: string; tone: 'success' | 'danger' | 'neutral' } {
  if (d > 0) return { text: `+${d}`, tone: 'success' };
  if (d < 0) return { text: `−${Math.abs(d)}`, tone: 'danger' };
  return { text: '0', tone: 'neutral' };
}
