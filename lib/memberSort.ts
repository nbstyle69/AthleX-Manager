export type MemberSortCol =
  | 'username'
  | 'level'
  | 'elo'
  | 'plan'
  | 'role'
  | 'status'
  | '';

export type SortDir = 'asc' | 'desc';

export type EloChoice = '' | 'asc' | 'desc';

export interface SortableMember {
  username: string;
  level: string;
  elo: number;
  plan_id: string | null;
  role: string;
  is_banned: boolean;
}

const LEVEL_ORDER: Record<string, number> = { 'rx+': 4, rx: 3, scaled: 2, foundations: 1 };
const ROLE_ORDER: Record<string, number> = { owner: 3, coach: 2, member: 1 };

export interface SortState {
  sortCol: MemberSortCol;
  sortDir: SortDir;
}

/**
 * L'état affiché des puces « ELO » se dérive du tri réellement appliqué : une
 * puce ne peut pas s'afficher active pendant qu'une autre colonne trie.
 */
export function eloChoiceOf({ sortCol, sortDir }: SortState): EloChoice {
  return sortCol === 'elo' ? sortDir : '';
}

export function sortStateForEloChoice(choice: EloChoice): SortState {
  return choice === '' ? { sortCol: '', sortDir: 'asc' } : { sortCol: 'elo', sortDir: choice };
}

export function sortMembers<T extends SortableMember>(
  members: T[],
  { sortCol, sortDir }: SortState,
  planName: (planId: string | null) => string,
): T[] {
  if (!sortCol) return members;
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...members].sort((a, b) => {
    switch (sortCol) {
      case 'username': return dir * a.username.localeCompare(b.username);
      case 'level':    return dir * ((LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0));
      case 'elo':      return dir * (a.elo - b.elo);
      case 'plan':     return dir * planName(a.plan_id).localeCompare(planName(b.plan_id));
      case 'role':     return dir * ((ROLE_ORDER[a.role] ?? 0) - (ROLE_ORDER[b.role] ?? 0));
      case 'status':   return dir * (Number(a.is_banned) - Number(b.is_banned));
      default:         return 0;
    }
  });
}
