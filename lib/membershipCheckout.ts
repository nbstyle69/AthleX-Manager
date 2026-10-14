import { NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { buyerIdentity } from '@/lib/buyerIdentity';
import { refuseClosedBox } from '@/lib/boxEntryGuard';
import { parisDate } from '@/lib/datetime';
import {
  DUE_DATE_MAX_MONTHS, addDays, addMonths, isBillingDay, parisYmd, parseDueDate, planFirstBilling, ymdString,
  type BillingPlan, type DueDateRefusal,
} from '@/lib/membershipBilling';

/**
 * Contrôles communs à la création du Checkout d'une formule et à son aperçu :
 * invitation, formule active et payante, box ouverte et branchée sur Stripe.
 * L'aperçu passe par ici pour ne jamais montrer un montant qu'on refuserait
 * ensuite d'encaisser.
 */

export interface MembershipPlanRow {
  id: string; box_id: string; name: string; description: string | null;
  price_cents: number; currency: string; is_active: boolean;
  stripe_product_id: string | null; stripe_price_id: string | null;
  plan_type: 'subscription' | 'drop_in' | 'pack' | null;
  credits: number | null; validity_days: number | null;
  commitment_months: number | null;
}

export interface MembershipBoxRow {
  id: string; name: string; slug: string | null;
  stripe_account_id: string | null; stripe_onboarding_complete: boolean | null;
}

export interface MembershipContext {
  supabase: ReturnType<typeof createServiceClient>;
  identity: ReturnType<typeof buyerIdentity>;
  invitationId: string | null;
  /** Prochaine échéance (AAAA-MM-JJ) : celle de l'invitation, ou le lendemain d'un accès comptoir en cours ; sinon null. */
  dueDate: string | null;
  /** Fin d'un accès payé au comptoir encore en cours (AAAA-MM-JJ, incluse), d'où vient `dueDate` ; sinon null. */
  cashUntil: string | null;
  plan: MembershipPlanRow;
  planType: 'subscription' | 'drop_in' | 'pack';
  box: MembershipBoxRow & { stripe_account_id: string };
}

type Loaded = { ok: true; ctx: MembershipContext } | { ok: false; response: NextResponse };

export const ALREADY_SUBSCRIBED_ONLINE =
  'Tu as déjà un abonnement en ligne dans cette box : change de formule depuis Mon compte.';

const STRIPE_VIVANT = ['active', 'trialing', 'past_due'];

export async function loadMembershipContext(body: {
  plan_id?: unknown; buyer_email?: unknown; invitation_token?: unknown;
}, now: Date = new Date()): Promise<Loaded> {
  const supabase = createServiceClient();
  const fail = (response: NextResponse): Loaded => ({ ok: false, response });

  // Tunnel PUBLIC : aucune auth exigée. Mais l'e-mail du body n'attribue plus
  // rien — soit l'acheteur est connecté (on impose son e-mail de session et on
  // pose user_id), soit Stripe collecte et vérifie l'e-mail au paiement.
  const sessionUser = await getServerUser();
  let identity = buyerIdentity(sessionUser, body.buyer_email as string | undefined);

  // Invitation nominative (lot 4) : le compte vient d'être créé côté serveur,
  // le navigateur n'a donc pas forcément de session. L'identité et la formule
  // ne se prennent alors PAS dans le body — elles se relisent à partir du
  // jeton, seule chose que la page publique détienne.
  let invitationId: string | null = null;
  let dueDate: string | null = null;
  let planIdToUse: string | null = typeof body.plan_id === 'string' ? body.plan_id : null;

  const token = body.invitation_token;
  if (typeof token === 'string' && token.trim() !== '') {
    const { data: resolved, error: resolveErr } = await supabase.rpc(
      'resolve_box_invitation_for_checkout',
      { p_token: token.trim() },
    );
    const inv = resolved as {
      ok: boolean; reason?: string; id?: string; plan_id?: string; email?: string;
      next_due_date?: string | null;
    } | null;

    if (resolveErr || !inv?.ok || !inv.id || !inv.plan_id || !inv.email) {
      return fail(NextResponse.json(
        { error: 'Cette invitation n\'est plus payable.', reason: inv?.reason ?? resolveErr?.message },
        { status: 409 },
      ));
    }

    invitationId = inv.id;
    planIdToUse = inv.plan_id;
    dueDate = inv.next_due_date ?? null;

    const { data: invitedProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', inv.email)
      .maybeSingle();

    identity = {
      userId: (invitedProfile as { id?: string } | null)?.id ?? null,
      customerEmail: inv.email,
      submittedEmail: identity.submittedEmail,
    };
  }

  if (!planIdToUse) {
    return fail(NextResponse.json({ error: 'plan_id required' }, { status: 400 }));
  }

  const { data: plan, error: planErr } = await supabase
    .from('membership_plans')
    .select('id, box_id, name, description, price_cents, currency, is_active, stripe_product_id, stripe_price_id, plan_type, credits, validity_days, commitment_months')
    .eq('id', planIdToUse)
    .single();

  if (planErr || !plan) {
    return fail(NextResponse.json({ error: 'Plan not found' }, { status: 404 }));
  }

  const p = plan as unknown as MembershipPlanRow;

  if (!p.is_active) {
    return fail(NextResponse.json({ error: 'Cette formule n\'est plus disponible.' }, { status: 400 }));
  }
  if (p.price_cents <= 0) {
    return fail(NextResponse.json({ error: 'Cette formule est gratuite — rapproche-toi de ta box.' }, { status: 400 }));
  }

  // Archivage (PR 2) : box archivée ou en archivage programmé → refus.
  const refus = await refuseClosedBox(supabase, p.box_id, 'achat');
  if (refus) return fail(refus);

  const { data: box } = await supabase
    .from('boxes')
    .select('id, name, slug, stripe_account_id, stripe_onboarding_complete')
    .eq('id', p.box_id)
    .single();

  const b = box as unknown as MembershipBoxRow | null;

  if (!b?.stripe_account_id || !b.stripe_onboarding_complete) {
    return fail(NextResponse.json(
      { error: 'Cette box n\'a pas encore activé les paiements.' },
      { status: 409 },
    ));
  }

  const planType = p.plan_type ?? 'subscription';

  // Comptoir P1 : sans invitation, l'adhésion de l'acheteur connecté dans cette
  // box décide. Abonnement en ligne vivant → refus (sinon double prélèvement) ;
  // accès payé au comptoir en cours → premier prélèvement au lendemain de sa fin.
  // L'invitation, elle, porte sa propre échéance et reste prioritaire.
  let cashUntil: string | null = null;
  if (!invitationId && identity.userId && planType === 'subscription') {
    const { data: row, error: rowErr } = await supabase
      .from('box_members')
      .select('stripe_subscription_id, subscription_status, cash_access_until')
      .eq('box_id', p.box_id)
      .eq('member_id', identity.userId)
      .maybeSingle();
    if (rowErr) {
      // Sans cette lecture, rien n'écarte un second abonnement : on refuse.
      console.error('membership checkout: lecture de l’adhésion impossible', rowErr.code ?? 'error');
      return fail(NextResponse.json({ error: 'Ton adhésion n’a pas pu être vérifiée. Réessaie dans un instant.' }, { status: 500 }));
    }
    const m = row as { stripe_subscription_id: string | null; subscription_status: string | null; cash_access_until: string | null } | null;
    if (m?.stripe_subscription_id && STRIPE_VIVANT.includes(m.subscription_status ?? '')) {
      return fail(NextResponse.json({ error: ALREADY_SUBSCRIBED_ONLINE, reason: 'ALREADY_SUBSCRIBED_ONLINE' }, { status: 409 }));
    }
    const fin = !m?.stripe_subscription_id && m?.cash_access_until ? parseDueDate(m.cash_access_until) : null;
    if (fin && ymdString(fin) >= ymdString(parisYmd(now))) {
      cashUntil = ymdString(fin);
      dueDate = ymdString(addDays(fin, 1));
    }
  }

  return {
    ok: true,
    ctx: {
      supabase, identity, invitationId, dueDate, cashUntil, plan: p,
      planType,
      box: b as MembershipBoxRow & { stripe_account_id: string },
    },
  };
}

const DUE_DATE_MESSAGES: Record<DueDateRefusal, string> = {
  DUE_DATE_INVALID: 'Cette invitation n\'est pas payable : sa prochaine échéance est mal renseignée. Rapproche-toi de ta box.',
  DUE_DATE_TOO_FAR: 'Cette invitation n\'est pas payable : sa prochaine échéance tombe à plus de 12 mois. Rapproche-toi de ta box.',
};

// « 1er décembre », jamais « 1 décembre ».
const longDate = (ymd: string) => parisDate(ymd, { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ');

/**
 * Accès comptoir qui finit à plus de 12 mois : le passage en ligne n'ouvre
 * qu'au jour où son lendemain tombe à 12 mois (fin − 12 mois + 1 jour).
 */
export function cashTooFarMessage(cashUntil: string): string {
  const from = ymdString(addDays(addMonths(parseDueDate(cashUntil)!, -DUE_DATE_MAX_MONTHS), 1));
  return `Ton accès payé à la box court jusqu’au ${longDate(cashUntil)} : tu pourras passer au paiement en ligne à partir du ${longDate(from)}.`;
}

/**
 * Jour de prélèvement validé côté serveur, puis calcul du premier prélèvement.
 * Une échéance passée ou du jour bascule sur le paiement immédiat ; mal formée
 * ou à plus de 12 mois (modifiée en base), l'invitation n'est pas payable.
 */
export function billingPlanFor(
  ctx: MembershipContext, billingDay: unknown, now: Date = new Date(),
): { ok: true; plan: BillingPlan; billingDay: number } | { ok: false; response: NextResponse } {
  if (!isBillingDay(billingDay)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Choisis ton jour de prélèvement, entre le 1er et le 10 du mois.' },
        { status: 400 },
      ),
    };
  }
  const plan = planFirstBilling({ now, billingDay, priceCents: ctx.plan.price_cents, dueDate: ctx.dueDate });
  if ('refusal' in plan) {
    const error = ctx.cashUntil && plan.refusal === 'DUE_DATE_TOO_FAR'
      ? cashTooFarMessage(ctx.cashUntil)
      : DUE_DATE_MESSAGES[plan.refusal];
    return {
      ok: false,
      response: NextResponse.json({ error, reason: plan.refusal }, { status: 409 }),
    };
  }
  return { ok: true, plan, billingDay };
}
