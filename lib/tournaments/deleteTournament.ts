/**
 * Suppression d'un tournoi depuis sa fiche ou sa page d'édition.
 *
 * Deux défauts corrigés :
 *   - `router.push('/tournaments')` puis `router.refresh()` : la navigation
 *     n'est pas attendue, donc le rafraîchissement rechargeait encore la route
 *     du tournoi supprimé, qui répond alors 404. On remplace la route, sans
 *     rafraîchir : la liste, rendue côté serveur à chaque visite, arrive à jour,
 *     et « Retour » ne ramène pas sur un tournoi qui n'existe plus.
 *   - un refus de la RLS ne renvoie pas d'erreur, seulement aucune ligne
 *     supprimée : le gérant quittait la page comme si le tournoi avait disparu.
 *     On relit les lignes supprimées, et « aucune » est un échec.
 *
 * @returns `null` si le tournoi est supprimé (la navigation est lancée), sinon
 *          le message à afficher — rien n'a alors changé.
 */

type DeleteClient = {
  from: (table: 'tournaments') => {
    delete: () => {
      eq: (col: 'id', value: string) => {
        select: (cols: 'id') => PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>;
      };
    };
  };
};

export const NOT_DELETED =
  'Le tournoi n’a pas été supprimé : il n’existe plus, ou tu n’as pas les droits pour le supprimer.';

export async function deleteTournamentAndLeave(
  supabase: DeleteClient,
  tournamentId: string,
  router: { replace: (href: string) => void },
): Promise<string | null> {
  const { data, error } = await supabase.from('tournaments').delete().eq('id', tournamentId).select('id');
  if (error) return error.message;
  if (!data || data.length === 0) return NOT_DELETED;
  router.replace('/tournaments');
  return null;
}
