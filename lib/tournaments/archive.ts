import type { ConfirmRequest } from '@/lib/confirmDialog';
import { fullDate } from '@/lib/confirmDialog';
import { tournamentRefusal } from '@/lib/tournaments/refusals';

/**
 * Archivage des tournois (athlex-app #371, migration `20270124`) : un tournoi
 * qui a un résultat validé ne se supprime plus, il s'archive. Archivé, il sort
 * des listes ; ses résultats, ses classements et l'ELO restent. Mêmes droits
 * que la suppression (`is_box_admin` : gérant, co-gérant, coach).
 */

/**
 * Ce que le Manager voit d'un résultat validé : tournoi clôturé, match de
 * tableau terminé ou forfait, score validé. La base connaît aussi les saisons
 * closes et les historiques ELO : sur son refus (`TOURNOI_AVEC_RESULTATS`) à
 * la suppression, l'archivage est proposé à ce moment-là.
 */
export function hasValidatedResult(t: { status: string; finishedMatches: number; validatedScores: number }): boolean {
  return t.status === 'completed' || t.finishedMatches > 0 || t.validatedScores > 0;
}

export const ARCHIVE_BODY = 'Ce tournoi a des résultats validés : il ne peut pas être supprimé. Archivé, il n’apparaît plus dans les listes, mais ses résultats, ses classements et l’ELO gagné par les athlètes sont conservés. Tu pourras le désarchiver.';
export const UNARCHIVE_BODY = 'Il réapparaît dans les listes, avec ses résultats. S’il était ouvert aux inscriptions et que sa date de début est passée, il démarrera automatiquement dans les 15 minutes.';

export function archiveRequest(name: string, run: () => unknown): ConfirmRequest {
  return { title: 'Archiver ce tournoi ?', element: name, body: ARCHIVE_BODY, confirmLabel: 'Archiver', cancelLabel: 'Annuler', run };
}

export function unarchiveRequest(name: string, run: () => unknown): ConfirmRequest {
  return { title: 'Désarchiver ce tournoi ?', element: name, body: UNARCHIVE_BODY, confirmLabel: 'Désarchiver', cancelLabel: 'Annuler', run };
}

export function archivedBanner(archivedAt: string): string {
  return `Tournoi archivé le ${fullDate(archivedAt)}. Il n’apparaît plus dans les listes ; ses résultats, ses classements et l’ELO gagné sont conservés.`;
}

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string; code?: string } | null }> };

/** Archive ou désarchive ; `null` si c'est fait, sinon le refus en français. */
export async function setTournamentArchived(supabase: Rpc, tournamentId: string, archived: boolean): Promise<string | null> {
  const { error } = await supabase.rpc(archived ? 'archive_tournament' : 'unarchive_tournament', { p_tournament_id: tournamentId });
  return error ? tournamentRefusal(error.message, error.code) : null;
}
