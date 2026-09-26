/**
 * Lecture de `get_box_dunning` (panneau des impayés). La fonction lève `42501`
 * pour un non-gérant : un refus ou un échec s'affiche comme tel, jamais comme
 * « aucun impayé ». Une liste vide, elle, reste « rien à montrer ».
 */
export const DUNNING_FORBIDDEN = "Tu n'as pas accès aux impayés de cette box.";
export const DUNNING_FAILED = 'Les impayés n’ont pas pu être chargés. Réessaie dans un instant.';

export function dunningLoad<T>(res: { data: unknown; error: { code?: string } | null }): { rows: T[]; message: string | null } {
  if (res.error) return { rows: [], message: res.error.code === '42501' ? DUNNING_FORBIDDEN : DUNNING_FAILED };
  return { rows: (Array.isArray(res.data) ? res.data : []) as T[], message: null };
}
