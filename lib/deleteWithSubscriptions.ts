import { ERROR_TITLE, fullDate, type ConfirmRequest, type InfoRequest } from '@/lib/confirmDialog';
import { countOf } from '@/lib/plural';

/**
 * Suppression d'une formule, d'un programme ou d'une offre qui peut avoir des
 * abonnés Stripe (S4, B5/B10/B11). Sans DOM, testable sous Jest.
 *
 * 1. La route compte les abonnements actifs ou en impayé (`check`).
 * 2. Aucun : la boîte habituelle, suppression par la route (`delete`).
 * 3. Sinon : deux choix exclusifs — « Désactiver » (sans appel Stripe) ou
 *    l'arrêt des abonnements :
 *    - formule : fin de période puis suppression (`stop_then_delete`) ;
 *    - programme, offre : fin de période puis DÉSACTIVATION
 *      (`stop_then_deactivate`) — les abonnés gardent la période payée, la
 *      suppression redevient possible quand le dernier abonnement est terminé.
 *    Un impayé est arrêté tout de suite (règle S2). En cas d'échec partiel, la
 *    route ne supprime ni ne désactive rien ; son message est affiché tel quel.
 */

export type DeleteKind = 'plan' | 'program' | 'offer';

// `countOf` vit dans lib/plural.ts (accords partagés) ; réexporté pour les appels existants.
export { countOf };

const NOUN: Record<DeleteKind, {
  the: string; The: string; fem: boolean; newcomers: string;
  payer: [string, string];
}> = {
  plan: { the: 'la formule', The: 'La formule', fem: true, newcomers: 'aux nouveaux membres', payer: ['membre paie', 'membres paient'] },
  program: { the: 'le programme', The: 'Le programme', fem: false, newcomers: 'aux nouveaux acheteurs', payer: ['acheteur paie', 'acheteurs paient'] },
  offer: { the: 'l’offre', The: 'L’offre', fem: true, newcomers: 'aux autres boxs', payer: ['box abonnée paie', 'boxs abonnées paient'] },
};

export interface SubscriptionCounts {
  /** Abonnements Stripe actifs ou en impayé. */
  active: number;
  /** Parmi eux, ceux qu'il reste à arrêter (programme, offre). */
  toStop?: number;
  pastDue?: number;
  /** Formule : membres encore engagés. */
  engaged?: number;
}

/** Choix proposés quand des abonnements Stripe sont encore actifs. */
export function subscriptionsChoices(kind: DeleteKind, c: SubscriptionCounts):
  Pick<ConfirmRequest, 'warning' | 'choices' | 'defaultChoice' | 'confirmLabel'> {
  const w = NOUN[kind];
  const e = w.fem ? 'e' : '';
  const n = c.toStop ?? c.active;
  const stopWhat = n === 1 ? 'Arrêter l’abonnement à la fin de sa période' : `Arrêter les ${n} abonnements à la fin de leur période`;
  const extra: string[] = [];
  if (c.pastDue) {
    extra.push(c.pastDue === 1
      ? '1 abonnement en impayé sera arrêté tout de suite.'
      : `${c.pastDue} abonnements en impayé seront arrêtés tout de suite.`);
  }
  if (kind === 'plan' && c.engaged) {
    extra.push(c.engaged === 1
      ? '1 membre est encore engagé : l’arrêt lève son engagement.'
      : `${c.engaged} membres sont encore engagés : l’arrêt lève leur engagement.`);
  }
  const stopDescription = kind === 'plan'
    ? 'Chaque membre garde l’accès jusqu’à la fin de sa période payée ; aucun nouveau prélèvement, et chacun reçoit un e-mail. La formule n’est supprimée qu’une fois tous les arrêts confirmés par Stripe.'
    : kind === 'program'
      ? 'Chaque acheteur garde l’accès jusqu’à la fin de sa période payée ; aucun nouveau prélèvement, et chacun reçoit un e-mail. Le programme est désactivé tout de suite et pourra être supprimé quand le dernier abonnement sera terminé.'
      : 'Chaque box abonnée reçoit ses semaines jusqu’à la fin de sa période payée ; aucun nouveau prélèvement, et chacune reçoit un e-mail. L’offre est désactivée tout de suite et pourra être supprimée quand le dernier abonnement sera terminé.';
  return {
    warning: `${countOf(c.active, ...w.payer)} encore ${w.the} par Stripe : tu ne peux pas ${w.fem ? 'la' : 'le'} supprimer tel${w.fem ? 'le' : ''} quel${w.fem ? 'le' : ''}.`,
    choices: [
      {
        value: 'deactivate',
        label: `Désactiver ${w.the}`,
        description: `${w.fem ? 'Elle' : 'Il'} n’est plus proposé${e} ${w.newcomers}. Les abonnés actuels continuent normalement, avec leurs prélèvements.`,
        confirmLabel: `Désactiver ${w.the}`,
        danger: false,
      },
      kind === 'plan'
        ? {
            value: 'stop_then_delete',
            label: `${stopWhat}, puis supprimer`,
            description: [stopDescription, ...extra].join('\n'),
            confirmLabel: 'Arrêter et supprimer',
            danger: true,
          }
        : {
            value: 'stop_then_deactivate',
            label: `${stopWhat} et désactiver ${w.the}`,
            description: [stopDescription, ...extra].join('\n'),
            confirmLabel: 'Arrêter et désactiver',
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
  /** Après une suppression ou une désactivation par la route : rechargement. */
  onDone: () => unknown;
}): Promise<boolean> {
  const check = await post(o.url, { ...o.payload, action: 'check' });
  if (!check.ok) {
    await o.inform({ kind: 'error', title: ERROR_TITLE, body: check.data.error ?? 'Impossible de vérifier les abonnements.' });
    return false;
  }

  const run = async (action: 'delete' | 'stop_then_delete' | 'stop_then_deactivate') => {
    const r = await post(o.url, { ...o.payload, action });
    if (!r.ok) { o.inform({ kind: 'error', title: ERROR_TITLE, body: r.data.error ?? 'L’action n’a pas été faite.' }); return; }
    await o.onDone();
    if (r.data.warning) o.inform({ kind: 'info', title: 'E-mail non envoyé', body: r.data.warning });
  };

  const d = check.data;
  const counts: SubscriptionCounts = {
    active: Number(d.active_subscriptions) || 0,
    toStop: d.to_stop == null ? undefined : Number(d.to_stop),
    pastDue: Number(d.past_due) || 0,
    engaged: Number(d.engaged) || 0,
  };
  if (counts.active === 0) {
    return o.ask({
      title: o.title, element: o.element, body: o.body, confirmLabel: o.confirmLabel, danger: true,
      run: () => run('delete'),
    });
  }

  // Programme, offre : tout est déjà en voie d'arrêt → rien à choisir.
  if (o.kind !== 'plan' && counts.toStop === 0) {
    const w = NOUN[o.kind];
    const n = counts.active;
    await o.inform({
      kind: 'info',
      title: 'Suppression pas encore possible',
      body: `${n === 1 ? 'L’abonnement Stripe restant est déjà programmé' : `Les ${n} abonnements Stripe restants sont déjà programmés`} pour s’arrêter à la fin de ${n === 1 ? 'sa' : 'leur'} période payée${d.last_end ? `, au plus tard le ${fullDate(d.last_end)}` : ''}. ${w.The} pourra être supprimé${w.fem ? 'e' : ''} ensuite.`,
    });
    return false;
  }

  return o.ask({
    title: o.title,
    element: o.element,
    ...subscriptionsChoices(o.kind, counts),
    run: (_v, choice) => (
      choice === 'stop_then_delete' || choice === 'stop_then_deactivate' ? run(choice) : o.deactivate()
    ),
  });
}
