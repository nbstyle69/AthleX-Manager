import { readFileSync } from 'fs';
import { join } from 'path';
import { CO_OWNER_RESERVED, roleChoices, roleErrorMessage } from '@/lib/memberRoles';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('rôle co-gérant réservé au gérant principal (écart A)', () => {
  it('le gérant principal a tous les choix, sur tout le monde', () => {
    expect(roleChoices(true, 'member')).toEqual(['member', 'coach', 'owner']);
    expect(roleChoices(true, 'owner')).toEqual(['member', 'coach', 'owner']);
  });

  it('un co-gérant ne propose jamais « co-gérant »', () => {
    expect(roleChoices(false, 'member')).toEqual(['member', 'coach']);
    expect(roleChoices(false, 'coach')).toEqual(['member', 'coach']);
  });

  it('un co-gérant ne retire pas le rôle à un co-gérant existant', () => {
    expect(roleChoices(false, 'owner')).toEqual([]);
  });

  it('le refus de la garde en base (42501) est nommé en français', () => {
    expect(roleErrorMessage({ code: '42501', message: 'permission denied' })).toBe(CO_OWNER_RESERVED);
    expect(roleErrorMessage({})).toBe('Le rôle n’a pas été modifié.');
  });

  it('la page Membres lit le gérant principal et filtre les choix', () => {
    const s = read('app/(dashboard)/members/page.tsx');
    expect(s).toMatch(/from\('boxes'\)\.select\('owner_id'\)\.eq\('id', box\.id\)/);
    expect(s).toMatch(/setIsPrimaryOwner\(\(boxRow as \{ owner_id: string \} \| null\)\?\.owner_id === user\.id\)/);
    expect(s).toMatch(/ROLES\.filter\(r => choices\.includes\(r\.key\)\)/);
    expect(s).toMatch(/<RolePopover member=\{m\} isPrimaryOwner=\{isPrimaryOwner\}/);
    // Un refus par la RLS ne lève rien : la ligne non écrite est un échec.
    expect(s).toMatch(/\.update\(\{ role: newRole \}\)[^\n]*\.select\('member_id'\)/);
    expect(s).toMatch(/else if \(!written\?\.length\) errors\.push\(roleErrorMessage\(\{\}\)\)/);
  });
});

describe('Whiteboard : pas de vente pour le coach (écart B)', () => {
  const s = read('app/(dashboard)/wods/page.tsx');

  it('le droit de vendre suit le titre gérant/co-gérant, comme les routes Marketplace', () => {
    expect(s).toMatch(/const sell = box\.my_role === 'owner';\s*setCanSell\(sell\);\s*await loadMarketplace\(box\.id, sell\);/);
  });

  it('« Copier vers une offre » n’est rendu que pour qui peut vendre', () => {
    expect(s.match(/<Copy size=\{13\} \/> Copier vers une offre/g)).toHaveLength(1);
    expect(s).toMatch(/\{canSell && \(\s*<Button(?:(?!<\/Button>)[\s\S])*<Copy size=\{13\} \/> Copier vers une offre\s*<\/Button>\s*\)\}/);
  });

  it('le coach ne charge ni ses offres ni les copies d’un WOD', () => {
    expect(s).toMatch(/sell\s*\? supabase\.from\('box_programming'\)/);
    expect(s).toMatch(/canSell\s*\? supabase\.from\('box_programming_wods'\)/);
  });
});
