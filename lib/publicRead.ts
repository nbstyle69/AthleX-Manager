/**
 * À la clé anon, l'erreur courante est le refus, pas la panne : `data ?? []`
 * le transforme en liste vide et la page rend un écran plausible mais amputé.
 * Un vide légitime reste légitime ; seule l'erreur est fatale.
 */
export function rowsOrThrow<T>(
  label: string,
  result: { data: unknown; error: { message: string; code?: string } | null },
): T[] {
  if (result.error) {
    throw new Error(
      `Lecture publique refusée (${label}) : ${result.error.message}${
        result.error.code ? ` [${result.error.code}]` : ''
      }`,
    );
  }
  return (result.data ?? []) as T[];
}

/** Sur une ligne unique, un refus devient `data: null` — donc un 404 qui ment. */
export function rowOrNullOrThrow<T>(
  label: string,
  result: { data: unknown; error: { message: string; code?: string } | null },
): T | null {
  if (result.error && result.error.code !== 'PGRST116') {
    throw new Error(
      `Lecture publique refusée (${label}) : ${result.error.message}${
        result.error.code ? ` [${result.error.code}]` : ''
      }`,
    );
  }
  return (result.data ?? null) as T | null;
}
