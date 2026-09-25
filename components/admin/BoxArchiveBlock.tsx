'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { archiveRequest, deleteBox, deleteRequest, patchArchive } from '@/lib/boxArchive';

interface Deletion {
  name: string;
  empty: boolean;
  blockers: string[];
  hasRestrict: boolean;
  counts: { table: string; label: string; count: number }[];
}

/**
 * Archiver, réactiver, supprimer — dans la fiche de box, réservé super admin.
 *
 * Les deux opérations ne sont pas du même ordre et l'écran doit le dire :
 * l'archivage est réversible et se présente en premier ; la suppression est
 * définitive, se grise dès que la box contient quoi que ce soit, et renvoie
 * alors vers l'archivage en nommant ce qui bloque.
 *
 * Les deux confirmations passent par `ConfirmDialog` (lot 7a) : l'appel ne part
 * que de son bouton d'action ; Annuler, la croix et Échap n'exécutent rien.
 */
export default function BoxArchiveBlock({
  boxId, boxName, archivedAt, onChanged,
}: {
  boxId: string;
  boxName: string;
  archivedAt: string | null;
  onChanged: () => void;
}) {
  const archived = !!archivedAt;
  const { dialog, ask } = useConfirmDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);

  // Le décompte est lu à l'ouverture de la fiche : il décide de l'état du
  // bouton, et il est REFAIT côté serveur avant toute suppression.
  const loadDeletion = useCallback(async () => {
    const res = await fetch(`/api/admin/boxes/${boxId}/deletion`, { cache: 'no-store' });
    if (res.ok) setDeletion(await res.json());
  }, [boxId]);

  useEffect(() => { void loadDeletion(); }, [loadDeletion]);

  async function setArchived(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const err = await patchArchive(boxId, next);
      if (err) { setError(err); return; }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(typedName: string) {
    setBusy(true);
    setError(null);
    try {
      const err = await deleteBox(boxId, typedName);
      if (err) { setError(err); void loadDeletion(); return; }
      window.location.href = '/admin/boxes';
    } finally {
      setBusy(false);
    }
  }

  // Les deux boîtes (textes d'avant) : lib/boxArchive.ts.
  function askArchive() {
    ask(archiveRequest(boxName, () => setArchived(true)));
  }

  function askDelete() {
    ask(deleteRequest(boxName, typedName => remove(typedName)));
  }

  const canDelete = deletion?.empty === true && !archived;

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-3" data-testid={`archive-block-${boxId}`}>
      {dialog}
      <h3 className="text-sm font-bold text-ax-text-secondary uppercase tracking-wider flex items-center gap-2">
        <Archive size={14} /> Retirer cette box
      </h3>

      {archived ? (
        <>
          <p className="text-xs text-ax-text-secondary">
            Cette box est archivée depuis le {new Date(archivedAt).toLocaleDateString('fr-FR')}.
            Ses membres n&apos;y ont plus accès et elle n&apos;est plus générée. Rien n&apos;a été supprimé.
          </p>
          <Button
            variant="ax-mint"
            onClick={() => void setArchived(false)}
            disabled={busy}
            data-testid={`reactiver-${boxId}`}
          >
            <ArchiveRestore size={14} /> {busy ? 'Réactivation...' : 'Réactiver cette box'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-ax-text-secondary">
            L&apos;archivage retire la box des annuaires et des listes, et coupe l&apos;accès de ses
            membres. Il est réversible et ne supprime rien.
          </p>
          <Button
            variant="ax-outline"
            onClick={askArchive}
            disabled={busy}
            data-testid={`archiver-${boxId}`}
            className="border-ax-warning text-ax-warning hover:bg-ax-warning-soft"
          >
            <Archive size={14} /> Archiver cette box
          </Button>
        </>
      )}

      <div className="pt-3 border-t border-ax-border space-y-2">
        <Button
          variant="ax-outline"
          onClick={askDelete}
          disabled={busy || !canDelete}
          data-testid={`supprimer-${boxId}`}
          title={archived
            ? 'Réactive la box avant de la supprimer, pour voir ce qu’elle contient'
            : canDelete ? 'Supprimer définitivement' : 'Cette box n’est pas vide'}
          className="border-ax-danger text-ax-danger hover:bg-ax-danger-soft disabled:cursor-not-allowed"
        >
          <Trash2 size={14} /> Supprimer définitivement
        </Button>

        {deletion && !deletion.empty && (
          <div className="text-xs text-ax-text-secondary space-y-1" data-testid={`blocage-${boxId}`}>
            <p className="text-ax-warning break-words">
              Suppression impossible : cette box contient {deletion.blockers.join(', ')}.
            </p>
            <p>Archive-la plutôt : rien ne sera perdu et l&apos;opération se défait.</p>
          </div>
        )}
        {deletion?.empty && !archived && (
          <p className="text-xs text-ax-text-secondary">
            Cette box est vide : aucune donnée ne partirait avec elle.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-ax-danger" data-testid={`archive-error-${boxId}`}>{error}</p>}
    </div>
  );
}
