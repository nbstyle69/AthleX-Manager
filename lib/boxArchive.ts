import type { ConfirmRequest } from '@/lib/confirmDialog';

/**
 * Archiver / supprimer une box depuis sa fiche (super admin), sans DOM :
 * les deux appels et les deux boîtes `ConfirmDialog` de `BoxArchiveBlock`
 * (lot 7a). Les appels sont ceux d'avant, à l'identique ; ils renvoient le
 * message d'erreur à afficher, ou `null` en cas de succès. Aucun appel ne part sans confirmation.
 */

export async function patchArchive(boxId: string, archived: boolean): Promise<string | null> {
  const res = await fetch(`/api/admin/boxes/${boxId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived }),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? null : (json.error ?? `Erreur ${res.status}`);
}

export async function deleteBox(boxId: string, typedName: string): Promise<string | null> {
  const res = await fetch(`/api/admin/boxes/${boxId}/deletion`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: typedName.trim() }),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? null : (json.error ?? `Erreur ${res.status}`);
}

/** Textes d'avant, repris tels quels. */
export function archiveRequest(boxName: string, run: () => unknown): ConfirmRequest {
  return {
    title: `Archiver « ${boxName} » ?`,
    body: 'Ses membres perdront l’accès à la box : elle disparaîtra de leur application, de l’annuaire public et des recherches. La programmation automatique ne la générera plus.\n\nRien n’est supprimé, et l’opération se défait : « Réactiver » remet tout en place.',
    confirmLabel: 'Archiver',
    tone: 'warning',
    run,
  };
}

export function deleteRequest(boxName: string, run: (typedName: string) => unknown): ConfirmRequest {
  return {
    title: `Supprimer « ${boxName} » ?`,
    body: 'La box et tout ce qui s’y rattache seront supprimés définitivement. Le compte du propriétaire n’est pas touché : il perd seulement son rôle sur cette box.',
    // Même garde qu'avant : le bouton ne s'active qu'avec le nom exact.
    field: { label: 'Retape le nom exact de la box', placeholder: boxName, mustEqual: boxName },
    confirmLabel: 'Supprimer',
    danger: true,
    run: typedName => run(typedName),
  };
}
