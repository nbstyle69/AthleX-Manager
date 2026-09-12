import fs from 'fs';
import path from 'path';
import {
  COACH_ROUTE_SEGMENTS,
  COACH_ROUTE_LABELS,
  coachPerimeterSentence,
} from '@/lib/authz/coach-perimeter';

/**
 * Contrôle mécanique des rubriques quasi homonymes : Marketplace regroupe le
 * catalogue box→box (`/programming`), les offres publiées (`/programming/offers`)
 * et les « Programmes athlètes » vendus aux membres (`/programming/athletes`) ;
 * les formules d'accès vivent à part sous « Formules » (`/plans`). Les libellés
 * doivent rester d'accord entre la barre latérale, les onglets et les titres.
 *
 * Sans ce contrôle, la famille du « Back-Office » orphelin recommence : un
 * libellé revient à l'ancien nom dans une seule surface, et plus rien ne le dit.
 */
const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

/** Tous les fichiers source sous `dir`, récursivement. */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

const SIDEBAR = read('components', 'layout', 'Sidebar.tsx');

/** Libellés déclarés dans la barre latérale, lus depuis le disque. */
function sidebarLabels(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /href:\s*'([^']+)',\s*label:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SIDEBAR)) !== null) out.set(m[1], m[2]);
  return out;
}

const EXPECTED = {
  '/programming': { label: 'Marketplace', title: 'Marketplace' },
  '/plans': { label: 'Formules', title: 'Formules' },
} as const;

const MARKETPLACE_SHELL = read('components', 'marketplace', 'MarketplaceShell.tsx');

describe('libellés des deux rubriques de programmation', () => {
  const labels = sidebarLabels();
  let checked = 0;

  it('lit bien la barre latérale', () => {
    expect(labels.size).toBeGreaterThan(10);
  });

  it.each(Object.entries(EXPECTED))('%s porte son libellé dans la barre latérale', (href, exp) => {
    checked += 1;
    expect(labels.get(href)).toBe(exp.label);
  });

  it('le titre et les onglets de la Marketplace nomment les trois circuits', () => {
    expect(MARKETPLACE_SHELL).toContain(`>${EXPECTED['/programming'].title}</h1>`);
    for (const [href, label] of [
      ['/programming', 'Catalogue'],
      ['/programming/offers', 'Mes offres'],
      ['/programming/athletes', 'Programmes athlètes'],
    ] as const) {
      expect(MARKETPLACE_SHELL).toContain(`href: '${href}'`);
      expect(MARKETPLACE_SHELL).toContain(`label: '${label}'`);
    }
  });

  it('les trois onglets ont chacun une route adressable', () => {
    for (const segments of [
      ['programming'],
      ['programming', 'offers'],
      ['programming', 'athletes'],
    ]) {
      const page = read('app', '(dashboard)', ...segments, 'page.tsx');
      expect(page).toContain('MarketplaceShell');
    }
  });

  it('le titre et le sous-titre des Programmes athlètes nomment les membres', () => {
    const workspace = read('components', 'programs', 'AthleteProgramsWorkspace.tsx');
    expect(workspace).toContain('>Programmes athlètes</h2>');
    expect(workspace).toContain('Offres vendues ou assignées à tes membres');
  });

  it('les formules et les codes promo ont quitté la Marketplace pour /plans', () => {
    const workspace = read('components', 'programs', 'AthleteProgramsWorkspace.tsx');
    expect(workspace).not.toContain('membership_plans');
    expect(workspace).not.toContain('promo-codes');
    const plans = read('components', 'plans', 'PlansWorkspace.tsx');
    expect(plans).toContain('MembershipPlansSection');
    expect(plans).toContain('PromoCodesSection');
  });

  it('la section Pilotage ne porte plus que les Statistiques', () => {
    expect(SIDEBAR).toContain("label: 'Pilotage'");
    expect(SIDEBAR).not.toContain("label: 'Business'");
    expect(labels.has('/programs')).toBe(false);
  });

  it('aucune entrée de la barre latérale ne s’appelle encore « Programmation »', () => {
    expect([...labels.values()]).not.toContain('Programmation');
    expect([...labels.values()]).not.toContain('Offres & Programmes');
  });

  it('le texte d’aide qui envoie vers la marketplace ne cite plus l’ancien nom', () => {
    const modal = read('components', 'wods', 'ApplyProgramWeekModal.tsx');
    expect(modal).toContain('Entraînement → Marketplace');
    expect(modal).not.toContain('Entraînement → Programmation');
  });

  it('la page publique de box garde « Programmes » côté athlète', () => {
    // C'est le nom que voit l'acheteur : il ne suit pas le renommage interne.
    const t = read('lib', 'translations.ts');
    expect(t).toContain("programming: 'Programmes',");
    expect(t).toContain("programming: 'Programs',");
    expect(t).not.toContain("programming: 'Programmation',");
  });

  it('la console plateforme nomme aussi la table des offres athlète', () => {
    // Même table, même objet : le titre interne suit le renommage.
    const page = read('app', 'admin', 'programs', 'page.tsx');
    expect(page).toContain('>Programmes athlètes</h1>');
    expect(page).not.toContain('>Programmation</h1>');
  });

  it('a bien examiné les deux rubriques', () => {
    expect(checked).toBe(Object.keys(EXPECTED).length);
  });
});

describe('phrase de refus coach', () => {
  it('énumère exactement le périmètre, y compris les Créneaux types et l’Aide', () => {
    expect(coachPerimeterSentence()).toBe(
      'Whiteboard, Horaires, Créneaux types, Messages et Aide',
    );
  });

  it('la page de refus dérive la phrase du périmètre au lieu de la recopier', () => {
    const forbidden = read('app', 'forbidden.tsx');
    expect(forbidden).toContain('coachPerimeterSentence()');
    expect(forbidden).not.toMatch(/aux Horaires et aux Messages/);
  });

  it('la page /templates porte le nom que la barre latérale annonce', () => {
    // Deux noms pour la même page (« Créneaux types » dans la barre, « Modèle
    // de semaine » en titre) : le gérant cherche une rubrique qui n'existe pas.
    const page = read('app', '(dashboard)', 'templates', 'page.tsx');
    expect(page).toContain(`>${COACH_ROUTE_LABELS.templates}</h1>`);
  });

  it('aucune surface du back-office n’appelle encore la grille « Modèle de semaine »', () => {
    // Énumération depuis le disque : le titre n'était qu'une des deux surfaces
    // (le bouton d'Horaires qui ouvre la même grille portait l'autre nom).
    const fautifs = walk(path.join(ROOT, 'app'))
      .concat(walk(path.join(ROOT, 'components')))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('Modèle de semaine'))
      .map((f) => path.relative(ROOT, f));
    expect(fautifs).toEqual([]);
  });

  it('la barre latérale et la phrase de refus lisent les mêmes libellés', () => {
    const labels = sidebarLabels();
    for (const segment of COACH_ROUTE_SEGMENTS) {
      expect(labels.get(`/${segment}`)).toBe(COACH_ROUTE_LABELS[segment]);
    }
  });
});
