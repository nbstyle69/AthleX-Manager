import fs from 'fs';
import path from 'path';

/**
 * « Où est-ce que j'assigne une prog à un membre ? » — la question du gérant.
 *
 * Ces assertions portent sur la structure de la page, pas sur son apparence :
 * une capture d'écran ne dirait pas par quelle porte l'accès est attribué. Ce
 * qui compte ici, c'est que l'attribution passe par `join_program` (qui vérifie
 * gérant/co-gérant côté serveur) et non par un INSERT direct dans
 * `program_members` — un INSERT direct s'appuierait sur la seule RLS et
 * contournerait les gardes de provenance de la RPC.
 */
const RACINE = process.cwd();
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const PAGE = 'app/(dashboard)/programs/page.tsx';
const CONTENU = 'lib/programContent.ts';

describe('assignation d’un programme à un membre (lot 5-C)', () => {
  const page = lire(PAGE);

  it('la page offre une entrée d’attribution d’accès', () => {
    expect(page).toContain('assignerAcces');
    expect(page).toContain('Offrir l&apos;accès à un membre');
  });

  it('l’attribution passe par join_program, pas par un insert direct', () => {
    expect(page).toContain("rpc('join_program'");
    expect(page).toContain("p_source: 'staff'");
    expect(page).not.toContain(".from('program_members')\n      .insert");
    expect(page).not.toMatch(/from\('program_members'\)[\s\S]{0,80}\.insert\(/);
  });

  it('les inscrits ne sont pas lus par une jointure que PostgREST ne peut pas résoudre', () => {
    // `program_members.user_id` a une FK vers `auth.users`, pas vers
    // `public.profiles` : l'embed rendait « Could not find a relationship » et
    // la modale s'ouvrait vide. Les pseudos se lisent en seconde requête.
    expect(page).not.toMatch(/from\('program_members'\)[\s\S]{0,200}profile:profiles\(/);
    expect(page).toMatch(/from\('profiles'\)[\s\S]{0,120}\.in\('id',/);
  });

  it('les candidats sont les membres actifs de la box du programme', () => {
    expect(page).toMatch(/from\('box_members'\)[\s\S]{0,220}eq\('status', 'active'\)/);
  });

  it('un accès payé ne se retire pas d’un clic', () => {
    expect(page).toContain("row.provenance === 'stripe'");
    expect(page).toContain('remboursement Stripe');
  });

  it('la provenance est affichée, pas devinée', () => {
    expect(page).toContain('LIBELLE_PROVENANCE');
    expect(page).toContain('legacy_unverified');
  });

  it('une lecture en échec ne se présente pas comme une liste vide', () => {
    expect(page).toContain('setAccessError');
    expect(page).toMatch(/inscrits\.error\?\.message/);
  });

  it('le contenu du programme reste sur le chemin canonique', () => {
    const contenu = lire(CONTENU);
    expect(contenu).toContain('wod_program_access');
    expect(contenu).toContain('box_wods');
    expect(contenu).not.toContain("from('program_wods')");
    expect(page).not.toContain("from('program_wods')");
  });
});
