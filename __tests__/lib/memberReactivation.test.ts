// Débannir passe par `reactivate_box_member` ; son refus « abonnement en cours »
// s'affiche dans une boîte d'information ; bannir passe par la route serveur.
// Aucune écriture de `status` de box_members depuis le navigateur.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { reactivationErrorBox } from '@/lib/memberReactivation';
import { ERROR_TITLE } from '@/lib/confirmDialog';

const MSG = 'Ce membre a encore un abonnement Stripe en cours : arrête-le depuis le Manager avant de le réactiver.';
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('reactivationErrorBox', () => {
  it('refus de la base : boîte d’information avec son message', () => {
    expect(reactivationErrorBox({ message: `REACTIVATION_ABONNEMENT_EN_COURS: ${MSG}` }))
      .toEqual({ kind: 'info', title: 'Réactivation impossible', body: MSG });
  });

  it('autre erreur : boîte d’erreur avec le message reçu, jamais un texte générique à sa place', () => {
    expect(reactivationErrorBox({ message: 'FORBIDDEN: reserve aux gestionnaires de la box' }))
      .toEqual({ kind: 'error', title: ERROR_TITLE, body: 'FORBIDDEN: reserve aux gestionnaires de la box' });
    expect(reactivationErrorBox({ message: '' })).toEqual({ kind: 'error', title: ERROR_TITLE, body: 'Le membre n’a pas été réactivé.' });
  });

  it('succès : aucune boîte', () => {
    expect(reactivationErrorBox(null)).toBeNull();
  });
});

describe('page Membres', () => {
  const s = read('app/(dashboard)/members/page.tsx');

  it('débannir appelle reactivate_box_member, affiche son refus, puis seulement met l’écran à jour', () => {
    expect(s).toMatch(/const \{ error \} = await supabase\.rpc\('reactivate_box_member', \{ p_box_id: boxId, p_member_id: member\.id \}\);\s*setBanning\(null\);\s*const box = reactivationErrorBox\(error\);\s*if \(box\) \{ inform\(box\); return; \}\s*setMembers\(prev => prev\.map\(m => m\.id === member\.id \? \{ \.\.\.m, is_banned: false, plan_id: null \} : m\)\);/);
  });

  it('bannir passe par la route serveur /api/members/ban', () => {
    expect(s).toMatch(/fetch\('\/api\/members\/ban', \{/);
  });
});

it('aucune écriture de `status` de box_members depuis le navigateur (bannir, débannir)', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) return n === 'api' && d.endsWith('app') ? [] : walk(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
  const hits: string[] = [];
  for (const f of ['app', 'components', 'hooks'].flatMap(r => walk(join(process.cwd(), r)))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from\(\s*['"]box_members['"]\s*\)\s*\.(update|insert|upsert)\(/g)) {
      const after = src.slice(m.index! + m[0].length);
      const payload = after.slice(0, after.indexOf(')'));
      if (/\bstatus\s*:/.test(payload)) hits.push(`${f}: ${payload.trim().slice(0, 60)}`);
    }
  }
  expect(hits).toEqual([]);
});
