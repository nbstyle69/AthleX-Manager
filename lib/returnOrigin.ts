import { SITE_URL } from '@/lib/site-url';

/**
 * Origine des adresses de retour Stripe (success_url, cancel_url) : celle de
 * la page qui a lancé le paiement, si elle est autorisée, sinon le site public.
 *
 * - Production (domaine public, avec ou sans www) : toujours `SITE_URL`,
 *   comportement inchangé.
 * - Preview Vercel : seulement les adresses `*.vercel.app` DU déploiement qui
 *   répond (`VERCEL_URL`, `VERCEL_BRANCH_URL`), jamais un `*.vercel.app`
 *   quelconque, pour qu'aucune page tierce ne devienne une adresse de retour.
 * - Toute autre origine (absente, inconnue, http) : `SITE_URL`.
 */
export function returnOrigin(origin: string | null | undefined): string {
  if (!origin) return SITE_URL;
  const ownHosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter((h): h is string => !!h && h.endsWith('.vercel.app'))
    .map((h) => `https://${h}`);
  return ownHosts.includes(origin) ? origin : SITE_URL;
}
