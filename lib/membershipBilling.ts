/**
 * Premier prélèvement d'un abonnement de salle (lot 3 « Rejoindre en payant »).
 *
 * Fonction pure, partagée par l'aperçu, la création du Checkout et le webhook :
 * ce que le membre voit avant de valider est calculé exactement comme ce qui
 * part chez Stripe.
 *
 * - Sans échéance (cas « now ») : prorata aujourd'hui jusqu'au prochain jour
 *   choisi, puis plein tarif ce jour-là chaque mois ; plein tarif tout de suite
 *   si le jour choisi est aujourd'hui.
 * - Avec une échéance future (cas « deferred ») : rien aujourd'hui, essai
 *   jusqu'à l'échéance, prorata de l'échéance au jour choisi, puis plein tarif.
 *   Échéance à moins de 7 jours du jour choisi : un seul prélèvement au jour
 *   choisi (prorata + plein tarif).
 *
 * Tous les jours se comptent en heure de Paris ; chaque date Stripe est posée
 * à 06:00 Paris, pour qu'un changement d'heure ne fasse jamais changer de jour.
 */

export const BILLING_DAY_MIN = 1;
export const BILLING_DAY_MAX = 10;
export const BILLING_HOUR_PARIS = 6;
/** En dessous, pas de petit prélèvement séparé : il est fusionné au premier plein tarif. */
export const MERGE_BELOW_DAYS = 7;
export const DUE_DATE_MAX_MONTHS = 12;

const TZ = 'Europe/Paris';
const DAY_MS = 86_400_000;

export interface Ymd { y: number; m: number; d: number }

export type DueDateRefusal = 'DUE_DATE_INVALID' | 'DUE_DATE_TOO_FAR';

export interface BillingPlanNow {
  kind: 'now';
  /** Montant encaissé au checkout (centimes). */
  todayCents: number;
  /** Ancre Stripe (secondes) ; null quand le jour choisi est aujourd'hui. */
  anchor: number | null;
  /** Prochain prélèvement après celui d'aujourd'hui, au plein tarif. */
  nextChargeDate: string;
  recurringCents: number;
  /** Fin de validité de la session Checkout (secondes). */
  expiresAt: number;
  /** Une échéance était posée mais passée ou du jour : ignorée. */
  dueDateIgnored: boolean;
}

export interface BillingPlanDeferred {
  kind: 'deferred';
  todayCents: 0;
  /** Fin d'essai Stripe (secondes) : date du premier prélèvement. */
  trialEnd: number;
  /** Ancre Stripe (secondes) ; null quand le premier prélèvement tombe un jour choisi. */
  anchor: number | null;
  firstChargeDate: string;
  firstChargeCents: number;
  /** Prorata ajouté au premier plein tarif (fusion à moins de 7 jours) ; 0 sinon. */
  mergedProrataCents: number;
  recurringCents: number;
  /** Échéance AAAA-MM-JJ : début de l'engagement. */
  dueDate: string;
  expiresAt: number;
}

export type BillingPlan = BillingPlanNow | BillingPlanDeferred;

export function isBillingDay(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= BILLING_DAY_MIN && v <= BILLING_DAY_MAX;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymdString = (x: Ymd) => `${x.y}-${pad(x.m)}-${pad(x.d)}`;
const ordinal = (x: Ymd) => Date.UTC(x.y, x.m - 1, x.d) / DAY_MS;

/** Jour calendaire à Paris d'un instant. */
export function parisYmd(at: Date): Ymd {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Décalage de Paris sur UTC (ms) à un instant donné. */
function parisOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Instant (secondes) d'un jour à une heure donnée, heure de Paris. */
export function parisInstant(x: Ymd, hour: number = BILLING_HOUR_PARIS): number {
  const guess = Date.UTC(x.y, x.m - 1, x.d, hour);
  return Math.floor((guess - parisOffsetMs(guess)) / 1000);
}

/** Même jour N mois plus tard, ramené au dernier jour d'un mois court (comme Postgres). */
export function addMonths(x: Ymd, n: number): Ymd {
  const idx = x.y * 12 + (x.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, d: Math.min(x.d, last) };
}

/** Premier jour `day` strictement après `from`. `day` ≤ 10 : existe dans tous les mois. */
function nextBillingDate(from: Ymd, day: number): Ymd {
  return from.d < day ? { y: from.y, m: from.m, d: day } : { ...addMonths({ ...from, d: 1 }, 1), d: day };
}

/**
 * Prorata Stripe de la période initiale : part de la période complète (un mois
 * qui se termine à l'ancre, en UTC comme Stripe) couverte par [start, anchor[.
 */
export function prorataCents(priceCents: number, start: number, anchor: number): number {
  const a = new Date(anchor * 1000);
  const periodStart = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - 1, a.getUTCDate(),
    a.getUTCHours(), a.getUTCMinutes(), a.getUTCSeconds()) / 1000;
  return Math.round((priceCents * (anchor - start)) / (anchor - periodStart));
}

/** Échéance AAAA-MM-JJ lisible et réelle, sinon null. */
export function parseDueDate(raw: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const x = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const back = new Date(Date.UTC(x.y, x.m - 1, x.d));
  return back.getUTCMonth() === x.m - 1 && back.getUTCDate() === x.d ? x : null;
}

/** Stripe impose au moins 30 min et au plus 24 h de validité à une session Checkout. */
function sessionExpiry(nowS: number, notAfter: number): number {
  return Math.max(nowS + 30 * 60, Math.min(nowS + 24 * 3600, notAfter));
}

export function planFirstBilling(input: {
  now: Date;
  billingDay: number;
  priceCents: number;
  dueDate?: string | null;
}): BillingPlan | { refusal: DueDateRefusal } {
  const { now, billingDay: day, priceCents } = input;
  const nowS = Math.floor(now.getTime() / 1000);
  const today = parisYmd(now);

  let due: Ymd | null = null;
  let dueDateIgnored = false;
  if (input.dueDate != null && input.dueDate !== '') {
    due = parseDueDate(input.dueDate);
    if (!due) return { refusal: 'DUE_DATE_INVALID' };
    if (ordinal(due) > ordinal(addMonths(today, DUE_DATE_MAX_MONTHS))) return { refusal: 'DUE_DATE_TOO_FAR' };
    if (ordinal(due) <= ordinal(today)) { due = null; dueDateIgnored = true; }
  }

  if (!due) {
    if (today.d === day) {
      // ponytail: une session ouverte après 23:30 peut se payer après minuit ;
      // l'ancre prendrait alors le lendemain. Plancher Stripe de 30 min.
      const midnight = parisInstant(ymdFromOrdinal(ordinal(today) + 1), 0);
      return {
        kind: 'now', todayCents: priceCents, anchor: null,
        nextChargeDate: ymdString(addMonths(today, 1)), recurringCents: priceCents,
        expiresAt: sessionExpiry(nowS, midnight), dueDateIgnored,
      };
    }
    const next = nextBillingDate(today, day);
    const anchor = parisInstant(next);
    return {
      kind: 'now', todayCents: prorataCents(priceCents, nowS, anchor), anchor,
      nextChargeDate: ymdString(next), recurringCents: priceCents,
      // Payer après l'ancre ferait facturer par Checkout une période pleine.
      expiresAt: sessionExpiry(nowS, anchor), dueDateIgnored,
    };
  }

  const dueS = parisInstant(due);
  // Le webhook crée l'abonnement après le paiement : l'essai doit encore être futur.
  const expiresAt = sessionExpiry(nowS, dueS - 3600);
  const base = { kind: 'deferred' as const, todayCents: 0 as const, recurringCents: priceCents, dueDate: ymdString(due), expiresAt };

  if (due.d === day) {
    return { ...base, trialEnd: dueS, anchor: null, firstChargeDate: ymdString(due), firstChargeCents: priceCents, mergedProrataCents: 0 };
  }
  const next = nextBillingDate(due, day);
  const nextS = parisInstant(next);
  const prorata = prorataCents(priceCents, dueS, nextS);
  if (ordinal(next) - ordinal(due) < MERGE_BELOW_DAYS) {
    return {
      ...base, trialEnd: nextS, anchor: null, firstChargeDate: ymdString(next),
      firstChargeCents: prorata + priceCents, mergedProrataCents: prorata,
    };
  }
  return { ...base, trialEnd: dueS, anchor: nextS, firstChargeDate: ymdString(due), firstChargeCents: prorata, mergedProrataCents: 0 };
}

function ymdFromOrdinal(n: number): Ymd {
  const d = new Date(n * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/** Engagement : N mois après l'échéance (cas « deferred »), sinon après aujourd'hui. */
export function commitmentEndIso(plan: BillingPlan, months: number, now: Date): string | null {
  if (months <= 0) return null;
  if (plan.kind === 'deferred') {
    return new Date(parisInstant(addMonths(parseDueDate(plan.dueDate)!, months), 0) * 1000).toISOString();
  }
  const d = new Date(now); d.setMonth(d.getMonth() + months); return d.toISOString();
}
