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

/**
 * WOD d'un match : le sien (`wod_id`) ; sinon celui de l'étape de son tour,
 * mais seulement pour un match du tableau des gagnants, ou en élimination
 * simple (inchangé). En double élimination, les deux tableaux partagent les
 * numéros de tour : un match des perdants ou une grande finale n'emprunte
 * jamais le WOD des gagnants du même tour.
 */
export function matchWodId(
  match: { wod_id: string | null; side: string; round: number },
  format: string,
  stageWodId: (round: number) => string | undefined,
): string | undefined {
  if (match.wod_id) return match.wod_id;
  return format !== 'swiss' || match.side === 'winner' ? stageWodId(match.round) : undefined;
}

/**
 * WOD de tour passé à `decide_bracket_round` : aucun en double élimination (il
 * s'appliquerait aussi aux perdants du même tour) — chaque match y est décidé
 * sur son propre WOD ; en élimination simple, celui de l'étape, comme avant.
 */
export function decideRoundWodId(format: string, stageWodId: string | null): string | null {
  return format === 'swiss' ? null : stageWodId;
}

/**
 * Où se trouve un match, pour le dire sans ambiguïté en double élimination
 * (les deux tableaux ont chacun un « Match #1 » au même tour) : le titre de
 * sa colonne pour un match des perdants ou une grande finale, rien sinon.
 */
export function matchPlace<M extends RoundMatch & { id: string }>(match: M, matches: M[], format: string): string | null {
  if (format !== 'swiss' || match.side === 'winner') return null;
  if (match.side === 'grand_final') return grandFinals(matches).find(g => g.match.id === match.id)?.title ?? null;
  if (match.side === 'loser') {
    const rounds = [...new Set(matches.filter(m => m.side === 'loser').map(m => m.round))].sort((a, b) => a - b);
    return loserRoundTitle(rounds.indexOf(match.round));
  }
  return null;
}

/**
 * WOD d'une colonne du tableau des perdants : celui des matchs pas encore joués
 * (ce que la liste « WOD de ce tour » vient d'écrire), sinon celui d'un match
 * déjà joué ; aucun si aucun match n'en a. Une exemption ne compte pas.
 */
export function loserColumnWodId(matches: { wod_id: string | null; winner_id: string | null; status: string }[]): string | null {
  const real = matches.filter(m => m.status !== 'bye');
  return real.find(m => !m.winner_id && m.wod_id)?.wod_id ?? real.find(m => m.wod_id)?.wod_id ?? null;
}
