/**
 * Les phrases que l'interface d'accès aux programmes doit dire exactement.
 *
 * Elles vivent ici, et pas dans le JSX, pour une raison de vérification : une
 * assertion sur le texte d'un fichier passe encore quand la phrase est coupée,
 * reformulée ou concaténée à côté. Exportée, la phrase est comparée telle que
 * l'utilisateur la lira.
 */

/** Retrait d'un accès encaissé au comptoir : l'app ne rend pas l'argent. */
export const RETRAIT_COMPTOIR_CONFIRMATION =
  "Cet accès a été payé au comptoir. Le remboursement éventuel est à ta charge, l'app ne peut pas le faire pour toi.";

/** Ligne Stripe : l'absence du bouton Retirer, expliquée là où il manque. */
export const MENTION_ACCES_STRIPE = 'Accès payé — se retire par remboursement Stripe';
