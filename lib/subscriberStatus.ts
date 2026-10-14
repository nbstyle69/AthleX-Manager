/**
 * Badge de statut du tableau d'Abonnés. Même sens qu'avant (actif vert, impayé
 * orange, annulé/remboursé rouge, autre statut gris), en jetons lisibles dans
 * les deux thèmes ; le libellé porte le sens.
 */
export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';

/** Libellé du bloc « À encaisser » d'Abonnés, repris par le badge. */
export const TO_COLLECT_LABEL = 'À encaisser';

export const PAYMENT_PENDING_LABEL = 'Paiement en attente';

export const STATUS_STYLE: Record<string, { label: string; variant: StatusVariant }> = {
  active:       { label: 'Actif',    variant: 'success' },
  past_due:     { label: 'Impayé',   variant: 'warning' },
  cancelled:    { label: 'Annulé',   variant: 'danger' },
  refunded:     { label: 'Remboursé', variant: 'danger' },
  expired:      { label: 'Accès terminé', variant: 'neutral' },
  // Comptoir P1 : invité « encaissement box » qui a rejoint, premier paiement attendu.
  pending_cash: { label: TO_COLLECT_LABEL, variant: 'warning' },
  // Invité « Paiement Stripe » qui n'a pas encore payé ; programme pas encore payé.
  pending_payment: { label: PAYMENT_PENDING_LABEL, variant: 'warning' },
  pending:      { label: PAYMENT_PENDING_LABEL, variant: 'warning' },
};

/** Statut sans libellé connu : affiché tel quel, en gris. */
export const statusBadge = (status: string) => STATUS_STYLE[status] ?? { label: status, variant: 'neutral' as StatusVariant };
