// Classement d'un tournoi "Classique" : points cumulés par WOD.
// Chaque WOD attribue 100 points au 1er, puis -3 par rang (plancher 1).
// Le sens du tri dépend du type de WOD :
//   "For Time"           → le temps le plus BAS gagne (tri croissant)
//   AMRAP / Max Reps / … → le score le plus HAUT gagne (tri décroissant)

export interface RawScore {
  athlete_id: string;
  score_value: string;
  tournament_wod_id: string;
  wod_type: string | null;
}

// Normalise un score en nombre comparable.
// "8:30" → 510 (secondes), "12:03:04" → hh:mm:ss, "123" → 123, "42,5" → 42.5.
export function parseScoreVal(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':').map((x) => parseFloat(x.replace(',', '.')));
    if (parts.some((p) => Number.isNaN(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const num = parseFloat(s.replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isNaN(num) ? null : num;
}

export function isLowerWinsType(wodType: string | null | undefined): boolean {
  return (wodType ?? '') === 'For Time';
}

// Retourne les points cumulés par athlète.
export function rankClassique(scores: RawScore[]): Record<string, number> {
  const pointsMap: Record<string, number> = {};
  const byWod: Record<string, { athlete_id: string; value: number; type: string | null }[]> = {};

  for (const s of scores) {
    const value = parseScoreVal(s.score_value);
    if (value == null) continue;
    if (!byWod[s.tournament_wod_id]) byWod[s.tournament_wod_id] = [];
    byWod[s.tournament_wod_id].push({ athlete_id: s.athlete_id, value, type: s.wod_type });
  }

  for (const wodScores of Object.values(byWod)) {
    const lowerWins = isLowerWinsType(wodScores[0]?.type);
    const sorted = [...wodScores].sort((a, b) =>
      lowerWins ? a.value - b.value : b.value - a.value,
    );
    sorted.forEach((s, i) => {
      const pts = Math.max(1, 100 - i * 3);
      pointsMap[s.athlete_id] = (pointsMap[s.athlete_id] ?? 0) + pts;
    });
  }

  return pointsMap;
}
