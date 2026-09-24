import Stripe from 'stripe';

/**
 * Arrêt d'un abonnement Stripe sur le compte connecté d'une box.
 *
 * Module partagé (S2 : abonnements de salle ; S4 : programmes et offres) :
 * - `period_end` : l'abonnement se termine à la fin de la période payée ;
 * - `now` : annulation immédiate, sans prorata ni facture finale.
 * Aucun remboursement ici (option A) : un éventuel remboursement viendra en S3.
 *
 * La clé d'idempotence est fournie par l'appelant : rejouer le même arrêt ne
 * crée pas de seconde opération chez Stripe.
 */
export type StopMode = 'period_end' | 'now';

export interface StopSubscriptionParams {
  stripeAccount: string;
  subscriptionId: string;
  mode: StopMode;
  idempotencyKey: string;
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
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
      { stripeAccount, idempotencyKey },
    );
  }
  return stripe.subscriptions.cancel(
    subscriptionId,
    { prorate: false, invoice_now: false },
    { stripeAccount, idempotencyKey },
  );
}
