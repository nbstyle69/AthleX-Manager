import { readFileSync } from 'fs';
import { join } from 'path';
import { USERS_SORT_FIELD, defaultSortDir, nextUsersSort, parseUsersSort } from '@/lib/admin/usersSort';

const params = (q: string) => new URLSearchParams(q);

describe('tri de /admin/users', () => {
  it('chaque colonne triable vise son champ de profiles, et seulement celles-là', () => {
    expect(USERS_SORT_FIELD).toEqual({
      username: 'username',
      role: 'role',
      elo: 'elo',
      matches: 'total_matches',
      wins: 'wins',
      date: 'created_at',
    });
  });

  it('sens au premier clic : desc pour les nombres et la date, asc pour le texte', () => {
    expect(defaultSortDir('elo')).toBe('desc');
    expect(defaultSortDir('matches')).toBe('desc');
    expect(defaultSortDir('wins')).toBe('desc');
    expect(defaultSortDir('date')).toBe('desc');
    expect(defaultSortDir('username')).toBe('asc');
    expect(defaultSortDir('role')).toBe('asc');
  });

  it('clic : autre colonne → son sens par défaut ; même colonne → sens inversé', () => {
    expect(nextUsersSort({ col: 'elo', dir: 'desc' }, 'date')).toEqual({ col: 'date', dir: 'desc' });
    expect(nextUsersSort({ col: 'date', dir: 'desc' }, 'date')).toEqual({ col: 'date', dir: 'asc' });
    expect(nextUsersSort({ col: 'date', dir: 'asc' }, 'date')).toEqual({ col: 'date', dir: 'desc' });
    expect(nextUsersSort({ col: 'elo', dir: 'desc' }, 'username')).toEqual({ col: 'username', dir: 'asc' });
  });

  it('lit tri et sens de l’URL', () => {
    expect(parseUsersSort(params('tri=date&sens=desc'))).toEqual({ col: 'date', dir: 'desc' });
    expect(parseUsersSort(params('tri=date&sens=asc'))).toEqual({ col: 'date', dir: 'asc' });
    expect(parseUsersSort(params('tri=username&sens=desc'))).toEqual({ col: 'username', dir: 'desc' });
  });

  it('valeur absente ou inconnue → tri par défaut (elo desc)', () => {
    for (const q of ['', 'tri=level', 'tri=box&sens=asc', 'tri=email&sens=asc', 'tri=toString', 'tri=__proto__', 'tri=DATE']) {
      expect(parseUsersSort(params(q))).toEqual({ col: 'elo', dir: 'desc' });
    }
  });

  it('sens inconnu → sens par défaut de la colonne', () => {
    expect(parseUsersSort(params('tri=date&sens=up'))).toEqual({ col: 'date', dir: 'desc' });
    expect(parseUsersSort(params('tri=role'))).toEqual({ col: 'role', dir: 'asc' });
  });

  it('la page trie par la base avant la pagination, départage par id, sans tri local', () => {
    const src = readFileSync(join(__dirname, '../../app/admin/users/page.tsx'), 'utf8');
    const order = src.indexOf('.order(USERS_SORT_FIELD[col]');
    const tie = src.indexOf(".order('id', { ascending: true })");
    const range = src.indexOf('.range(from, to)');
    expect(order).toBeGreaterThan(-1);
    expect(tie).toBeGreaterThan(order);
    expect(range).toBeGreaterThan(tie);
    expect(src).toContain('nullsFirst: false');
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toContain("select('*'");
  });
});
