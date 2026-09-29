import { countOf, deCount } from '@/lib/plural';

/**
 * Ligues à divisions (athlex-app #349, #357) : ce que le Manager affiche et
 * dit, sans DOM. L'affectation et la fin de saison sont faites par la base.
 */

export type Placement = 'auto' | 'manual';

/** Pastille de placement : un placement manuel n'est jamais déplacé par la répartition. */
export const PLACEMENT_MANUAL_LABEL = 'Placé à la main';
export const PLACEMENT_MANUAL_HINT = 'Placé à la main : la répartition par ELO ne le déplace jamais.';

/** « Places » d'une division : un entier ≥ 1 (`max_members` est obligatoire en base), sinon nul. */
export function parsePlaces(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/**
 * Remplissage « n / places ». La dernière division prend le reste à la
 * répartition et peut dépasser : on le signale, sans le refuser.
 */
export function divisionFill(count: number, places: number, isLast: boolean): { text: string; over: boolean; note: string | null } {
  const over = count > places;
  return {
    text: `${count} / ${countOf(places, 'place', 'places')}`,
    over,
    note: over
      ? isLast
        ? `Dépasse ${deCount(count - places, 'athlète', 'athlètes')} : la dernière division prend le reste.`
        : `Dépasse ${deCount(count - places, 'athlète', 'athlètes')} (placements à la main).`
      : null,
  };
}

/** Texte de la boîte « Répartir par ELO ». */
export function affectationBody(hasValidatedScore: boolean): string {
  return hasValidatedScore
    ? 'La ligue a déjà des scores validés : seuls les inscrits sans division sont placés, à partir de la division où leur ELO les classe. Personne d’autre ne bouge, et les athlètes placés à la main restent où ils sont.'
    : 'Les athlètes sont répartis par ELO décroissant, de la division du haut vers le bas, selon les places de chaque division ; la dernière prend le reste. Les athlètes placés à la main restent où ils sont.';
}

/** Retour de `affecter_divisions` : le nombre d'athlètes placés. */
export function affectationMessage(placed: number): string {
  return placed === 0
    ? 'Aucun athlète à placer : la répartition est déjà à jour.'
    : `${countOf(placed, 'athlète placé', 'athlètes placés')} par ELO.`;
}

/**
 * Retour de `end_season_and_advance(tournoi, saison attendue)` : la saison en
 * cours après l'appel. Attendue + 1 : la saison est close. Sinon rien n'a
 * bougé (déjà close ailleurs : double clic, autre onglet).
 */
export function endSeasonOutcome(expected: number, returned: number): { closed: boolean; message: string } {
  return returned === expected + 1
    ? { closed: true, message: `Saison ${expected} close : la saison ${returned} commence.` }
    : { closed: false, message: `Saison déjà close : la saison en cours est la saison ${returned}. Rien n’a changé.` };
}

/** Texte de la boîte « Clôturer la saison », avec la confirmation explicite d'une saison sans score. */
export function endSeasonBody(season: number, validatedScores: number): string {
  const base = `Le classement final est archivé, les promus et relégués changent de division et tous les points repartent de 0. Les scores de la saison ${season} ne compteront plus. C’est définitif.`;
  return validatedScores === 0
    ? `Attention : la saison ${season} n’a aucun score validé. La clore archive un classement vide, et les montées et descentes se feront sans résultat. ${base}`
    : base;
}

/** Refus d'une écriture sur les divisions, en français (jamais le message brut). */
export function divisionRefusal(message: string | null | undefined, code?: string | null): string {
  const m = message ?? '';
  if (code === '23505' || /duplicate key|unique/i.test(m)) return 'Cet athlète est déjà dans une division de ce tournoi.';
  if (code === '42501' || /Not authorized|Accès refusé|row-level security/i.test(m)) return 'Tu n’as pas les droits pour gérer ce tournoi.';
  return 'L’action n’a pas abouti. Réessaie, ou contacte le support si ça continue.';
}
