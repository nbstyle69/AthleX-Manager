/**
 * Moyen de paiement affiché dans la boîte d'arrêt (S2/S4). `type` vient de
 * `box_members.payment_method_type` (écrit par le webhook Connect) quand
 * `get_box_billing` le servira ; en attendant il est absent, et seul le
 * comptoir se reconnaît — l'affichage d'avant.
 */
export function paymentMethodLabel(hasStripeSub: boolean, type: string | null | undefined): string | null {
  if (!hasStripeSub) return 'payé au comptoir';
  if (type === 'card') return 'carte';
  if (type === 'sepa_debit') return 'prélèvement SEPA';
  return null;
}
