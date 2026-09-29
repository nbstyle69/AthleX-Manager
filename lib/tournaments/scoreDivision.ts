/**
 * Division figée du score (athlex-app #350, migration 20270108) : la base
 * pose `tournament_scores.division_id` à l'insertion, d'après la division de
 * l'athlète à cet instant ; le gérant peut la corriger, l'athlète non.
 *
 * Changer cette colonne ne relance PAS le recalcul des points de division :
 * le déclencheur de la base ne réagit qu'au statut et à la valeur du score.
 */

export interface DivisionOption { id: string; name: string }

/** Ce que la carte du score affiche : sa division, et l'actuelle si elle diffère. */
export function scoreDivisionInfo(
  scoreDivisionId: string | null,
  currentDivisionId: string | null,
  divisions: DivisionOption[],
): { label: string; current: string | null } {
  const name = (id: string | null) => (id ? divisions.find(d => d.id === id)?.name ?? 'Division supprimée' : null);
  const label = name(scoreDivisionId) ?? 'Aucune division';
  const differs = !!currentDivisionId && currentDivisionId !== scoreDivisionId;
  return { label, current: differs ? name(currentDivisionId) : null };
}

/** Quand les points bougent après une correction : au prochain recalcul de la base. */
export const SCORE_DIVISION_NOTE = 'Les points de division seront recalculés au prochain score validé, rejeté ou corrigé du tournoi.';

export function scoreDivisionBody(validated: boolean): string {
  return validated
    ? `Ce score validé sera classé dans cette division, avec les athlètes qui y ont joué ce WOD. ${SCORE_DIVISION_NOTE}`
    : `Ce score sera classé dans cette division une fois validé. ${SCORE_DIVISION_NOTE}`;
}
