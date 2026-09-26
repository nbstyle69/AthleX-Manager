import { ERROR_TITLE, type InfoRequest } from '@/lib/confirmDialog';

/**
 * Débannissement (page Membres) par `reactivate_box_member` (gardée gérant,
 * remet la facturation à zéro, comme l'app). Son refus « abonnement Stripe en
 * cours » (athlex-app, PR H : `REACTIVATION_ABONNEMENT_EN_COURS: <message>`)
 * s'affiche dans une boîte d'information, avec le message de la base ; toute
 * autre erreur, dans la boîte d'erreur avec son message.
 */
export const REACTIVATION_REFUSED_TITLE = 'Réactivation impossible';

export function reactivationErrorBox(error: { message?: string } | null): InfoRequest | null {
  if (!error) return null;
  const refus = /^REACTIVATION_ABONNEMENT_EN_COURS:\s*([\s\S]+)$/.exec(error.message ?? '');
  return refus
    ? { kind: 'info', title: REACTIVATION_REFUSED_TITLE, body: refus[1].trim() }
    : { kind: 'error', title: ERROR_TITLE, body: error.message || 'Le membre n’a pas été réactivé.' };
}
