/**
 * « Mon abonnement » : ce que l'app et /compte affichent. `buildOverview` est
 * pur (mise en forme, testée) ; `readOverview` lit la base et Stripe. Aucun
 * identifiant Stripe ne sort d'ici.
 */
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { modeOf, planRefusal, type BlockReason, type MemberBilling, type Mode, type PlanLite } from './planChange';
import { connectAccount, loadBlockReason, loadMember } from './server';

/** « Carte •••• 4242 », « Prélèvement SEPA •••• 1234 », ou null. */
export function paymentMethodText(pm: { type?: string | null; card?: { last4?: string | null } | null; sepa_debit?: { last4?: string | null } | null } | null | undefined): string | null {
  if (pm?.type === 'card' && pm.card?.last4) return `Carte •••• ${pm.card.last4}`;
  if (pm?.type === 'sepa_debit' && pm.sepa_debit?.last4) return `Prélèvement SEPA •••• ${pm.sepa_debit.last4}`;
  return null;
}

export interface MembershipOverview {
  box: { id: string; name: string | null };
  plan: { id: string; name: string } | null;
  price_cents: number | null;
  status: string | null;
  mode: Mode;
  next_billing_at: string | null;
  payment_method: string | null;
  scheduled_change: { plan: { id: string; name: string }; at: string | null } | null;
  pending_request: { plan: { id: string; name: string }; at: string } | null;
  available_plans: { id: string; name: string; price_cents: number }[];
  block_reason: BlockReason | null;
  /** En impayé seulement : la page Stripe de la dernière facture ouverte. */
  unpaid_invoice_url: string | null;
}

/** Mise en forme de l'overview, sans aucun identifiant Stripe. */
export function buildOverview(i: {
  member: MemberBilling;
  box: { id: string; name: string | null };
  plans: PlanLite[];
  pendingRequest: { to_plan_id: string; created_at: string } | null;
  paymentMethod: string | null;
  block: BlockReason | null;
  unpaidInvoiceUrl: string | null;
}): MembershipOverview {
  const { member: m } = i;
  const byId = new Map(i.plans.map((p) => [p.id, p]));
  const ref = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    return p ? { id: p.id, name: p.name } : null;
  };
  const current = m.plan_id ? byId.get(m.plan_id) ?? null : null;
  const scheduled = ref(m.scheduled_plan_id);
  const pending = i.pendingRequest ? ref(i.pendingRequest.to_plan_id) : null;
  return {
    box: i.box,
    plan: ref(m.plan_id),
    price_cents: m.amount_cents ?? current?.price_cents ?? null,
    status: m.subscription_status ?? m.status,
    mode: modeOf(m),
    next_billing_at: modeOf(m) === 'online' ? m.subscription_current_period_end : null,
    payment_method: i.paymentMethod,
    scheduled_change: scheduled ? { plan: scheduled, at: m.scheduled_change_at } : null,
    pending_request: pending && i.pendingRequest ? { plan: pending, at: i.pendingRequest.created_at } : null,
    available_plans: i.plans
      .filter((p) => planRefusal(p, m) === null)
      .sort((a, b) => a.price_cents - b.price_cents)
      .map((p) => ({ id: p.id, name: p.name, price_cents: p.price_cents })),
    block_reason: i.block,
    unpaid_invoice_url: i.block === 'past_due' ? i.unpaidInvoiceUrl : null,
  };
}

/** Lecture de « Mon abonnement » : null si l'appelant n'a pas d'adhésion active. */
export async function readOverview(service: SupabaseClient, stripe: Stripe, userId: string): Promise<MembershipOverview | null> {
  const m = await loadMember(service, userId);
  if (!m) return null;

  const [box, plansRes, pendingRes, block] = await Promise.all([
    connectAccount(service, m.box_id),
    service.from('membership_plans').select('id, box_id, name, price_cents, is_active, plan_type').eq('box_id', m.box_id),
    service.from('box_plan_change_requests').select('to_plan_id, created_at')
      .eq('box_id', m.box_id).eq('member_id', userId).eq('status', 'pending').maybeSingle(),
    loadBlockReason(service, m),
  ]);

  let paymentMethod: string | null = null;
  let unpaidInvoiceUrl: string | null = null;
  if (modeOf(m) === 'online' && box?.stripe_account_id) {
    const opts = { stripeAccount: box.stripe_account_id };
    try {
      const sub: any = await stripe.subscriptions.retrieve(m.stripe_subscription_id!, { expand: ['default_payment_method'] }, opts);
      let pm = sub.default_payment_method;
      if (!pm && sub.customer) {
        const cust: any = await stripe.customers.retrieve(sub.customer, { expand: ['invoice_settings.default_payment_method'] }, opts);
        pm = cust?.invoice_settings?.default_payment_method ?? null;
      }
      paymentMethod = paymentMethodText(typeof pm === 'object' ? pm : null);
      if (block === 'past_due') {
        const open = await stripe.invoices.list({ subscription: m.stripe_subscription_id!, status: 'open', limit: 1 }, opts);
        unpaidInvoiceUrl = open.data[0]?.hosted_invoice_url ?? null;
      }
    } catch (err) {
      // Stripe injoignable : l'écran reste lisible, sans moyen de paiement.
      console.error('membership overview: stripe read failed', err instanceof Error ? err.name : 'error');
    }
  }

  return buildOverview({
    member: m,
    box: { id: m.box_id, name: box?.name ?? null },
    plans: (plansRes.data ?? []) as PlanLite[],
    pendingRequest: (pendingRes.data ?? null) as { to_plan_id: string; created_at: string } | null,
    paymentMethod,
    block,
    unpaidInvoiceUrl,
  });
}
