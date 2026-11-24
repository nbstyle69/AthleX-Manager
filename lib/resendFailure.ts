import { randomUUID } from 'crypto';

/**
 * Échec d'un envoi Resend (forme de `sendMemberEmail`) : le journal garde le
 * statut HTTP et un identifiant de corrélation, jamais le corps de la réponse
 * (il peut citer l'adresse du destinataire ou la configuration du domaine) ni
 * l'adresse. Renvoie l'identifiant, à donner au navigateur pour le support.
 */
export function logResendFailure(tag: string, status: number): string {
  const ref = randomUUID();
  console.error(`${tag} resend error`, status, `ref=${ref}`);
  return ref;
}
