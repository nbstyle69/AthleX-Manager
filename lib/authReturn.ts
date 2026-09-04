/**
 * Retour d'un lien e-mail Supabase Auth (implicit `#…&type=…` ou PKCE `?code=…&type=…`).
 *
 * Seul `recovery` doit aboutir au formulaire de nouveau mot de passe ; un
 * `signup` (ou `email_change`, `invite`) confirme simplement l'adresse et
 * renvoie vers la page d'atterrissage publique.
 */
export const EMAIL_CONFIRMED_PATH = '/email-confirme';
export const UPDATE_PASSWORD_PATH = '/update-password';

export type AuthReturnKind = 'recovery' | 'signup' | 'unknown';

export function readAuthReturnType(hash: string, search: string): string | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('type');
  const fromQuery = new URLSearchParams(search.replace(/^\?/, '')).get('type');
  return fromHash ?? fromQuery;
}

export function classifyAuthReturn(type: string | null): AuthReturnKind {
  if (type === 'recovery') return 'recovery';
  if (type === 'signup' || type === 'email_change' || type === 'invite' || type === 'magiclink') return 'signup';
  return 'unknown';
}

/**
 * Chemin cible pour une URL de retour auth. Un type absent (PKCE sans `type`)
 * est traité comme une récupération : c'est le seul flux web qui en émet.
 */
export function resolveAuthReturnPath(hash: string, search: string): string {
  return classifyAuthReturn(readAuthReturnType(hash, search)) === 'signup'
    ? EMAIL_CONFIRMED_PATH
    : UPDATE_PASSWORD_PATH;
}
