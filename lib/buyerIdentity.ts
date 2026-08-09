/**
 * Lot 7A-bis — identité de l'acheteur sur les tunnels publics (/box/[slug]).
 *
 * Les tunnels restent ouverts aux visiteurs non connectés : on ne peut donc pas
 * exiger de session. Ce qu'on retire, c'est la confiance dans le `buyer_email`
 * du body, qui servait jusqu'ici à attribuer adhésion et crédits (achat
 * attribuable au compte d'autrui, ou perdu sur une faute de frappe).
 *
 * - acheteur connecté : `metadata.user_id` fait foi et `customer_email` est
 *   forcé à celui de la session ;
 * - acheteur anonyme : Stripe collecte et vérifie l'e-mail au paiement, et
 *   l'attribution se fera sur `session.customer_details.email`.
 *
 * `submitted_email` n'est conservé que pour journaliser un écart (détection
 * d'anomalie), jamais pour attribuer.
 */
export type BuyerIdentity = {
  userId: string | null;
  /** Imposé à Stripe seulement quand l'acheteur est connecté. */
  customerEmail: string | null;
  submittedEmail: string | null;
};

type SessionUser = { id?: string; email?: string } | null;

export function buyerIdentity(user: SessionUser, rawBuyerEmail: unknown): BuyerIdentity {
  const submittedEmail =
    typeof rawBuyerEmail === 'string' && rawBuyerEmail.trim() !== ''
      ? rawBuyerEmail.trim().toLowerCase()
      : null;

  if (user?.id && user.email) {
    return { userId: user.id, customerEmail: user.email, submittedEmail };
  }
  return { userId: null, customerEmail: null, submittedEmail };
}

/** Metadata d'identité à recopier sur la Checkout Session (et l'abonnement). */
export function identityMetadata(i: BuyerIdentity): Record<string, string> {
  return {
    ...(i.userId ? { user_id: i.userId } : {}),
    ...(i.submittedEmail ? { submitted_email: i.submittedEmail } : {}),
  };
}

/** `customer_email` n'est transmis à Stripe que s'il vient d'une session. */
export function customerEmailField(i: BuyerIdentity): { customer_email?: string } {
  return i.customerEmail ? { customer_email: i.customerEmail } : {};
}
