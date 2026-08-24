import fs from 'fs';
import path from 'path';

/**
 * Contrôle mécanique : hors des résolveurs, aucune page ne redéduit « quelles
 * box j'administre ».
 *
 * `/programming` le faisait — inventaire à la main sur `boxes.owner_id` +
 * `box_members.role = 'owner'`, cookie `active_box_id` recopié, `error` ignoré.
 * Résultat mesuré en prod : « Aucune box active » et « Vous n'avez pas encore
 * publié de programmation » à un gérant qui a une box et deux offres publiées.
 * La source unique est `get_my_admin_boxes()`, via `lib/getMyBox` (client) ou
 * `lib/supabase/server` (serveur), et elle échoue bruyamment.
 *
 * Ce contrôle était rouge sur `app/(dashboard)/programming/page.tsx` avant la
 * correction : deux violations, la constante recopiée et la branche
 * `box_members.role = 'owner'`.
 */
const ROOTS = ['app', 'components'];
const RESOLVERS = [
  path.join('lib', 'getMyBox.ts'),
  path.join('lib', 'supabase', 'server.ts'),
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const FILES = ROOTS.flatMap((r) => walk(path.join(process.cwd(), r))).map((f) =>
  path.relative(process.cwd(), f),
);

describe('résolveur de box : une seule source', () => {
  it('énumère bien des fichiers (un contrôle qui ne lit rien est vert pour rien)', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('le nom du cookie de box active ne se recopie que dans les résolveurs', () => {
    const offenders = FILES.filter((f) =>
      /ACTIVE_BOX_COOKIE\s*=\s*['"]/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('les résolveurs, eux, portent bien la constante', () => {
    for (const r of RESOLVERS) {
      expect(fs.readFileSync(path.join(process.cwd(), r), 'utf8')).toMatch(
        /ACTIVE_BOX_COOKIE\s*=\s*'active_box_id'/,
      );
    }
  });

  it("aucune page ne rejoue « je suis owner de cette box » sur box_members", () => {
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return src.includes("from('box_members')") && /\.eq\('role',\s*'owner'\)/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
