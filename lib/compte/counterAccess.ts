/**
 * Comptoir P1 — état de l'accès payé à la box sur /compte (maquettes 66:1553,
 * 66:1620, 66:1693, 66:1760). Fonction pure : les jours se comptent au jour de
 * Paris, comme la coupure en base (internal.expirer_acces_comptoir).
 */
import { parisDate } from '@/lib/datetime';
import { countOf } from '@/lib/plural';
import { parisYmd, parseDueDate, ymdString } from '@/lib/membershipBilling';

/** Encart ambre à partir de 7 jours avant la fin (spec P1 §5). */
export const ENDING_SOON_DAYS = 7;

export type CounterAccessKind = 'running' | 'ending' | 'ended';

export interface CounterAccessView {
  kind: CounterAccessKind;
  /** Dernier jour d'accès (AAAA-MM-JJ, inclus). */
  until: string;
  /** Jours restants jusqu'au dernier jour (0 = dernier jour aujourd'hui) ; négatif une fois passé. */
  daysLeft: number;
  /** Ligne CalendarClock. */
  line: string;
  /** Encart ambre (fin proche), sinon null. */
  notice: string | null;
  /** Bouton blanc vers la fenêtre d'abonnement, sinon null. */
  cta: string | null;
  /** Indication sous les boutons (remplace la note comptoir), sinon null. */
  hint: string | null;
  /** « Demander un changement de formule » reste proposé. */
  allowRequest: boolean;
}

const DAY_MS = 86_400_000;
const dayIndex = (ymd: string) => {
  const x = parseDueDate(ymd)!;
  return Date.UTC(x.y, x.m - 1, x.d) / DAY_MS;
};

/** Jours entre aujourd'hui (Paris) et `until` : 0 le dernier jour, négatif ensuite. */
export function daysUntilParis(until: string, now: Date = new Date()): number {
  return dayIndex(until) - dayIndex(ymdString(parisYmd(now)));
}

const shortDate = (ymd: string) => parisDate(ymd, { day: '2-digit', month: 'short', year: 'numeric' });

function inDays(n: number): string {
  return n === 0 ? 'aujourd’hui' : `dans ${countOf(n, 'jour', 'jours')}`;
}

export const COUNTER_RUNNING_HINT =
  'Rien à payer aujourd’hui : ton premier prélèvement aura lieu après la fin de ton accès.';
/** Phrase ajoutée à l'indication d'un accès en cours (maquette 66:1553), au lieu de la note comptoir. */
export const COUNTER_RUNNING_REQUEST_NOTE = 'Un changement de formule au comptoir reste validé et encaissé par ta box.';
export const COUNTER_ENDED_HINT = 'Carte bancaire ou prélèvement SEPA, sur la page de paiement sécurisée de ta box.';
export const COUNTER_OFFLINE_HINT = 'Ta box ne propose pas le paiement en ligne : rapproche-toi d’elle pour renouveler.';

/**
 * Null quand rien ne change sur /compte : abonnement Stripe, ou formule sans
 * date de fin (gratuite ou attribuée).
 */
export function counterAccessView(
  m: {
    has_stripe_subscription: boolean | null;
    cash_access_until: string | null;
    subscription_status: string | null;
    box_sells_online: boolean | null;
  },
  /** Formule payante et active : seule condition pour proposer le paiement en ligne. */
  planPayable: boolean,
  now: Date = new Date(),
): CounterAccessView | null {
  if (m.has_stripe_subscription || !m.cash_access_until || !parseDueDate(m.cash_access_until)) return null;
  const until = m.cash_access_until;
  const daysLeft = daysUntilParis(until, now);
  // Entre minuit et la coupure horaire (:41), l'accès est déjà fini côté paiement.
  const kind: CounterAccessKind = m.subscription_status === 'expired' || daysLeft < 0 ? 'ended'
    : daysLeft <= ENDING_SOON_DAYS ? 'ending'
    : 'running';
  const online = !!m.box_sells_online && planPayable;
  const date = shortDate(until);

  if (kind === 'ended') {
    return {
      kind, until, daysLeft,
      line: `Accès terminé le ${date} — tu ne peux plus réserver`,
      notice: null,
      cta: online ? 'Activer mon abonnement en ligne' : null,
      hint: online ? COUNTER_ENDED_HINT : COUNTER_OFFLINE_HINT,
      allowRequest: false,
    };
  }
  const notice = kind === 'ending'
    ? `Ton accès se termine le ${date} (${inDays(daysLeft)}).${online ? ' Passe au paiement en ligne pour continuer à réserver, sans payer deux fois.' : ''}`
    : null;
  return {
    kind, until, daysLeft,
    line: `Accès payé à la box jusqu’au ${date}`,
    notice,
    cta: online ? 'Passer au paiement en ligne' : null,
    // Box sans paiement en ligne : la phrase « rapproche-toi d'elle » n'est dessinée qu'à la fin proche.
    hint: !online ? (kind === 'ending' ? COUNTER_OFFLINE_HINT : null)
      : kind === 'running' ? `${COUNTER_RUNNING_HINT} ${COUNTER_RUNNING_REQUEST_NOTE}`
      : COUNTER_RUNNING_HINT,
    allowRequest: true,
  };
}
