/**
 * Une écriture Supabase peut échouer de deux façons : une erreur explicite, ou
 * zéro ligne touchée parce que la RLS a filtré la cible — ce second cas ne
 * renvoie aucune erreur et passe donc pour un succès. Les deux doivent être
 * remontés à l'utilisateur.
 */
export function writeFailure(
  error: { message: string } | null,
  rows: unknown[] | null,
): string | null {
  if (error) return error.message;
  if (!rows || rows.length === 0) return 'action refusée (droits insuffisants ou ligne introuvable)';
  return null;
}
