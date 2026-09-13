import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  allSlugs,
  getTutorial,
  getTutorialIndex,
  getTutorials,
  getTutorialsForPage,
  neighbours,
} from '@/lib/tutorials';
import { LOCALES, type Locale } from '@/lib/tutorials/i18n';
import { HELP_PAGES, isPageId, pageIdForRoute } from '@/lib/tutorials/pages';
import { buildIndex, matchesRole, searchSlugs } from '@/lib/tutorials/search';
import { countSteps, normalize, toPlainText } from '@/lib/tutorials/text';

const EXPECTED_SLUGS = [
  'premiers-pas',
  'creer-un-wod',
  'visibilite-d-un-wod',
  'blocs-force-musculation-cardio',
  'mouvements-et-badges',
  'importer-un-pdf-de-programmation',
  'semaines-types',
  'groupes-de-membres',
  'membres-et-formules',
  'creneaux-et-reservations',
  'programmes-athletes-seances',
  'programmes-athletes-vente',
  'marketplace-s-abonner-a-une-programmation',
  'marketplace-appliquer-au-whiteboard',
  'marketplace-publier-une-offre',
  'tournois',
  'parcours-d-un-nouveau-membre',
  'page-publique-de-la-box',
  'formules-d-acces-a-la-salle',
  'essai-gratuit-et-reservation',
  'prospects-et-conversion',
  'inviter-un-membre',
  'abonnement-en-ligne-et-compte-athlete',
  'abonnes-et-facturation',
  'ce-que-voient-les-membres-dans-l-app',
  'actualites-et-messages',
  'statistiques',
  'reglages-de-la-box',
];

const BANNED = [/crossfit/i, /hyrox/i, /thehub/i];

describe('tutoriels — chargement et front matter', () => {
  it.each(LOCALES)('charge et valide tous les fichiers %s', (locale: Locale) => {
    const tutorials = getTutorials(locale);
    expect(tutorials).toHaveLength(EXPECTED_SLUGS.length);
    for (const t of tutorials) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.pages.length).toBeGreaterThan(0);
    }
  });

  it('expose les 28 slugs attendus, sans doublon', () => {
    expect(allSlugs().sort()).toEqual([...EXPECTED_SLUGS].sort());
    expect(new Set(allSlugs()).size).toBe(EXPECTED_SLUGS.length);
  });

  it('embarque exactement le contenu de content/tutorials (fichier généré à jour)', () => {
    const generated = ['content.generated.ts', 'components.generated.ts'].map((f) =>
      path.join(process.cwd(), 'lib', 'tutorials', f),
    );
    const before = generated.map((f) => fs.readFileSync(f, 'utf8'));
    execFileSync(process.execPath, ['scripts/generate-tutorials-content.mjs'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    expect(generated.map((f) => fs.readFileSync(f, 'utf8'))).toEqual(before);
  });

  it('garde la parité FR/EN sur les slugs', () => {
    const fr = getTutorials('fr').map((t) => t.slug).sort();
    const en = getTutorials('en').map((t) => t.slug).sort();
    expect(en).toEqual(fr);
  });

  it('garde le même ordre et le même rôle dans les deux langues', () => {
    for (const slug of EXPECTED_SLUGS) {
      const fr = getTutorial('fr', slug);
      const en = getTutorial('en', slug);
      expect(fr).not.toBeNull();
      expect(en).not.toBeNull();
      expect(en!.order).toBe(fr!.order);
      expect(en!.role).toBe(fr!.role);
      expect(en!.pages).toEqual(fr!.pages);
    }
  });

  it('aligne le nom de fichier et le slug du front matter', () => {
    for (const locale of LOCALES) {
      const dir = path.join(process.cwd(), 'content', 'tutorials', locale);
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
        const slug = file.replace(/\.mdx$/, '');
        expect(getTutorial(locale, slug)?.slug).toBe(slug);
      }
    }
  });
});

describe('tutoriels — contenu', () => {
  it('ne cite que les pages du registre', () => {
    const known = HELP_PAGES.map((p) => p.id);
    for (const locale of LOCALES) {
      for (const t of getTutorials(locale)) {
        for (const page of t.pages) expect(known).toContain(page);
        for (const page of t.body.match(/<GoTo page="([a-z-]+)"/g) ?? []) {
          const id = page.replace(/^<GoTo page="/, '').replace(/"$/, '');
          expect(isPageId(id)).toBe(true);
        }
      }
    }
  });

  it('contient au moins trois étapes numérotées et une section erreurs', () => {
    for (const locale of LOCALES) {
      for (const t of getTutorials(locale)) {
        expect(countSteps(t.body)).toBeGreaterThanOrEqual(3);
        expect(t.headings.length).toBeGreaterThanOrEqual(3);
        expect(t.body).toMatch(/<GoTo page="/);
      }
    }
  });

  it('respecte le vocabulaire imposé', () => {
    for (const locale of LOCALES) {
      for (const t of getTutorials(locale)) {
        const haystack = `${t.title} ${t.summary} ${t.body}`;
        for (const banned of BANNED) expect(haystack).not.toMatch(banned);
      }
    }
  });

  it('ne référence que des captures sous /tutorials/<slug>/', () => {
    for (const locale of LOCALES) {
      for (const t of getTutorials(locale)) {
        for (const m of t.body.match(/src="([^"]+)"/g) ?? []) {
          const src = m.slice(5, -1);
          expect(src.startsWith(`/tutorials/${t.slug}/`)).toBe(true);
        }
      }
    }
  });

  it('couvre les erreurs réelles imposées par la spec', () => {
    const fr = (slug: string) => getTutorial('fr', slug)!.plain;
    expect(normalize(fr('semaines-types'))).toContain('copier vers une offre');
    expect(normalize(fr('marketplace-publier-une-offre'))).toContain('sans wod ne se publie pas');
    expect(normalize(fr('visibilite-d-un-wod'))).toContain('personne encore');
    expect(normalize(fr('mouvements-et-badges'))).toContain('hors catalogue');
    expect(normalize(fr('marketplace-appliquer-au-whiteboard'))).toContain('realigne l');
  });

  it('couvre les règles imposées par le lot 2', () => {
    for (const locale of LOCALES) {
      const plain = (slug: string) => normalize(getTutorial(locale, slug)!.plain);
      // Une formule à 0 € n'est jamais publiée, sauf l'offre Essai.
      expect(plain('page-publique-de-la-box')).toMatch(/(0 ?€|€ ?0)/);
      expect(plain('page-publique-de-la-box')).toContain('essai');
      // Invitation nominative ≠ code d'invitation de la box.
      expect(plain('inviter-un-membre')).toContain('rejoindre/');
      expect(plain('inviter-un-membre')).toMatch(/(code d.invitation|invitation code)/);
    }
  });
});

describe('registre de pages', () => {
  it('associe chaque page à une route existante', () => {
    for (const page of HELP_PAGES) {
      expect(page.route.startsWith('/')).toBe(true);
      const segment = page.route === '/' ? 'page.tsx' : path.join(page.route.slice(1), 'page.tsx');
      expect(fs.existsSync(path.join(process.cwd(), 'app', '(dashboard)', segment))).toBe(true);
    }
  });

  it('retrouve la page depuis le pathname', () => {
    expect(pageIdForRoute('/')).toBe('dashboard');
    expect(pageIdForRoute('/wods')).toBe('whiteboard');
    expect(pageIdForRoute('/programming')).toBe('marketplace');
    expect(pageIdForRoute('/unknown')).toBeNull();
  });

  it('liste les tutoriels d’une page', () => {
    expect(getTutorialsForPage('fr', 'whiteboard').length).toBeGreaterThan(3);
    expect(getTutorialsForPage('fr', 'tournaments').map((t) => t.slug)).toEqual(['tournois']);
  });

  it('couvre par un tutoriel les pages du lot 2, et leur branche le bouton « ? »', () => {
    const pages = [
      'prospects',
      'invitations',
      'subscribers',
      'settings',
      'articles',
      'messages',
      'stats',
    ] as const;
    for (const id of pages) {
      expect(getTutorialsForPage('fr', id).length).toBeGreaterThan(0);
      expect(getTutorialsForPage('en', id).length).toBeGreaterThan(0);
      const route = HELP_PAGES.find((p) => p.id === id)!.route;
      const layout = path.join(process.cwd(), 'app', '(dashboard)', route.slice(1), 'layout.tsx');
      expect(fs.readFileSync(layout, 'utf8')).toContain(`HelpDockProvider page="${id}"`);
    }
  });
});

describe('recherche', () => {
  const index = buildIndex(getTutorialIndex('fr'));

  it('ignore les accents et la casse', () => {
    expect(normalize('Créneaux')).toBe('creneaux');
    expect(searchSlugs(index, 'CRENEAUX')).toContain('creneaux-et-reservations');
    expect(searchSlugs(index, 'créneaux')).toContain('creneaux-et-reservations');
  });

  it('trouve un tutoriel par son sujet', () => {
    expect(searchSlugs(index, 'badge')).toContain('mouvements-et-badges');
    expect(searchSlugs(index, 'semaine type')).toContain('semaines-types');
  });

  it('trouve les tutoriels du lot 2 par les mots des owners', () => {
    const first = (q: string) => searchSlugs(index, q)[0];
    const essai = searchSlugs(index, 'essai');
    expect(essai.indexOf('essai-gratuit-et-reservation')).toBeGreaterThanOrEqual(0);
    expect(essai.indexOf('essai-gratuit-et-reservation')).toBeLessThan(
      essai.indexOf('prospects-et-conversion'),
    );
    expect(first('drop-in')).toBe('formules-d-acces-a-la-salle');
    // « formule » remonte aussi le tutoriel Membres, qui parle des mêmes objets.
    expect(searchSlugs(index, 'formule').slice(0, 3)).toContain('formules-d-acces-a-la-salle');
    expect(first('rejoindre')).toBe('inviter-un-membre');
    // La résiliation se lit des deux côtés : l'athlète la demande, la box la traite.
    expect(searchSlugs(index, 'résiliation').slice(0, 2)).toContain(
      'abonnement-en-ligne-et-compte-athlete',
    );
  });

  it('rend une liste vide sur une requête sans rapport', () => {
    expect(searchSlugs(index, 'zzzzzzzz')).toEqual([]);
  });

  it('filtre par rôle sans masquer les tutoriels communs', () => {
    expect(matchesRole('both', 'owner')).toBe(true);
    expect(matchesRole('coach', 'owner')).toBe(false);
    expect(matchesRole('owner', 'all')).toBe(true);
  });
});

describe('navigation', () => {
  it('chaîne les tutoriels par ordre croissant', () => {
    expect(neighbours('fr', 'premiers-pas').previous).toBeNull();
    expect(neighbours('fr', 'premiers-pas').next?.slug).toBe('creer-un-wod');
    expect(neighbours('fr', 'tournois').next?.slug).toBe('parcours-d-un-nouveau-membre');
    expect(neighbours('fr', 'reglages-de-la-box').next).toBeNull();
  });

  it('rend null sur un slug inconnu', () => {
    expect(getTutorial('fr', 'inconnu')).toBeNull();
  });
});

describe('texte', () => {
  it('nettoie le MDX pour l’index de recherche', () => {
    const plain = toPlainText('## Titre\n\n1. Clique **Publier** <GoTo page="whiteboard" />\n');
    expect(plain).toContain('Clique Publier');
    expect(plain).not.toContain('<GoTo');
    expect(plain).not.toContain('**');
  });
});
