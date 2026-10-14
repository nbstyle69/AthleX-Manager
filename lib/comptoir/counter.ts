/**
 * Paiements au comptoir (P1), PR 5 — calculs et libellés purs d'Abonnés, de la
 * fenêtre « Encaissement reçu », d'Invitations et de Réglages. Les jours se
 * comptent au jour de Paris, comme la base.
 */
import { parisDate } from '@/lib/datetime';
import { countOf } from '@/lib/plural';
import { addMonths, parisYmd, parseDueDate, ymdString, type Ymd } from '@/lib/membershipBilling';

export const COUNTER_DURATIONS = [1, 3, 12] as const;
export type CounterMonths = (typeof COUNTER_DURATIONS)[number];

/** Bloc « Fin d'accès proche » : fin dans 14 jours au plus, ou passée depuis moins de 30 jours. */
export const ENDING_WITHIN_DAYS = 14;
export const ENDED_SINCE_DAYS = 30;
/** Sous-ligne ambre du tableau à 7 jours ou moins. */
export const AMBER_WITHIN_DAYS = 7;

const DAY_MS = 86_400_000;
const index = (x: Ymd) => Date.UTC(x.y, x.m - 1, x.d) / DAY_MS;
const fromIndex = (n: number): Ymd => {
  const d = new Date(n * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};

/** Jours entre aujourd'hui (Paris) et `ymd` : 0 aujourd'hui, 1 demain, négatif une fois passé. */
export function daysFromToday(ymd: string, now: Date = new Date()): number {
  return index(parseDueDate(ymd)!) - index(parisYmd(now));
}

/**
 * Règle de `internal.box_vend_en_ligne` (base, fermée à la clé serveur),
 * recopiée ici : compte Stripe branché, onboarding terminé, et au moins une
 * formule active avec un prix Stripe. À garder identique à la base.
 */
export function boxSellsOnline(
  box: { stripe_account_id: string | null; stripe_onboarding_complete: boolean | null } | null,
  plans: { is_active: boolean | null; stripe_price_id: string | null }[],
): boolean {
  return !!box?.stripe_account_id && box.stripe_onboarding_complete === true
    && plans.some((p) => p.is_active === true && !!p.stripe_price_id);
}

/**
 * Miroir de `internal.periode_comptoir` : début = lendemain de la fin actuelle
 * si elle tombe aujourd'hui ou après (prolongation), sinon aujourd'hui ; fin =
 * début + N mois − 1 jour (mois court : dernier jour, comme Postgres). Affichage
 * seulement : la base calcule et renvoie la vraie période.
 */
export function counterPeriod(currentUntil: string | null, months: number, now: Date = new Date()): { from: string; until: string } {
  const today = parisYmd(now);
  const fin = currentUntil ? parseDueDate(currentUntil) : null;
  const from = fin && index(fin) >= index(today) ? fromIndex(index(fin) + 1) : today;
  const until = fromIndex(index(addMonths(from, months)) - 1);
  return { from: ymdString(from), until: ymdString(until) };
}

/** Montant encaissé : prix de la formule × durée (la base relit le prix). */
export const cashAmountCents = (priceCents: number, months: number) => priceCents * months;

/** Formule absente ou à 0 € : ni durée ni date de fin (spec P1). */
export const isPayablePlan = (priceCents: number | null | undefined) => (priceCents ?? 0) > 0;

export const shortDate = (ymd: string) => parisDate(ymd, { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonth = (ymd: string) => parisDate(ymd, { day: 'numeric', month: 'short' });

/** « du 21 oct. au 20 nov. 2026 » (l'année n'est répétée que si elle change). */
export function periodLabel(from: string, until: string): string {
  return from.slice(0, 4) === until.slice(0, 4)
    ? `du ${dayMonth(from)} au ${shortDate(until)}`
    : `du ${shortDate(from)} au ${shortDate(until)}`;
}

/** « aujourd'hui », « demain », « dans 7 jours ». */
export function inDaysLabel(days: number): string {
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${countOf(days, 'jour', 'jours')}`;
}

export type NoticeKind = 'j7' | 'j1' | 'fin';
const NOTICE_LABEL: Record<NoticeKind, string> = { j7: 'J-7', j1: 'J-1', fin: 'fin d’accès' };

/** « Prévenu le 13 oct. 2026 (J-7) », ou null sans message parti. */
export function noticeLabel(notice: { kind: string; sent_at: string | null } | null): string | null {
  if (!notice?.sent_at || !(notice.kind in NOTICE_LABEL)) return null;
  return `Prévenu le ${shortDate(notice.sent_at)} (${NOTICE_LABEL[notice.kind as NoticeKind]})`;
}

/**
 * Refus COUNTER_RENEWAL_DISABLED de la base, prévu à l'avance : le membre a
 * déjà une période au comptoir, le renouvellement n'est pas autorisé et la box
 * vend en ligne. Le premier encaissement reste toujours possible.
 */
export const renewalBlocked = (m: { hasCounterPeriod: boolean }, box: { allowCounterRenewal: boolean; sellsOnline: boolean }) =>
  m.hasCounterPeriod && !box.allowCounterRenewal && box.sellsOnline;

/** Ce que sert GET /api/members/counter-access, par membre. */
export interface CounterAccessMember {
  box_member_id: string;
  member_id: string;
  status: string | null;
  joined_at: string | null;
  plan_id: string | null;
  price_cents: number | null;
  subscription_status: string | null;
  payment_method_type: string | null;
  has_stripe_subscription: boolean;
  cash_access_until: string | null;
  has_counter_period: boolean;
  last_notice: { kind: string; sent_at: string } | null;
  pending_invitation: { id: string; created_at: string } | null;
}

export interface CounterAccessBox { allow_counter_renewal: boolean; sells_online: boolean }

/** Accès comptoir terminé : statut `expired`, ou fin passée avant la coupure horaire. */
export const accessEnded = (m: Pick<CounterAccessMember, 'subscription_status' | 'cash_access_until'>, now: Date = new Date()) =>
  m.subscription_status === 'expired' || (!!m.cash_access_until && daysFromToday(m.cash_access_until, now) < 0);

/** Les deux blocs d'Abonnés : « Fin d'accès proche » (trié par date) et « À encaisser ». */
export function counterBlocks(members: CounterAccessMember[], now: Date = new Date()) {
  const ending = members
    .filter((m) => m.status === 'active' && !m.has_stripe_subscription && !!m.cash_access_until)
    .map((m) => ({ m, days: daysFromToday(m.cash_access_until!, now) }))
    .filter(({ days }) => days <= ENDING_WITHIN_DAYS && days > -ENDED_SINCE_DAYS)
    .sort((a, b) => a.days - b.days)
    .map(({ m }) => m);
  const toCollect = members
    .filter((m) => m.status === 'inactive' && m.subscription_status === 'pending_cash')
    .sort((a, b) => (a.joined_at ?? '').localeCompare(b.joined_at ?? ''));
  return { ending, toCollect };
}

/** Ligne d'un membre du bloc « Fin d'accès proche ». */
export function endingLine(m: Pick<CounterAccessMember, 'subscription_status' | 'cash_access_until'>, now: Date = new Date()): { text: string; ended: boolean } {
  const until = m.cash_access_until!;
  if (accessEnded(m, now)) return { text: `Accès terminé le ${shortDate(until)} · ne peut plus réserver`, ended: true };
  return { text: `Accès jusqu’au ${shortDate(until)} · ${inDaysLabel(daysFromToday(until, now))} · au comptoir`, ended: false };
}

/** Ligne d'un membre du bloc « À encaisser ». */
export const toCollectLine = (joinedAt: string | null) =>
  `Invitée avec paiement à la box${joinedAt ? ` · a rejoint la box le ${shortDate(joinedAt)}` : ''} · inactive tant que l’encaissement n’est pas reçu`;

/** Sous-ligne du tableau, colonne « Prochaine échéance » d'un membre au comptoir. */
export function tableDueNote(m: Pick<CounterAccessMember, 'subscription_status' | 'cash_access_until'>, now: Date = new Date()): { text: string; amber: boolean } {
  if (accessEnded(m, now)) return { text: 'accès terminé', amber: false };
  const days = daysFromToday(m.cash_access_until!, now);
  return { text: `fin d’accès · ${inDaysLabel(days)}`, amber: days <= AMBER_WITHIN_DAYS };
}

export const COUNTER_RENEWAL_DISABLED_MESSAGE = 'Renouvellement au comptoir désactivé : le membre passe au paiement en ligne (Réglages).';
export const FREE_PLAN_NOTE = 'Formule gratuite : aucune date de fin.';

/** Erreur de la base → phrase lisible ; jamais le texte technique. */
export function cashPaymentError(message: string | null | undefined): string {
  const m = message ?? '';
  if (m.includes('COUNTER_RENEWAL_DISABLED')) return COUNTER_RENEWAL_DISABLED_MESSAGE;
  if (m.includes('STRIPE_MEMBER')) return 'Ce membre paie en ligne par Stripe : aucun encaissement au comptoir à enregistrer.';
  if (m.includes('NO_PLAN_PRICE')) return 'Ce membre n’a pas de formule payante : attribue-lui une formule avant d’encaisser.';
  if (m.includes('FORBIDDEN')) return 'Seuls le gérant et les co-gérants de la box enregistrent un encaissement.';
  if (m.includes('INVALID_DURATION')) return 'Choisis une durée de 1, 3 ou 12 mois.';
  if (m.includes('NOT_CASH_MODE')) return 'Cette invitation est réglée par Stripe : rien à encaisser au comptoir.';
  return 'L’encaissement n’a pas pu être enregistré. Réessaie dans un instant.';
}
