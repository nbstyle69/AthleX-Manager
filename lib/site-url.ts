/**
 * Domaine public d'AthleX. Une seule source pour les URL absolues :
 * liens d'invitation, `success_url`/`cancel_url` Stripe, retours Connect.
 *
 * `NEXT_PUBLIC_SITE_URL` reste prioritaire (preview Vercel, dev local) ;
 * le repli n'est plus l'URL Vercel du projet mais le domaine réel — un
 * lien d'invitation ou un retour de paiement ne doit jamais renvoyer un
 * adhérent vers `*.vercel.app`.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://athlexapp.eu';

/**
 * Expéditeur Resend. Le domaine d'envoi doit être **vérifié** chez Resend
 * (`athlexapp.eu`, eu-west-1) : toute autre adresse produit un 403 à
 * l'envoi, sans effet sur la création de l'invitation.
 */
export const MAIL_FROM = process.env.RESEND_FROM ?? 'AthleX <noreply@athlexapp.eu>';
