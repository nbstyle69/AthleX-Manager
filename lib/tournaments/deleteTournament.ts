import { isResultsRefusal, tournamentRefusal } from '@/lib/tournaments/refusals';

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
 * Archivage (athlex-app #371) : un tournoi qui a un résultat validé ne se
 * supprime plus (`TOURNOI_AVEC_RESULTATS`) ; on rend `ARCHIVE_INSTEAD`, et
 * l'écran propose l'archivage. Tout autre refus est dit en français.
 *
 * @returns `null` si le tournoi est supprimé (la navigation est lancée),
 *          `ARCHIVE_INSTEAD` s'il faut l'archiver, sinon le message à afficher
 *          — rien n'a alors changé.
 */

type DeleteClient = {
  from: (table: 'tournaments') => {
    delete: () => {
      eq: (col: 'id', value: string) => {
        select: (cols: 'id') => PromiseLike<{ data: { id: string }[] | null; error: { message: string; code?: string } | null }>;
      };
    };
  };
};

export const NOT_DELETED =
  'Le tournoi n’a pas été supprimé : il n’existe plus, ou tu n’as pas les droits pour le supprimer.';

export const ARCHIVE_INSTEAD = 'ARCHIVE_INSTEAD' as const;

export async function deleteTournamentAndLeave(
  supabase: DeleteClient,
  tournamentId: string,
  router: { replace: (href: string) => void },
): Promise<string | null> {
  const { data, error } = await supabase.from('tournaments').delete().eq('id', tournamentId).select('id');
  if (error) return isResultsRefusal(error.message) ? ARCHIVE_INSTEAD : tournamentRefusal(error.message, error.code);
  if (!data || data.length === 0) return NOT_DELETED;
  router.replace('/tournaments');
  return null;
}
