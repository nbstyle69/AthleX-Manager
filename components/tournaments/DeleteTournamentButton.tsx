'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle, Archive, ArchiveRestore } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ARCHIVE_INSTEAD, deleteTournamentAndLeave } from '@/lib/tournaments/deleteTournament';
import { archiveRequest, setTournamentArchived, unarchiveRequest } from '@/lib/tournaments/archive';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';

interface Props {
  tournamentId: string;
  /** Pour les fenêtres d'archivage. */
  name: string;
  /** Tournoi archivé : « Désarchiver ». */
  archivedAt: string | null;
  /** Résultat validé vu par le Manager : « Archiver » au lieu de « Supprimer ». */
  hasResults: boolean;
}

/**
 * Supprimer, archiver ou désarchiver un tournoi (athlex-app #371). Un tournoi
 * qui a un résultat validé s'archive ; si la base refuse une suppression que
 * le Manager croyait possible (`TOURNOI_AVEC_RESULTATS`), l'archivage est
 * proposé à la place.
 */
export default function DeleteTournamentButton({ tournamentId, name, archivedAt, hasResults }: Props) {
  const router = useRouter();
  const { dialog, ask, inform } = useConfirmDialog();
  const [open,     setOpen]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function setArchived(archived: boolean) {
    const err = await setTournamentArchived(createClient(), tournamentId, archived);
    if (err) { void inform({ kind: 'error', title: ERROR_TITLE, body: err }); return; }
    router.refresh();
  }
  const askArchive = () => ask(archiveRequest(name, () => setArchived(true)));
  const askUnarchive = () => ask(unarchiveRequest(name, () => setArchived(false)));

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const err = await deleteTournamentAndLeave(createClient(), tournamentId, router);
    setDeleting(false);
    if (err === ARCHIVE_INSTEAD) { setOpen(false); askArchive(); return; }
    if (err) { setError(err); return; }
    setOpen(false);
  }

  if (archivedAt) {
    return (
      <>
        {dialog}
        <button onClick={askUnarchive} data-testid="desarchiver-tournoi"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
          <ArchiveRestore size={13} /> Désarchiver
        </button>
      </>
    );
  }

  if (hasResults) {
    return (
      <>
        {dialog}
        <button onClick={askArchive} data-testid="archiver-tournoi"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
          <Archive size={13} /> Archiver
        </button>
      </>
    );
  }

  return (
    <>
      {dialog}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-colors">
        <Trash2 size={13} /> Supprimer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-black text-white mb-1">Supprimer ce tournoi ?</h2>
                <p className="text-sm text-gray-400">
                  Cette action est <strong className="text-white">irréversible</strong>.
                  Les WODs, participants et scores associés seront également supprimés.
                </p>
                {error && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">{error}</div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
