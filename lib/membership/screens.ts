/**
 * « Mon abonnement » côté écrans (site /compte, Abonnés du Manager) : textes
 * des maquettes (Figma 36:12342) et appels aux routes de la PR serveur #424.
 * Aucune règle ici : les refus viennent de l'overview (`block_reason`) et des
 * routes ; ce module ne fait que les dire.
 */
import { parisDate } from '@/lib/datetime';
import type { MembershipOverview } from './overview';

export type { MembershipOverview };

/** « 35 € », « 39,90 € ». */
export function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/** « 01 nov. 2026 », en heure de Paris. */
export function shortDate(iso: string): string {
  return parisDate(iso, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** La veille de la bascule, sans l'année : « 31 oct. ». */
function veille(iso: string): string {
  return parisDate(new Date(new Date(iso).getTime() - 86_400_000).toISOString(), { day: '2-digit', month: 'short' });
}

type PlanRef = { id: string; name: string };

/** « 3 séances / semaine à 35 € /mois », sans le prix s'il n'est pas connu. */
function avecPrix(plan: PlanRef, o: Pick<MembershipOverview, 'available_plans'>): string {
  const p = o.available_plans.find((x) => x.id === plan.id);
  return p ? `${plan.name} à ${euros(p.price_cents)} /mois` : plan.name;
}

/** Encart du choix en ligne : la date d'effet, sans prorata. */
export function effectiveDateNotice(
  o: Pick<MembershipOverview, 'plan' | 'next_billing_at' | 'available_plans'>,
  choisie: PlanRef,
): string {
  const actuelle = o.plan?.name ?? 'ta formule actuelle';
  const nouvelle = `Ta nouvelle formule, ${avecPrix(choisie, o)},`;
  if (!o.next_billing_at) {
    return `Tu gardes ${actuelle} jusqu’à ta prochaine échéance. ${nouvelle} sera prélevée ensuite. Aucun prorata, rien n’est facturé aujourd’hui.`;
  }
  return `Tu gardes ${actuelle} jusqu’au ${veille(o.next_billing_at).replace(/\.$/, '')}. ${nouvelle} sera prélevée à partir du ${shortDate(o.next_billing_at)}. Aucun prorata, rien n’est facturé aujourd’hui.`;
}

/** Encart du changement programmé (en ligne). */
export function scheduledChangeNotice(o: Pick<MembershipOverview, 'plan' | 'scheduled_change' | 'available_plans'>): string {
  const s = o.scheduled_change!;
  const quand = s.at ? ` à partir du ${shortDate(s.at)}` : ' à ta prochaine échéance';
  const garde = o.plan ? ` Tu gardes ${o.plan.name} jusque-là.` : '';
  return `Changement programmé : ${avecPrix(s.plan, o)}${quand}.${garde}`;
}

/** Encart de la demande envoyée (comptoir). */
export function pendingRequestNotice(o: Pick<MembershipOverview, 'pending_request' | 'available_plans'>): string {
  const r = o.pending_request!;
  return `Demande envoyée à ta box le ${shortDate(r.at)} : ${avecPrix(r.plan, o)}. Ta box te confirmera le changement.`;
}

/** Encart de l'impayé ; la date est celle du premier impayé, si la base la connaît. */
export function pastDueNotice(pastDueSince: string | null): string {
  const quand = pastDueSince ? ` le ${shortDate(pastDueSince)}` : '';
  return `Ton dernier prélèvement a échoué${quand}. Mets ton moyen de paiement à jour pour garder l’accès aux réservations.`;
}

export const PAST_DUE_CHANGE_NOTE = 'Le changement de formule est indisponible tant que le paiement n’est pas régularisé.';
export const COUNTER_NOTE = 'Tu paies au comptoir : ta box valide le changement et l’encaisse.';
export const COUNTER_REQUEST_NOTICE = 'Ta box reçoit ta demande. Le changement s’applique dès qu’elle l’accepte ; tu règles la différence au comptoir.';

/**
 * Ce que /compte propose pour cette adhésion. « Changer de formule » :
 * affiché en ligne sans changement programmé ni motif de blocage, grisé en
 * impayé, absent en pause, avec une résiliation programmée ou demandée, ou
 * box fermée.
 */
export function compteActions(o: Pick<MembershipOverview, 'mode' | 'block_reason' | 'scheduled_change' | 'pending_request' | 'available_plans' | 'unpaid_invoice_url'>) {
  const plans = o.available_plans.length > 0;
  if (o.mode === 'counter') {
    return {
      change: null,
      cancelScheduled: false,
      request: !o.pending_request && !o.block_reason && plans,
      cancelRequest: !!o.pending_request,
      payment: null,
      payInvoice: false,
    } as const;
  }
  const pastDue = o.block_reason === 'past_due';
  return {
    change: o.scheduled_change ? null
      : pastDue ? 'disabled' as const
      : !o.block_reason && plans ? 'enabled' as const
      : null,
    cancelScheduled: !!o.scheduled_change,
    request: false,
    cancelRequest: false,
    payment: pastDue ? 'update' as const : 'manage' as const,
    payInvoice: pastDue && !!o.unpaid_invoice_url,
  };
}

/** POST JSON vers une route du compte ; lève l'erreur de la route, sinon `fallback`. */
export async function postMembership<T = Record<string, unknown>>(url: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? fallback);
  return data as T;
}

/** URL du portail Stripe (moyen de paiement, factures) du compte connecté de la box. */
export async function paymentPortalUrl(): Promise<string> {
  const { url } = await postMembership<{ url?: string }>('/api/membership/payment-portal', undefined, "Le portail de paiement n'a pas pu s'ouvrir.");
  if (!url) throw new Error("Le portail de paiement n'a pas pu s'ouvrir.");
  return url;
}

/** Annule le changement programmé (en ligne) ou la demande en attente (comptoir). */
export function cancelPlanChange() {
  return postMembership('/api/change-membership-plan/cancel', undefined, "L'annulation a échoué.");
}

/** Le gérant ou un co-gérant accepte ou refuse une demande (comptoir). */
export function decidePlanChange(requestId: string, accept: boolean) {
  return postMembership<{ ok: boolean; decided: boolean; status: string }>(
    '/api/members/plan-change-requests/decide', { request_id: requestId, accept }, 'La décision a échoué.',
  );
}

/** « → 3 séances / semaine le 1 nov. » : le changement programmé, sur la ligne du membre. */
export function scheduledRowLabel(planName: string, at: string | null): string {
  return at ? `→ ${planName} le ${parisDate(at, { day: 'numeric', month: 'short' })}` : `→ ${planName}`;
}
