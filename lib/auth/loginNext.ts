/**
 * Retour après connexion (`/login/...?next=`). Seuls les chemins de ce site
 * sont suivis : `//hôte` et `/\hôte` sont des URL protocol-relative, pas des
 * chemins, et feraient de la connexion un redirecteur ouvert.
 */
export function safeLoginNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/** Page de connexion athlète qui ramène sur `path` une fois connecté. */
export function loginThenReturnTo(path: string): string {
  const next = safeLoginNext(path);
  return next ? `/login/athlete?next=${encodeURIComponent(next)}` : '/login/athlete';
}
