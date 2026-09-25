'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedName, setTypedName] = useState('');
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
      const res = await fetch(`/api/admin/boxes/${boxId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? `Erreur ${res.status}`); return; }
      onChanged();
    } finally {
      setBusy(false);
      setConfirmArchive(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/boxes/${boxId}/deletion`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typedName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? `Erreur ${res.status}`); void loadDeletion(); return; }
      window.location.href = '/admin/boxes';
    } finally {
      setBusy(false);
    }
  }

  const canDelete = deletion?.empty === true && !archived;

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-3" data-testid={`archive-block-${boxId}`}>
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
            onClick={() => setConfirmArchive(true)}
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
          onClick={() => { setTypedName(''); setConfirmDelete(true); }}
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

      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="bg-ax-surface border border-ax-border shadow-ax-panel rounded-ax-panel p-6 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-ax-warning shrink-0 mt-1" />
              <h2 className="min-w-0 font-display text-xl font-medium tracking-wide text-ax-text break-words">Archiver « {boxName} » ?</h2>
            </div>
            <p className="text-sm text-ax-text-secondary">
              Ses membres perdront l&apos;accès à la box : elle disparaîtra de leur application,
              de l&apos;annuaire public et des recherches. La programmation automatique ne la
              générera plus.
            </p>
            <p className="text-sm text-ax-success">
              Rien n&apos;est supprimé, et l&apos;opération se défait : « Réactiver » remet tout en place.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button variant="ax-outline" onClick={() => setConfirmArchive(false)} className="flex-1">
                Annuler
              </Button>
              {/* Ambre plein comme avant : l'archivage est réversible, pas destructif. */}
              <button
                onClick={() => void setArchived(true)}
                disabled={busy}
                data-testid={`archiver-confirmer-${boxId}`}
                className="flex-1 min-h-10 px-5 py-2 rounded-ax-control border border-ax-warning bg-ax-warning text-sm font-semibold text-ax-background transition-[filter] hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface motion-reduce:transition-none"
              >
                {busy ? 'Archivage...' : 'Archiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="bg-ax-surface border border-ax-border shadow-ax-panel rounded-ax-panel p-6 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto space-y-4">
            <div className="flex items-start gap-2">
              <Trash2 size={18} className="text-ax-danger shrink-0 mt-1" />
              <h2 className="min-w-0 font-display text-xl font-medium tracking-wide text-ax-text break-words">Supprimer « {boxName} » ?</h2>
            </div>
            <p className="text-sm text-ax-text-secondary">
              La box et tout ce qui s&apos;y rattache seront supprimés définitivement. Le compte du
              propriétaire n&apos;est pas touché : il perd seulement son rôle sur cette box.
            </p>
            <div>
              <label className="block text-xs font-bold text-ax-text-secondary uppercase tracking-wider mb-1.5">
                Retape le nom exact de la box
              </label>
              <Input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                autoFocus
                placeholder={boxName}
                data-testid={`supprimer-saisie-${boxId}`}
              />
            </div>
            {error && <p className="text-xs text-ax-danger">{error}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button variant="ax-outline" onClick={() => { setConfirmDelete(false); setError(null); }} className="flex-1">
                Annuler
              </Button>
              <Button
                variant="ax-danger"
                onClick={() => void remove()}
                disabled={busy || typedName.trim() !== boxName}
                data-testid={`supprimer-confirmer-${boxId}`}
                className="flex-1 disabled:cursor-not-allowed"
              >
                {busy ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
