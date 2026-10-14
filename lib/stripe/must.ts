/**
 * Webhooks Stripe : une requête Supabase (écriture, RPC, ou lecture qui
 * pilote une écriture) dont `error` est posé fait jeter le handler, pour que
 * la route réponde 500 et que Stripe rejoue l'événement. Avant, l'erreur était
 * avalée et l'état en base restait faux, en silence.
 *
 * Seul `error` compte : une lecture réussie sans ligne reste un cas métier.
 * `etape` nomme l'opération dans le journal (jamais de donnée personnelle).
 */
export function must<T extends { error: unknown }>(res: T, etape: string): T {
  if (res.error) {
    const err = res.error as { message?: string; code?: string };
    throw Object.assign(new Error(`${etape}: ${err.message ?? 'erreur Supabase'}`), { code: err.code ?? null });
  }
  return res;
}
