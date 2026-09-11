/**
 * Lien de récupération de mot de passe : ce que la route `/auth/confirm`
 * accepte, et ce qu'elle a le droit de dire au visiteur.
 *
 * Le lien de l'e-mail est ouvert dans n'importe quel navigateur (webmail,
 * application Gmail, téléphone). Le flux PKCE ne peut donc pas servir : le
 * `code_verifier` n'existe que dans le navigateur qui a demandé le lien. La
 * vérification se fait côté serveur, sur `token_hash`, et n'a besoin d'aucun
 * état local.
 */

import { SITE_URL } from '@/lib/site-url';

/** Types de jeton qu'un lien d'e-mail AthleX peut porter vers cette route. */
export const CONFIRM_TYPES = ['recovery', 'email', 'invite', 'magiclink'] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export function isConfirmType(value: string | null): value is ConfirmType {
  return value !== null && (CONFIRM_TYPES as readonly string[]).includes(value);
}

/**
 * Codes d'erreur rendus dans l'URL. Le message brut de GoTrue n'est jamais
 * exposé : il est en anglais, il change sans préavis, et il décrit l'état du
 * jeton plus précisément que nécessaire.
 */
export const RECOVERY_ERRORS = ['incomplete', 'expired', 'invalid'] as const;
export type RecoveryError = (typeof RECOVERY_ERRORS)[number];

export function isRecoveryError(value: string | null): value is RecoveryError {
  return value !== null && (RECOVERY_ERRORS as readonly string[]).includes(value);
}

/** Un lien expiré et un lien déjà consommé se disent de la même façon. */
export function recoveryErrorFrom(message?: string | null): RecoveryError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('expired') || m.includes('already') || m.includes('not found')) return 'expired';
  return 'invalid';
}

const DEFAULT_NEXT = '/update-password';

/**
 * Destination après vérification, ramenée à un chemin de ce site.
 *
 * Le template d'e-mail est partagé par le web et l'application mobile : chacun
 * passe son `redirectTo`, donc la valeur arrive ici en absolu. On n'en garde
 * que le chemin, et seulement si l'origine est la nôtre — un `next` étranger
 * recopié tel quel ferait de cette route un redirecteur ouvert, avec une
 * session fraîche dans les cookies.
 */
export function safeNext(next: string | null, origin: string = SITE_URL): string {
  if (!next) return DEFAULT_NEXT;
  let path = next;
  if (/^https?:\/\//i.test(next)) {
    try {
      const url = new URL(next);
      if (url.origin !== new URL(origin).origin) return DEFAULT_NEXT;
      path = `${url.pathname}${url.search}`;
    } catch {
      return DEFAULT_NEXT;
    }
  }
  // `//host` et `/\host` sont des URL protocol-relative, pas des chemins.
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return DEFAULT_NEXT;
  return path;
}
