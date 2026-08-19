/**
 * Retour de `apply_program_week` (RPC) et sa mise en phrase.
 *
 * Le compte-rendu doit nommer ce que le serveur a **conservé**, pas seulement ce
 * qu'il a posé : un WOD qui porte un score ou une complétion n'est jamais
 * supprimé par une réapplication de semaine, et l'écran qui prétendrait le
 * contraire mentirait au coach.
 */
export interface ApplyWeekSummary {
  inserted: number;
  replaced: number;
  keptWithResults: number;
  skipped: number;
}

const plural = (n: number, s: string): string => (n > 1 ? `${s}s` : s);

export function applyWeekNotes(s: ApplyWeekSummary): string[] {
  const notes: string[] = [];
  if (s.replaced > 0) {
    notes.push(`${s.replaced} WOD ${plural(s.replaced, 'vierge')} ${plural(s.replaced, 'remplacé')}.`);
  }
  if (s.keptWithResults > 0) {
    notes.push(
      `${s.keptWithResults} WOD ${s.keptWithResults > 1 ? 'conservés' : 'conservé'} car ${s.keptWithResults > 1 ? 'ils portent' : 'il porte'} des scores ou des complétions.`,
    );
  }
  if (s.skipped > 0) {
    notes.push(
      `${s.skipped} WOD ${plural(s.skipped, 'non reposé')} : ${s.skipped > 1 ? 'leur place est tenue' : 'sa place est tenue'} par un WOD conservé.`,
    );
  }
  return notes;
}
