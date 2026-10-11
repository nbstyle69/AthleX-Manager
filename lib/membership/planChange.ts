/**
 * Changement de formule par le membre (« Mon abonnement », PR serveur) :
 * règles pures, sans réseau. Une seule règle pour l'app et le site, la même
 * que la base (migration athlex-app 20270147, `internal.refus_changement_formule`) :
 *   - en ligne (abonnement Stripe vivant) : changement programmé à la fin de
 *     la période, sans prorata ; le webhook Connect écrit la formule à la bascule ;
 *   - au comptoir : demande au gérant (`request_plan_change`).
 * Refus en impayé, en pause, avec une résiliation programmée ou demandée, box
 * archivée ou en archivage, formule gratuite, inactive, d'une autre box ou
 * identique. L'engagement ne bloque pas et ne bouge jamais.
 */

import { parisDate } from '@/lib/datetime';

export type PlanChangeCode =
  | 'PLAN_CHANGE_NOT_MEMBER'
  | 'PLAN_CHANGE_BOX_CLOSED'
  | 'PLAN_CHANGE_NOT_COUNTER'
  | 'PLAN_CHANGE_PAST_DUE'
  | 'PLAN_CHANGE_PAUSED'
  | 'PLAN_CHANGE_CANCEL_SCHEDULED'
  | 'PLAN_CHANGE_INVALID_PLAN'
  | 'PLAN_CHANGE_SAME_PLAN'
  | 'PLAN_CHANGE_PENDING_EXISTS'
  | 'PLAN_CHANGE_FORBIDDEN'
  | 'PLAN_CHANGE_NOT_FOUND'
  /** Codes du Manager seulement (pas de la base). */
  | 'PLAN_CHANGE_FOREIGN_SCHEDULE'
  | 'PLAN_CHANGE_NOTHING_TO_CANCEL'
  | 'PLAN_CHANGE_PAYMENTS_DISABLED';

export const PLAN_CHANGE_MESSAGES: Record<PlanChangeCode, string> = {
  PLAN_CHANGE_NOT_MEMBER: "Tu n'es pas membre actif de cette box.",
  PLAN_CHANGE_BOX_CLOSED: 'Cette box ferme : ta formule ne peut plus changer.',
  PLAN_CHANGE_NOT_COUNTER: 'Ton abonnement est payé en ligne : change de formule depuis ton abonnement en ligne.',
  PLAN_CHANGE_PAST_DUE: "Règle d'abord ton impayé pour changer de formule.",
  PLAN_CHANGE_PAUSED: 'Ton abonnement est en pause : reprends-le pour changer de formule.',
  PLAN_CHANGE_CANCEL_SCHEDULED: "Ton abonnement s'arrête bientôt : tu ne peux plus changer de formule.",
  PLAN_CHANGE_INVALID_PLAN: "Cette formule n'est pas proposée par ta box.",
  PLAN_CHANGE_SAME_PLAN: "C'est déjà ta formule.",
  PLAN_CHANGE_PENDING_EXISTS: 'Une demande de changement est déjà en attente.',
  PLAN_CHANGE_FORBIDDEN: 'Seuls le gérant et les co-gérants de la box décident.',
  PLAN_CHANGE_NOT_FOUND: 'Demande introuvable.',
  PLAN_CHANGE_FOREIGN_SCHEDULE: "Ton abonnement a déjà une modification programmée par ta box : rapproche-toi d'elle.",
  PLAN_CHANGE_NOTHING_TO_CANCEL: "Aucun changement de formule n'est en attente.",
  PLAN_CHANGE_PAYMENTS_DISABLED: "Cette box n'a pas encore activé les paiements en ligne.",
};

const CODES = Object.keys(PLAN_CHANGE_MESSAGES) as PlanChangeCode[];

/** Le code `PLAN_CHANGE_…` d'une erreur de la base (« CODE: message »), ou null. */
export function codeFromDbError(message: string | null | undefined): PlanChangeCode | null {
  const m = /\b(PLAN_CHANGE_[A-Z_]+)\b/.exec(message ?? '');
  return m && (CODES as string[]).includes(m[1]) ? (m[1] as PlanChangeCode) : null;
}

export type BlockReason = 'past_due' | 'paused' | 'cancel_scheduled' | 'box_closed';

export const BLOCK_CODE: Record<BlockReason, PlanChangeCode> = {
  box_closed: 'PLAN_CHANGE_BOX_CLOSED',
  past_due: 'PLAN_CHANGE_PAST_DUE',
  paused: 'PLAN_CHANGE_PAUSED',
  cancel_scheduled: 'PLAN_CHANGE_CANCEL_SCHEDULED',
};

/** Statuts d'un abonnement Stripe « vivant » (la définition de la base). */
const STRIPE_VIVANT = ['active', 'trialing', 'past_due'];

export interface MemberBilling {
  id: string;
  box_id: string;
  member_id: string;
  status: string | null;
  joined_at: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
  subscription_paused: boolean | null;
  past_due_since: string | null;
  amount_cents: number | null;
  scheduled_plan_id: string | null;
  scheduled_change_at: string | null;
  stripe_schedule_id: string | null;
}

export const MEMBER_BILLING_COLUMNS =
  'id, box_id, member_id, status, joined_at, plan_id, subscription_status, stripe_subscription_id, '
  + 'subscription_current_period_end, subscription_cancel_at_period_end, subscription_paused, past_due_since, '
  + 'amount_cents, scheduled_plan_id, scheduled_change_at, stripe_schedule_id';

/** Phrase affichée après un changement accepté par la route (site). */
export function planChangeDoneMessage(r: { mode?: string; plan_name?: string | null; effective_at?: string | null }): string {
  const plan = `« ${r.plan_name ?? 'ta nouvelle formule'} »`;
  if (r.mode === 'counter') return `Ta demande de passage à ${plan} est envoyée à ta box.`;
  const quand = r.effective_at
    ? ` le ${parisDate(r.effective_at, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : ' à ta prochaine échéance';
  return `Ton passage à ${plan} est programmé${quand}. Rien n'est facturé aujourd'hui.`;
}

/** Marque des échéanciers Stripe créés par le changement de formule : tout autre est étranger. */
export const SCHEDULE_MARK = 'athlex_plan_change';

export type Mode = 'online' | 'counter';

export function modeOf(m: Pick<MemberBilling, 'stripe_subscription_id' | 'subscription_status'>): Mode {
  return m.stripe_subscription_id && STRIPE_VIVANT.includes(m.subscription_status ?? '') ? 'online' : 'counter';
}

/** Motif qui interdit tout changement, dans l'ordre de la base. */
export function blockReason(
  m: Pick<MemberBilling, 'subscription_status' | 'past_due_since' | 'subscription_paused' | 'subscription_cancel_at_period_end'>,
  o: { boxClosed: boolean; cancellationPending: boolean },
): BlockReason | null {
  if (o.boxClosed) return 'box_closed';
  if (m.subscription_status === 'past_due' || m.past_due_since != null) return 'past_due';
  if (m.subscription_paused) return 'paused';
  if (m.subscription_cancel_at_period_end || o.cancellationPending) return 'cancel_scheduled';
  return null;
}

export interface PlanLite {
  id: string; box_id: string; name: string; price_cents: number;
  is_active: boolean; plan_type: string | null;
}

/** Formule vers laquelle ce membre peut passer : active, payante, de sa box, abonnement, autre que la sienne. */
export function planRefusal(plan: PlanLite | null, m: Pick<MemberBilling, 'box_id' | 'plan_id'>): PlanChangeCode | null {
  if (!plan || plan.box_id !== m.box_id || !plan.is_active || plan.plan_type !== 'subscription' || !(plan.price_cents > 0)) {
    return 'PLAN_CHANGE_INVALID_PLAN';
  }
  if (plan.id === m.plan_id) return 'PLAN_CHANGE_SAME_PLAN';
  return null;
}
