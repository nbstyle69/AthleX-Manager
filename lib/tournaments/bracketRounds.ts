/**
 * Tours du tableau (athlex-app #352, #353). En double élimination (`swiss`),
 * les deux tableaux avancent au même numéro de tour : le « dernier tour » est
 * le plus grand, tous tableaux confondus, grande finale comprise. C'est la base
 * (`advance_bracket_round`) qui crée le tour suivant, la grande finale et, s'il
 * est dû, le match décisif : le Manager ne décide jamais de ce qui suit, il dit
 * seulement quand le bouton a un sens. Le tableau simple (`bracket`) garde sa
 * règle d'avant, sur le seul tableau des gagnants.
 */

export interface RoundMatch { round: number; side: string; winner_id: string | null }

/** Le tour sur lequel avancer ou décider. */
export function lastRound(matches: RoundMatch[], format: string): number | null {
  const pool = format === 'swiss' ? matches : matches.filter(m => m.side === 'winner');
  return pool.length ? Math.max(...pool.map(m => m.round)) : null;
}

/**
 * « Tour suivant » disponible : tous les matchs du dernier tour sont décidés
 * (vainqueur connu : victoire, exemption ou forfait).
 *   - swiss : y compris après la grande finale (la base crée le match décisif
 *     s'il est dû), plus après le match décisif ;
 *   - bracket : inchangé, pas après la finale (un seul match au dernier tour).
 */
export function canAdvance(matches: RoundMatch[], format: string): boolean {
  const r = lastRound(matches, format);
  if (r == null) return false;
  if (format === 'swiss') {
    if (matches.filter(m => m.side === 'grand_final').length >= 2) return false;
    return matches.filter(m => m.round === r).every(m => m.winner_id !== null);
  }
  const last = matches.filter(m => m.side === 'winner' && m.round === r);
  return last.every(m => m.winner_id !== null) && last.length !== 1;
}

/** Les lignes de grande finale, par tour croissant, avec leur titre. */
export function grandFinals<M extends RoundMatch>(matches: M[]): { match: M; title: string }[] {
  return matches
    .filter(m => m.side === 'grand_final')
    .sort((a, b) => a.round - b.round)
    .map((match, i) => ({ match, title: i === 0 ? 'Grande finale' : 'Grande finale — match décisif' }));
}

/** Colonne du tableau des perdants, numérotée depuis 1 (son premier tour est le tour 2 de la base). */
export function loserRoundTitle(index: number): string {
  return `Tour ${index + 1} des perdants`;
}
