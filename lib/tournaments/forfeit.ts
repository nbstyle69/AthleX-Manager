/**
 * Forfait sur un match de tableau (athlex-app #355, migration 20270113) : le
 * Manager écrit le forfait directement sur le match — aucune RPC n'existe, la
 * base garantit la cohérence (contrainte `tournament_bracket_matches_forfait_check`)
 * et n'applique aucun ELO à un forfait (celui d'un match terminé est retiré).
 */

export interface ForfeitMatch {
  participant1_id: string | null;
  participant2_id: string | null;
  status: string;
}

export type ForfeitPatch = { status: 'forfeit'; winner_id: string; loser_id: string };

/**
 * Écriture d'un forfait, déduite du match relu en base : l'absent perd,
 * l'autre athlète du match gagne. Refus si le match n'a pas deux athlètes,
 * est une exemption, ou si l'absent n'en fait pas partie.
 */
export function forfeitPatch(match: ForfeitMatch, absentId: string): ForfeitPatch | { error: string } {
  const { participant1_id: p1, participant2_id: p2 } = match;
  if (match.status === 'bye' || !p1 || !p2 || p1 === p2) {
    return { error: 'Forfait impossible : ce match n’a pas deux athlètes.' };
  }
  if (absentId !== p1 && absentId !== p2) {
    return { error: 'Forfait impossible : cet athlète ne joue pas ce match.' };
  }
  return { status: 'forfeit', winner_id: absentId === p1 ? p2 : p1, loser_id: absentId };
}

/** Texte de la boîte « Déclarer un forfait ». */
export function forfeitBody(alreadyDecided: boolean): string {
  const base = 'L’athlète absent perd le match et son adversaire passe au tour suivant. Un forfait ne donne ni ne retire aucun point ELO.';
  return alreadyDecided
    ? `${base} Ce match avait déjà un résultat : l’ELO gagné ou perdu sur ce match est rendu aux deux athlètes.`
    : base;
}

/** Refus de l'écriture d'un forfait, en français. */
export function forfeitRefusal(message: string | null | undefined, code?: string | null): string | null {
  const m = message ?? '';
  if (code === '23514' || /forfait_check|check constraint/i.test(m)) {
    return 'Forfait impossible : le match doit opposer deux athlètes, et l’absent doit en faire partie.';
  }
  return null;
}

/** Match décidé : victoire ou forfait (une exemption n'est pas un résultat à corriger). */
export function isDecided(status: string): boolean {
  return status === 'completed' || status === 'forfeit';
}
