'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, AlertTriangle } from 'lucide-react';

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
    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-3" data-testid={`archive-block-${boxId}`}>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Archive size={14} /> Retirer cette box
      </h3>

      {archived ? (
        <>
          <p className="text-xs text-gray-500">
            Cette box est archivée depuis le {new Date(archivedAt).toLocaleDateString('fr-FR')}.
            Ses membres n&apos;y ont plus accès et elle n&apos;est plus générée. Rien n&apos;a été supprimé.
          </p>
          <button
            onClick={() => void setArchived(false)}
            disabled={busy}
            data-testid={`reactiver-${boxId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
          >
            <ArchiveRestore size={14} /> {busy ? 'Réactivation...' : 'Réactiver cette box'}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            L&apos;archivage retire la box des annuaires et des listes, et coupe l&apos;accès de ses
            membres. Il est réversible et ne supprime rien.
          </p>
          <button
            onClick={() => setConfirmArchive(true)}
            disabled={busy}
            data-testid={`archiver-${boxId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 text-sm font-bold transition-colors"
          >
            <Archive size={14} /> Archiver cette box
          </button>
        </>
      )}

      <div className="pt-3 border-t border-white/[0.06] space-y-2">
        <button
          onClick={() => { setTypedName(''); setConfirmDelete(true); }}
          disabled={busy || !canDelete}
          data-testid={`supprimer-${boxId}`}
          title={archived
            ? 'Réactive la box avant de la supprimer, pour voir ce qu’elle contient'
            : canDelete ? 'Supprimer définitivement' : 'Cette box n’est pas vide'}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-colors"
        >
          <Trash2 size={14} /> Supprimer définitivement
        </button>

        {deletion && !deletion.empty && (
          <div className="text-xs text-gray-500 space-y-1" data-testid={`blocage-${boxId}`}>
            <p className="text-amber-400">
              Suppression impossible : cette box contient {deletion.blockers.join(', ')}.
            </p>
            <p>Archive-la plutôt : rien ne sera perdu et l&apos;opération se défait.</p>
          </div>
        )}
        {deletion?.empty && !archived && (
          <p className="text-xs text-gray-500">
            Cette box est vide : aucune donnée ne partirait avec elle.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-400" data-testid={`archive-error-${boxId}`}>{error}</p>}

      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              <h2 className="text-lg font-black text-white">Archiver « {boxName} » ?</h2>
            </div>
            <p className="text-sm text-gray-300">
              Ses membres perdront l&apos;accès à la box : elle disparaîtra de leur application,
              de l&apos;annuaire public et des recherches. La programmation automatique ne la
              générera plus.
            </p>
            <p className="text-sm text-emerald-300">
              Rien n&apos;est supprimé, et l&apos;opération se défait : « Réactiver » remet tout en place.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmArchive(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => void setArchived(true)}
                disabled={busy}
                data-testid={`archiver-confirmer-${boxId}`}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-sm font-bold transition-colors"
              >
                {busy ? 'Archivage...' : 'Archiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 size={18} className="text-red-400" />
              <h2 className="text-lg font-black text-white">Supprimer « {boxName} » ?</h2>
            </div>
            <p className="text-sm text-gray-300">
              La box et tout ce qui s&apos;y rattache seront supprimés définitivement. Le compte du
              propriétaire n&apos;est pas touché : il perd seulement son rôle sur cette box.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Retape le nom exact de la box
              </label>
              <input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                autoFocus
                placeholder={boxName}
                data-testid={`supprimer-saisie-${boxId}`}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setConfirmDelete(false); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => void remove()}
                disabled={busy || typedName.trim() !== boxName}
                data-testid={`supprimer-confirmer-${boxId}`}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
              >
                {busy ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
