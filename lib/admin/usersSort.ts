/**
 * Tri de /admin/users, fait par la base (avant la pagination) et porté par
 * l'URL : `?tri=<colonne>&sens=<asc|desc>`.
 * Niveau et Box n'y sont pas : leur ordre ne se trie pas sans fonction serveur.
 */

export const USERS_SORT_FIELD = {
  username: 'username',
  role: 'role',
  elo: 'elo',
  matches: 'total_matches',
  wins: 'wins',
  date: 'created_at',
} as const;

export type UsersSortCol = keyof typeof USERS_SORT_FIELD;
export type SortDir = 'asc' | 'desc';

export const USERS_SORT_DEFAULT: { col: UsersSortCol; dir: SortDir } = { col: 'elo', dir: 'desc' };

/** Sens au premier clic : les plus grands (ou les plus récents) d'abord, l'alphabet pour le texte. */
export function defaultSortDir(col: UsersSortCol): SortDir {
  return col === 'username' || col === 'role' ? 'asc' : 'desc';
}

/** Lit `tri` et `sens` ; une valeur inconnue rend le tri par défaut (un sens inconnu, le sens par défaut de la colonne). */
export function parseUsersSort(params: { get(name: string): string | null }): { col: UsersSortCol; dir: SortDir } {
  const tri = params.get('tri');
  if (!tri || !Object.prototype.hasOwnProperty.call(USERS_SORT_FIELD, tri)) return USERS_SORT_DEFAULT;
  const col = tri as UsersSortCol;
  const sens = params.get('sens');
  return { col, dir: sens === 'asc' || sens === 'desc' ? sens : defaultSortDir(col) };
}

/** Clic sur un en-tête : même colonne → sens inversé ; autre colonne → son sens par défaut. */
export function nextUsersSort(current: { col: UsersSortCol; dir: SortDir }, col: UsersSortCol): { col: UsersSortCol; dir: SortDir } {
  if (current.col === col) return { col, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { col, dir: defaultSortDir(col) };
}
