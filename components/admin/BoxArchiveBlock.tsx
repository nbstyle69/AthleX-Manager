'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, CalendarClock, RotateCw, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  askArchiveBox, askRelaunchStops, deleteBox, deleteRequest, patchArchive, postArchiveSchedule, scheduledStateLabel, unscheduleRequest,
} from '@/lib/boxArchive';
import { ERROR_TITLE } from '@/lib/confirmDialog';

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
 * Les confirmations passent par `ConfirmDialog` (lot 7a) : l'appel ne part
 * que de son bouton d'action ; Annuler, la croix et Échap n'exécutent rien.
 *
 * Archivage PR 2 : « Archiver » lit d'abord ce qui paie encore (`check`),
 * puis arrête les abonnements et programme l'archivage (ou archive tout de
 * suite si plus rien ne paie). Une box en archivage programmé affiche son
 * état et « Annuler l'archivage programmé », avec sa propre boîte.
 */
export default function BoxArchiveBlock({
  boxId, boxName, archivedAt, archiveScheduledAt = null, onChanged,
}: {
  boxId: string;
  boxName: string;
  archivedAt: string | null;
  archiveScheduledAt?: string | null;
  onChanged: () => void;
}) {
  const archived = !!archivedAt;
  const scheduled = !archived && !!archiveScheduledAt;
  const { dialog, ask, inform } = useConfirmDialog();
  // Box programmée : la date au plus tard se lit dans les abonnements (lecture seule).
  const [lastEnd, setLastEnd] = useState<string | null | undefined>(undefined);
  // Arrêts restant à faire (un échec laisse la box programmée) : relançables d'ici.
  const [toStop, setToStop] = useState(0);
  useEffect(() => {
    if (!scheduled) return;
    void postArchiveSchedule(boxId, 'check').then(r => {
      setLastEnd(r.ok ? (r.data.last_end ?? null) : null);
      setToStop(r.ok ? Number(r.data.to_stop) || 0 : 0);
    });
  }, [boxId, scheduled]);
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

  // Les boîtes : lib/boxArchive.ts.
  function askArchive() {
    void askArchiveBox({ ask, inform, boxId, boxName, onDone: onChanged });
  }

  async function unschedule() {
    const r = await postArchiveSchedule(boxId, 'unschedule');
    if (!r.ok) { void inform({ kind: 'error', title: ERROR_TITLE, body: r.data.error ?? 'L’archivage programmé n’a pas été annulé.' }); return; }
    onChanged();
  }

  function askRelaunch() {
    void askRelaunchStops({ ask, inform, boxId, boxName, toStop, onDone: onChanged });
  }

  function askUnschedule() {
    ask(unscheduleRequest(boxName, unschedule));
  }

  function askDelete() {
    ask(deleteRequest(boxName, typedName => remove(typedName)));
  }

  const canDelete = deletion?.empty === true && !archived && !scheduled;

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
      ) : scheduled ? (
        <>
          <p className="rounded-ax-control border border-ax-warning bg-ax-warning-soft px-3 py-2 text-sm font-semibold text-ax-warning flex items-start gap-2" data-testid={`archivage-programme-${boxId}`}>
            <CalendarClock size={16} className="shrink-0 mt-0.5" />
            <span className="break-words min-w-0">{lastEnd === undefined ? 'Archivage programmé' : scheduledStateLabel(lastEnd)}</span>
          </p>
          <p className="text-xs text-ax-text-secondary">
            Les nouvelles adhésions, invitations et ventes sont fermées. Les membres gardent l&apos;accès
            jusqu&apos;à la fin de leur période payée ; la box sera alors archivée automatiquement.
          </p>
          {toStop > 0 && (
            <div className="space-y-2" data-testid={`arrets-restants-${boxId}`}>
              <p className="text-xs font-semibold text-ax-danger break-words">
                {toStop === 1 ? '1 abonnement n’est pas encore arrêté' : `${toStop} abonnements ne sont pas encore arrêtés`} chez Stripe :
                l&apos;e-mail d&apos;archivage partira quand tout sera arrêté.
              </p>
              <Button
                variant="ax-outline"
                onClick={askRelaunch}
                disabled={busy}
                data-testid={`relancer-arrets-${boxId}`}
                className="border-ax-warning text-ax-warning hover:bg-ax-warning-soft"
              >
                <RotateCw size={14} /> Relancer les arrêts
              </Button>
            </div>
          )}
          <Button
            variant="ax-outline"
            onClick={askUnschedule}
            disabled={busy}
            data-testid={`annuler-archivage-${boxId}`}
          >
            <Undo2 size={14} /> Annuler l&apos;archivage programmé
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
