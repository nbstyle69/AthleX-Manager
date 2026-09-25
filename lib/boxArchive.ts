import { ERROR_TITLE, fullDate, type ConfirmRequest, type InfoRequest } from '@/lib/confirmDialog';

/**
 * Archiver / supprimer une box depuis sa fiche (super admin), sans DOM :
 * les deux appels et les deux boîtes `ConfirmDialog` de `BoxArchiveBlock`
 * (lot 7a). Les appels sont ceux d'avant, à l'identique ; ils renvoient le
 * message d'erreur à afficher, ou `null` en cas de succès. Archiver et supprimer passent par une boîte ; réactiver part directement, comme avant.
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

// ── Archivage programmé (PR 2 sur 3, paiement) ─────────────────────────────
// Archiver passe par `/api/admin/boxes/[id]/archive-schedule` : `check`,
// puis la boîte (avec ou sans abonnés), puis `schedule`. Sur une box en
// archivage programmé : l'état et « Annuler l'archivage programmé ».

/** Réponse de `check` (sous-ensemble utilisé par l'écran). */
export interface ArchiveCheckView {
  members: { active: number; past_due: number; committed: number; to_stop: number; already_stopping: number };
  counter_members: number;
  programs: { active: number };
  offers_sold: { active: number };
  offers_bought: { active: number };
  pending: { active: number };
  box_subscription: { source: 'stripe' | 'manual'; status: string | null; stopping: boolean; period_end: string | null; to_stop: boolean } | null;
  to_stop: number;
  past_due: number;
  last_end: string | null;
  still_paying: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n <= 1 ? one : many}`;
const whenText = (lastEnd: string | null) => (lastEnd ? `le ${fullDate(lastEnd)}` : 'à la fin du dernier abonnement');

/** « Archivage programmé, au plus tard le {date} » (fiche admin). */
export const scheduledStateLabel = (lastEnd: string | null) =>
  lastEnd ? `Archivage programmé, au plus tard le ${fullDate(lastEnd)}` : 'Archivage programmé, à la fin du dernier abonnement';

/** Avec des abonnements qui paient encore : texte du relevé, bouton ambre. */
export function archiveScheduleRequest(boxName: string, c: ArchiveCheckView, run: () => unknown): ConfirmRequest {
  const warning: string[] = [];
  if (c.members.active > 0) {
    warning.push(`${plural(c.members.active, 'membre paie', 'membres paient')} encore par Stripe${c.members.past_due ? `, dont ${c.members.past_due} en impayé` : ''}.`);
  }
  const others = [
    c.programs.active ? plural(c.programs.active, 'abonnement à un programme', 'abonnements à des programmes') : null,
    c.offers_sold.active ? plural(c.offers_sold.active, 'box abonnée à ses offres', 'boxs abonnées à ses offres') : null,
    c.offers_bought.active ? plural(c.offers_bought.active, 'offre achetée à une autre box', 'offres achetées à d’autres boxs') : null,
    c.pending.active ? plural(c.pending.active, 'achat en attente de compte', 'achats en attente de compte') : null,
  ].filter(Boolean);
  if (others.length) warning.push(`Paient aussi par Stripe : ${others.join(', ')}.`);
  if (c.members.committed) {
    warning.push(c.members.committed === 1
      ? '1 membre est encore engagé : l’arrêt lève son engagement.'
      : `${c.members.committed} membres sont encore engagés : l’arrêt lève leur engagement.`);
  }
  if (c.counter_members) {
    warning.push(`${plural(c.counter_members, 'membre paie', 'membres paient')} au comptoir : ${c.counter_members <= 1 ? 'il garde' : 'ils gardent'} l’accès jusqu’à l’archivage et ${c.counter_members <= 1 ? 'reçoit' : 'reçoivent'} un e-mail.`);
  }

  const bs = c.box_subscription;
  const athlex = bs?.source === 'stripe' && (bs.to_stop || bs.stopping)
    ? ' L’abonnement de la box à AthleX s’arrête lui aussi à la fin de sa période.'
    : '';
  return {
    title: `Archiver « ${boxName} » ?`,
    warning: warning.join(' ') || undefined,
    body: `Si tu confirmes : les abonnements des membres s’arrêtent à la fin de leur période payée, ceux en impayé tout de suite, sans remboursement, et chaque membre reçoit un e-mail.${athlex} Plus aucune adhésion, invitation ni achat n’est accepté. Tout le monde garde l’accès jusqu’à la fin de sa période payée, au plus tard ${whenText(c.last_end)} : la box sera alors archivée automatiquement.`,
    confirmLabel: 'Programmer l’archivage',
    tone: 'warning',
    run,
  };
}

/** Plus rien ne paie : le texte d'avant (archivage immédiat), plus l'abonnement AthleX s'il y en a un. */
export function archiveNowRequest(boxName: string, c: ArchiveCheckView, run: () => unknown): ConfirmRequest {
  const base = archiveRequest(boxName, run);
  const bs = c.box_subscription;
  const line = !bs ? ''
    : bs.source === 'manual' ? '\n\nL’abonnement de la box à AthleX (géré hors Stripe) n’est pas touché.'
    : bs.to_stop ? '\n\nL’abonnement de la box à AthleX, en impayé, s’arrête tout de suite.'
    : '';
  return { ...base, body: `${base.body}${line}` };
}

/** Annuler un archivage programmé : sa propre boîte. */
export function unscheduleRequest(boxName: string, run: () => unknown): ConfirmRequest {
  return {
    title: `Annuler l’archivage programmé de « ${boxName} » ?`,
    body: 'La box accepte de nouveau les adhésions, les invitations et les achats.\n\nLes abonnements déjà arrêtés ne sont pas relancés : ils prennent fin à la date prévue, et chacun devra se réabonner s’il le souhaite.',
    confirmLabel: 'Annuler l’archivage programmé',
    cancelLabel: 'Garder l’archivage programmé',
    run,
  };
}

export async function postArchiveSchedule(boxId: string, action: 'check' | 'schedule' | 'unschedule'): Promise<{ ok: boolean; data: Record<string, any> }> {
  try {
    const res = await fetch(`/api/admin/boxes/${boxId}/archive-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (e: any) {
    return { ok: false, data: { error: e?.message ?? 'Réseau indisponible.' } };
  }
}

/** Le déroulé « Archiver » : `check`, la boîte qui convient, puis `schedule`. */
export async function askArchiveBox(o: {
  ask: (req: ConfirmRequest) => Promise<boolean>;
  inform: (req: InfoRequest) => Promise<void>;
  boxId: string;
  boxName: string;
  onDone: () => unknown;
}): Promise<boolean> {
  const check = await postArchiveSchedule(o.boxId, 'check');
  if (!check.ok) {
    await o.inform({ kind: 'error', title: ERROR_TITLE, body: check.data.error ?? 'Impossible de lire les abonnements de la box.' });
    return false;
  }
  const c = check.data as ArchiveCheckView;
  const run = async () => {
    const r = await postArchiveSchedule(o.boxId, 'schedule');
    // Échec partiel : le message nomme les abonnements refusés ; rien n'est
    // programmé, la fiche n'a donc rien à recharger. (Recharger démonte le
    // bloc, et sa boîte d'erreur avec : le banc l'a montré.)
    if (!r.ok) { void o.inform({ kind: 'error', title: ERROR_TITLE, body: r.data.error ?? 'L’archivage n’a pas été programmé.' }); return; }
    // L'avertissement d'abord, le rechargement à sa fermeture, pour la même
    // raison. (Pendant l'action, la boîte met l'information en attente : ne
    // pas l'attendre ici, sous peine de blocage.)
    if (r.data.warning) {
      void o.inform({ kind: 'info', title: 'E-mail non envoyé', body: r.data.warning }).then(() => o.onDone());
      return;
    }
    await o.onDone();
  };
  return o.ask(c.still_paying ? archiveScheduleRequest(o.boxName, c, run) : archiveNowRequest(o.boxName, c, run));
}
