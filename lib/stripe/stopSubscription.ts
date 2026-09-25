import Stripe from 'stripe';

/**
 * Arrêt d'un abonnement Stripe : sur le compte connecté d'une box, ou sur le
 * compte de la plateforme quand `stripeAccount` est absent (abonnement de la
 * box à AthleX, archivage PR 2).
 *
 * Module partagé (S2 : abonnements de salle ; S4 : programmes et offres ;
 * archivage d'une box) :
 * - `period_end` : l'abonnement se termine à la fin de la période payée ;
 * - `now` : annulation immédiate, sans prorata ni facture finale.
 * Aucun remboursement ici (option A) : un éventuel remboursement viendra en S3.
 *
 * La clé d'idempotence est fournie par l'appelant : rejouer le même arrêt ne
 * crée pas de seconde opération chez Stripe.
 */
export type StopMode = 'period_end' | 'now';

export interface StopSubscriptionParams {
  /** Compte connecté de la box ; absent = compte de la plateforme. */
  stripeAccount?: string;
  subscriptionId: string;
  mode: StopMode;
  idempotencyKey: string;
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

/** En-têtes Stripe : le compte connecté seulement s'il est donné. */
const onAccount = (stripeAccount: string | undefined) => (stripeAccount ? { stripeAccount } : {});

/**
 * État Stripe d'un abonnement (lecture serveur) : déjà en voie d'arrêt, et fin
 * de la période payée. Sert là où la base ne garde pas de drapeau « fin
 * programmée » (programmes, offres, abonnement de la box à AthleX) : relancer
 * un arrêt déjà fait ne doit ni re-journaliser ni re-prévenir.
 */
export async function readSubscriptionState({
  stripeAccount,
  subscriptionId,
}: { stripeAccount?: string; subscriptionId: string }): Promise<{ stopping: boolean; status: string | null; periodEnd: string | null }> {
  const stripe = getStripe();
  const sub: any = await stripe.subscriptions.retrieve(subscriptionId, {}, onAccount(stripeAccount));
  const epoch = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
  return {
    stopping: !!sub?.cancel_at_period_end || sub?.status === 'canceled',
    status: sub?.status ?? null,
    periodEnd: epoch ? new Date(epoch * 1000).toISOString() : null,
  };
}

export async function stopSubscription({
  stripeAccount,
  subscriptionId,
  mode,
  idempotencyKey,
}: StopSubscriptionParams): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (mode === 'period_end') {
    return stripe.subscriptions.update(
      subscriptionId,
      { cancel_at_period_end: true },
      { ...onAccount(stripeAccount), idempotencyKey },
    );
  }
  return stripe.subscriptions.cancel(
    subscriptionId,
    { prorate: false, invoice_now: false },
    { ...onAccount(stripeAccount), idempotencyKey },
  );
}
