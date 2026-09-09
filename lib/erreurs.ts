/**
 * Message lisible d'une erreur quelconque. Les erreurs PostgREST/Supabase
 * sont des objets `{ message, details, hint, code }` qui ne descendent pas
 * d'`Error` : `String(e)` rend « [object Object] ».
 */
export function messageErreur(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [o.message, o.details, o.hint].filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (parts.length > 0) return parts.join(' — ') + (typeof o.code === 'string' ? ` (${o.code})` : '');
    try { return JSON.stringify(e); } catch { /* cyclique */ }
  }
  return String(e);
}
