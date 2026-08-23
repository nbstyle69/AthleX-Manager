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
  capped?: boolean | null;
  tiebreak_value?: number | null;
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

// Encodage hérité d'avant la colonne `capped` : score_value = DNF_BASE + reps.
export const DNF_BASE = 999999;

export interface NormalizedScore {
  /** Secondes si non capped sur un For Time, reps sinon. `null` = non parsable. */
  value: number | null;
  capped: boolean;
}

/**
 * Ramène (score_value, capped) à la convention actuelle, y compris l'encodage
 * hérité DNF_BASE + reps. Miroir de la normalisation SQL de
 * recalc_division_points / compute_league_wod_elo.
 */
export function normalizeWodScore(
  scoreValue: string | null | undefined,
  capped: boolean | null | undefined,
  isTime: boolean,
): NormalizedScore {
  const raw = parseScoreVal(scoreValue);
  if (raw == null) return { value: null, capped: false };
  if (!isTime) return { value: raw, capped: false };
  if (raw >= DNF_BASE) return { value: raw - DNF_BASE, capped: true };
  return { value: raw, capped: !!capped };
}

/**
 * Comparateur de classement d'un WOD, miroir de l'ORDER BY serveur :
 * finishers avant cappés, puis temps croissant (finisher d'un For Time),
 * reps décroissantes (cappé, ou WOD non chronométré). Un score non parsable
 * vaut +Infinity côté temps et -Infinity côté reps — le COALESCE du serveur,
 * qui le place en queue de son propre groupe et non en queue de classement.
 */
export function compareWodScores(a: NormalizedScore, b: NormalizedScore, isTime: boolean): number {
  const cappedDiff = (a.capped ? 1 : 0) - (b.capped ? 1 : 0);
  if (cappedDiff !== 0) return cappedDiff;
  if (a.value == null && b.value == null) return 0;
  if (a.value == null) return 1;
  if (b.value == null) return -1;
  if (isTime && !a.capped) return a.value - b.value;
  return b.value - a.value;
}

export interface WodScore {
  athlete_id: string;
  score_value: string;
  capped?: boolean | null;
  tiebreak_value?: number | null;
}

export interface RankedWodScore<T> {
  score: T;
  rank: number;
  normalized: NormalizedScore;
  isExAequo: boolean;
}

/**
 * Classe les scores d'un WOD dans l'ordre du serveur, avec rang PARTAGÉ sur
 * les ex-aequo — convention d'affichage de l'app (le serveur, lui, tranche par
 * ROW_NUMBER pour attribuer des points, deux ex-aequo n'ont donc pas les mêmes
 * points).
 */
export function rankWodScores<T extends WodScore>(
  scores: T[],
  wodType: string | null | undefined,
): RankedWodScore<T>[] {
  const isTime = isLowerWinsType(wodType);
  const entries = scores.map((score) => ({
    score,
    normalized: normalizeWodScore(score.score_value, score.capped, isTime),
  }));
  const sorted = [...entries].sort((a, b) => {
    const byScore = compareWodScores(a.normalized, b.normalized, isTime);
    if (byScore !== 0) return byScore;
    const byTiebreak =
      (a.score.tiebreak_value ?? Infinity) - (b.score.tiebreak_value ?? Infinity);
    if (byTiebreak !== 0 && Number.isFinite(byTiebreak)) return byTiebreak;
    // Ordre d'affichage stable entre deux rechargements, à rang égal.
    return a.score.athlete_id.localeCompare(b.score.athlete_id);
  });

  const sameKey = (
    a: (typeof sorted)[number],
    b: (typeof sorted)[number],
  ) =>
    a.normalized.value === b.normalized.value &&
    a.normalized.capped === b.normalized.capped &&
    (a.score.tiebreak_value ?? null) === (b.score.tiebreak_value ?? null);

  let currentRank = 1;
  return sorted.map((entry, i) => {
    if (i > 0 && !sameKey(entry, sorted[i - 1])) currentRank = i + 1;
    return {
      score: entry.score,
      rank: currentRank,
      normalized: entry.normalized,
      isExAequo: sorted.some((other) => other !== entry && sameKey(other, entry)),
    };
  });
}

/** Affichage d'un score : mm:ss pour un finisher de For Time, « CAP + n reps » pour un cappé. */
export function formatWodScore(
  scoreValue: string,
  capped: boolean | null | undefined,
  wodType: string | null | undefined,
): string {
  const isTime = isLowerWinsType(wodType);
  const n = normalizeWodScore(scoreValue, capped, isTime);
  if (n.value == null) return scoreValue;
  if (!isTime) return String(n.value);
  if (n.capped) return `CAP + ${n.value} reps`;
  const total = Math.round(n.value);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface MatchSide {
  score_value: string;
  capped?: boolean | null;
  status: string;
}

/**
 * Vainqueur d'un duel de bracket d'après les scores soumis, ou `null` quand le
 * duel n'est pas décidable sans l'owner : score manquant, non validé, illisible,
 * ou égalité stricte. Même ordre que le classement, donc que le serveur.
 */
export function decideMatchWinner<A, B>(
  a: { id: A; submission: MatchSide | undefined | null },
  b: { id: B; submission: MatchSide | undefined | null },
  wodType: string | null | undefined,
): A | B | null {
  const sa = a.submission;
  const sb = b.submission;
  if (!sa || !sb || sa.status !== 'validated' || sb.status !== 'validated') return null;
  const isTime = isLowerWinsType(wodType);
  const na = normalizeWodScore(sa.score_value, sa.capped, isTime);
  const nb = normalizeWodScore(sb.score_value, sb.capped, isTime);
  if (na.value == null || nb.value == null) return null;
  const cmp = compareWodScores(na, nb, isTime);
  if (cmp === 0) return null;
  return cmp < 0 ? a.id : b.id;
}

// Retourne les points cumulés par athlète.
export function rankClassique(scores: RawScore[]): Record<string, number> {
  const pointsMap: Record<string, number> = {};
  const byWod: Record<string, RawScore[]> = {};

  for (const s of scores) {
    if (!byWod[s.tournament_wod_id]) byWod[s.tournament_wod_id] = [];
    byWod[s.tournament_wod_id].push(s);
  }

  for (const wodScores of Object.values(byWod)) {
    const ranked = rankWodScores(wodScores, wodScores[0]?.wod_type);
    ranked.forEach((r, i) => {
      if (r.normalized.value == null) return;
      const pts = Math.max(1, 100 - i * 3);
      pointsMap[r.score.athlete_id] = (pointsMap[r.score.athlete_id] ?? 0) + pts;
    });
  }

  return pointsMap;
}
