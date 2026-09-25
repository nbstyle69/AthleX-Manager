import { ERROR_TITLE, type ConfirmRequest, type InfoRequest } from '@/lib/confirmDialog';

/**
 * Suppression d'une formule, d'un programme ou d'une offre qui peut avoir des
 * abonnés Stripe (S4, B5/B10/B11). Sans DOM, testable sous Jest.
 *
 * 1. La route compte les abonnements actifs ou en impayé (`check`).
 * 2. Aucun : la boîte habituelle, suppression par la route (`delete`).
 * 3. Sinon : deux choix exclusifs — « Désactiver » (sans appel Stripe) ou
 *    « Arrêter les n abonnements à la fin de leur période, puis supprimer »
 *    (`stop_then_delete`). En cas d'échec partiel, la route ne supprime rien et
 *    son message nomme les abonnements refusés : il est affiché tel quel.
 */

export type DeleteKind = 'plan' | 'program' | 'offer';

const NOUN: Record<DeleteKind, { the: string; fem: boolean; newcomers: string; subscribers: string }> = {
  plan: { the: 'la formule', fem: true, newcomers: 'aux nouveaux membres', subscribers: 'membre(s) paient' },
  program: { the: 'le programme', fem: false, newcomers: 'aux nouveaux acheteurs', subscribers: 'acheteur(s) paient' },
  offer: { the: 'l’offre', fem: true, newcomers: 'aux autres boxs', subscribers: 'box(s) abonnée(s) paient' },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Choix proposés quand des abonnements Stripe sont encore actifs. */
export function subscriptionsChoices(kind: DeleteKind, n: number): Pick<ConfirmRequest, 'warning' | 'choices' | 'defaultChoice' | 'confirmLabel'> {
  const w = NOUN[kind];
  const access = kind === 'plan'
    ? 'Chaque membre garde l’accès jusqu’à la fin de sa période payée'
    : kind === 'program'
      ? 'L’accès au programme s’arrête dès la suppression'
      : 'Les boxs abonnées ne reçoivent plus de semaines dès la suppression';
  return {
    warning: `${n} ${w.subscribers} encore ${w.the} par Stripe : tu ne peux pas ${w.fem ? 'la' : 'le'} supprimer tel${w.fem ? 'le' : ''} quel${w.fem ? 'le' : ''}.`,
    choices: [
      {
        value: 'deactivate',
        label: `Désactiver ${w.the}`,
        description: `${w.fem ? 'Elle' : 'Il'} n’est plus proposé${w.fem ? 'e' : ''} ${w.newcomers}. Les abonnés actuels continuent normalement, avec leurs prélèvements.`,
        confirmLabel: `Désactiver ${w.the}`,
        danger: false,
      },
      {
        value: 'stop_then_delete',
        label: `Arrêter les ${n} abonnements à la fin de leur période, puis supprimer`,
        description: `${access} ; aucun nouveau prélèvement, et chacun reçoit un e-mail. ${cap(w.the)} n’est supprimé${w.fem ? 'e' : ''} qu’une fois tous les arrêts confirmés par Stripe.`,
        confirmLabel: 'Arrêter et supprimer',
        danger: true,
      },
    ],
    defaultChoice: 'deactivate',
    confirmLabel: `Désactiver ${w.the}`,
  };
}

type Json = Record<string, any>;

async function post(url: string, body: Json): Promise<{ ok: boolean; data: Json }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (e: any) {
    return { ok: false, data: { error: e?.message ?? 'Réseau indisponible.' } };
  }
}

export async function askDeleteWithSubscriptions(o: {
  ask: (req: ConfirmRequest) => Promise<boolean>;
  inform: (req: InfoRequest) => Promise<void>;
  kind: DeleteKind;
  /** Route de suppression et identifiant envoyé (`{ plan_id }`…). */
  url: string;
  payload: Json;
  /** Boîte habituelle (sans abonné). */
  title: string;
  element?: string;
  body: string;
  confirmLabel: string;
  /** « Désactiver » : bascule existante, sans appel Stripe. */
  deactivate: () => Promise<unknown>;
  onDeleted: () => unknown;
}): Promise<boolean> {
  const check = await post(o.url, { ...o.payload, action: 'check' });
  if (!check.ok) {
    await o.inform({ kind: 'error', title: ERROR_TITLE, body: check.data.error ?? 'Impossible de vérifier les abonnements.' });
    return false;
  }

  const run = async (action: 'delete' | 'stop_then_delete') => {
    const r = await post(o.url, { ...o.payload, action });
    if (!r.ok) { o.inform({ kind: 'error', title: ERROR_TITLE, body: r.data.error ?? 'Suppression impossible.' }); return; }
    await o.onDeleted();
    if (r.data.warning) o.inform({ kind: 'info', title: 'Suppression faite', body: r.data.warning });
  };

  const n = Number(check.data.active_subscriptions) || 0;
  if (n === 0) {
    return o.ask({
      title: o.title, element: o.element, body: o.body, confirmLabel: o.confirmLabel, danger: true,
      run: () => run('delete'),
    });
  }
  return o.ask({
    title: o.title,
    element: o.element,
    ...subscriptionsChoices(o.kind, n),
    run: (_v, choice) => (choice === 'stop_then_delete' ? run('stop_then_delete') : o.deactivate()),
  });
}
