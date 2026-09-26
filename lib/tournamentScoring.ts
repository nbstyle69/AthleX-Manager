// Mise en forme des scores de tournoi. Le classement (barème, rangs) est
// calculé par la base depuis athlex-app #359 à #365 : aucun barème ici.

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
