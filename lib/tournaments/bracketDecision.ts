import { countOf } from '@/lib/plural';

/**
 * « Décider selon les scores » (athlex-app #354) : la base décide chaque match
 * en attente d'un tour avec `decide_bracket_round` — même règle que le
 * classement (un For Time terminé bat un CAP ; entre deux CAP, le plus de reps
 * gagne ; puis le tie-break). Le Manager n'applique aucune règle sportive : il
 * reporte les vainqueurs rendus et dit pourquoi un match reste à la main.
 */

export type DecideMotif = 'score_manquant' | 'egalite' | 'wod_absent';
export interface DecideRow { match_id: string; winner_id: string | null; motif: DecideMotif | null }

export const MOTIF_TEXT: Record<DecideMotif, string> = {
  score_manquant: 'À décider à la main : score manquant ou non validé.',
  egalite: 'À décider à la main : égalité parfaite (scores et tie-breaks).',
  wod_absent: 'À décider à la main : aucun WOD pour ce match.',
};

/** Message de fin : le nombre de matchs décidés, tel que rendu par la base. */
export function decidedMessage(rows: DecideRow[]): string {
  const n = rows.filter(r => r.winner_id).length;
  return n === 0 ? 'Aucun match n’a pu être décidé.' : `${countOf(n, 'match décidé', 'matchs décidés')} selon les scores.`;
}

/** Les matchs laissés à la main, avec leur raison. */
export function manualMotifs(rows: DecideRow[]): Record<string, DecideMotif> {
  const out: Record<string, DecideMotif> = {};
  for (const r of rows) if (!r.winner_id && r.motif) out[r.match_id] = r.motif;
  return out;
}

/** Reporte à l'écran les vainqueurs rendus par la base (perdant = l'autre participant). */
export function applyDecidedRows<M extends { id: string; participant1_id: string | null; participant2_id: string | null }>(
  matches: M[], rows: DecideRow[], nowIso: string,
): M[] {
  const won = new Map(rows.filter(r => r.winner_id).map(r => [r.match_id, r.winner_id as string]));
  return matches.map(m => {
    const w = won.get(m.id);
    if (!w) return m;
    return { ...m, winner_id: w, loser_id: w === m.participant1_id ? m.participant2_id : m.participant1_id, status: 'completed', completed_at: nowIso } as M;
  });
}
