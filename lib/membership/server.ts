import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { boxEntryRefusal } from '@/lib/boxEntryGuard';
import { selectMembership } from '@/lib/compte/membership';
import {
  BLOCK_CODE, MEMBER_BILLING_COLUMNS, PLAN_CHANGE_MESSAGES, blockReason,
  type BlockReason, type MemberBilling, type PlanChangeCode,
} from './planChange';

/** Même version d'API que les autres routes du compte connecté (étape B des versions à venir). */
export function getConnectStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });
}

/**
 * Clé d'idempotence Stripe : un double clic ou une nouvelle tentative du
 * réseau dans la même minute ne crée ni ne modifie rien deux fois.
 * ponytail: fenêtre d'une minute ; passer une clé par demande depuis le
 * client si un renvoi plus tardif doit être couvert.
 */
export function idempotencyKey(...parts: (string | number)[]) {
  return ['plan-change', ...parts, Math.floor(Date.now() / 60_000)].join(':');
}

/** Refus nommé : `{ error, code }`, 409 par défaut. */
export function planChangeError(code: PlanChangeCode, status = 409) {
  return NextResponse.json({ error: PLAN_CHANGE_MESSAGES[code], code }, { status });
}

/**
 * L'adhésion de l'appelant : dans `boxId` s'il est donné (formule visée),
 * sinon celle que /compte affiche (`selectMembership`). Lue à la clé serveur,
 * toujours bornée par `member_id = userId`.
 */
export async function loadMember(service: SupabaseClient, userId: string, boxId?: string): Promise<MemberBilling | null> {
  let q = service.from('box_members').select(MEMBER_BILLING_COLUMNS).eq('member_id', userId);
  if (boxId) q = q.eq('box_id', boxId);
  const { data } = await q;
  const rows = (data ?? []) as unknown as MemberBilling[];
  if (boxId) return rows.find((r) => r.status === 'active') ?? null;
  const { membership } = selectMembership(rows);
  return membership?.status === 'active' ? membership : null;
}

/** Motif de blocage de cette adhésion (box fermée, impayé, pause, résiliation programmée ou demandée). */
export async function loadBlockReason(service: SupabaseClient, m: MemberBilling): Promise<BlockReason | null> {
  const [refus, demande] = await Promise.all([
    boxEntryRefusal(service, m.box_id, 'achat'),
    service.from('membership_cancellation_requests').select('id')
      .eq('box_id', m.box_id).eq('member_id', m.member_id).eq('status', 'pending').maybeSingle(),
  ]);
  return blockReason(m, { boxClosed: !!refus, cancellationPending: !!demande.data });
}

export function blockError(b: BlockReason) {
  return planChangeError(BLOCK_CODE[b]);
}

export async function connectAccount(service: SupabaseClient, boxId: string) {
  const { data } = await service.from('boxes')
    .select('id, name, stripe_account_id, stripe_onboarding_complete').eq('id', boxId).maybeSingle();
  return data as { id: string; name: string | null; stripe_account_id: string | null; stripe_onboarding_complete: boolean | null } | null;
}

/** Fin de la période en cours, lue aux deux emplacements selon la version d'API. */
export function periodEndEpoch(sub: any): number | null {
  return sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
}

/**
 * Le portail ne sert qu'à mettre à jour le moyen de paiement et à lire les
 * factures : ni résiliation, ni changement de formule (ils passent par nos
 * routes et leurs règles), ni modification des coordonnées.
 */
export const PORTAL_FEATURES = {
  payment_method_update: { enabled: true },
  invoice_history: { enabled: true },
  subscription_cancel: { enabled: false },
  subscription_update: { enabled: false },
  customer_update: { enabled: false },
} as const;

/** La configuration du portail de ce compte connecté : lue, sinon créée une seule fois et rangée. */
export async function portalConfiguration(service: SupabaseClient, stripe: Stripe, boxId: string, stripeAccount: string) {
  const lire = async () => {
    const { data } = await service.from('box_stripe_portal').select('stripe_portal_configuration_id').eq('box_id', boxId).maybeSingle();
    return (data as { stripe_portal_configuration_id: string } | null)?.stripe_portal_configuration_id ?? null;
  };
  const existante = await lire();
  if (existante) return existante;

  const config = await stripe.billingPortal.configurations.create(
    { business_profile: {}, features: PORTAL_FEATURES } as any,
    { stripeAccount, idempotencyKey: idempotencyKey('portal-config', boxId) },
  );
  // Conditionnel : une ligne déjà posée par un appel concurrent n'est pas remplacée.
  await service.from('box_stripe_portal')
    .upsert({ box_id: boxId, stripe_portal_configuration_id: config.id }, { onConflict: 'box_id', ignoreDuplicates: true });
  return (await lire()) ?? config.id;
}
