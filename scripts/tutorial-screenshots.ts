/**
 * Captures d'écran des tutoriels de l'onglet Aide.
 *
 * Une seule série, en français, partagée par les tutoriels FR et EN : les
 * fichiers sont écrits dans `public/tutorials/<slug>/<n>.png`, exactement les
 * chemins référencés par `<Screenshot src="…" />`. Tant qu'un fichier manque,
 * le composant rend un cadre neutre — jamais d'image cassée.
 *
 * Usage :
 *   BASE_URL=https://<preview>.vercel.app \
 *   DEMO_EMAIL=… DEMO_PASSWORD=… \
 *   npx tsx scripts/tutorial-screenshots.ts [slug…]
 *
 * Variables :
 *   BASE_URL       URL de la preview (ou http://localhost:3000).
 *   DEMO_EMAIL     Gérant de la box de démonstration (AthleX Fitness).
 *   DEMO_PASSWORD  Son mot de passe. Jamais écrit sur disque ni journalisé.
 *   CDP_URL        Optionnel : navigateur déjà lancé (ex. http://localhost:29229).
 *
 * Règles tenues par le script :
 *   - aucune écriture dans la box : les formulaires sont remplis puis fermés
 *     sans enregistrer (`Échap`), rien n'est créé ni supprimé ;
 *   - une seule box, celle de démonstration : le script refuse de continuer si
 *     la box active n'est pas celle attendue (`DEMO_BOX`) ;
 *   - viewport 1440×900, interface en français (cookie `athlex_lang`) ;
 *   - capture de la zone utile (sélecteur `area`) plutôt que de l'écran entier,
 *     ce qui garde les e-mails, montants et adresses d'administration hors
 *     cadre. Les échecs n'interrompent pas la série : le rapport final liste
 *     les captures manquantes.
 */

import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? '';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? '';
const DEMO_BOX = process.env.DEMO_BOX ?? 'AthleX Fitness';
const CDP_URL = process.env.CDP_URL ?? '';
const OUT = path.join(process.cwd(), 'public', 'tutorials');

const VIEWPORT = { width: 1440, height: 900 };

interface Shot {
  /** Slug du tutoriel : décide du dossier de sortie. */
  slug: string;
  /** Numéro de la capture dans le tutoriel. */
  n: number;
  /** Route à ouvrir avant la capture. */
  route: string;
  /** Zone capturée. Absent = viewport entier. */
  area?: string;
  /** Amène la page dans l'état voulu (ouvrir une modale, etc.). */
  prepare?: (page: Page) => Promise<void>;
  /** Remet la page dans son état initial (aucune donnée laissée derrière). */
  cleanup?: (page: Page) => Promise<void>;
}

const MAIN = 'main';

/** Ferme une modale sans enregistrer : rien ne doit rester dans la box. */
const escape = async (page: Page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};

const click = (label: string | RegExp) => async (page: Page) => {
  await page.getByRole('button', { name: label }).first().click();
  await page.waitForTimeout(1200);
};

const SHOTS: Shot[] = [
  { slug: 'premiers-pas', n: 1, route: '/', area: MAIN },
  { slug: 'creer-un-wod', n: 1, route: '/wods', area: MAIN },
  {
    slug: 'creer-un-wod',
    n: 2,
    route: '/wods',
    prepare: click(/Nouveau WOD/i),
    cleanup: escape,
    area: '[role="dialog"]',
  },
  {
    slug: 'visibilite-d-un-wod',
    n: 1,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Qui reçoit ce WOD/i).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: '[role="dialog"]',
  },
  {
    slug: 'blocs-force-musculation-cardio',
    n: 1,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Musculation/i).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: '[role="dialog"]',
  },
  { slug: 'mouvements-et-badges', n: 1, route: '/wods', area: MAIN },
  { slug: 'importer-un-pdf-de-programmation', n: 1, route: '/wods', area: MAIN },
  {
    slug: 'semaines-types',
    n: 1,
    route: '/wods',
    prepare: click(/Enregistrer comme semaine type/i),
    cleanup: escape,
    area: '[role="dialog"]',
  },
  { slug: 'groupes-de-membres', n: 1, route: '/groups', area: MAIN },
  { slug: 'membres-et-formules', n: 1, route: '/members', area: MAIN },
  { slug: 'creneaux-et-reservations', n: 1, route: '/schedules', area: MAIN },
  { slug: 'programmes-athletes-seances', n: 1, route: '/programs', area: MAIN },
  { slug: 'programmes-athletes-vente', n: 1, route: '/programs', area: MAIN },
  { slug: 'marketplace-s-abonner-a-une-programmation', n: 1, route: '/programming', area: MAIN },
  { slug: 'marketplace-publier-une-offre', n: 1, route: '/programming', area: MAIN },
  {
    slug: 'marketplace-appliquer-au-whiteboard',
    n: 1,
    route: '/wods',
    prepare: click(/^Programmation$/i),
    cleanup: escape,
    area: '[role="dialog"]',
  },
  { slug: 'tournois', n: 1, route: '/tournaments', area: MAIN },
];

async function openBrowser(): Promise<Browser> {
  if (CDP_URL) return chromium.connectOverCDP(CDP_URL);
  return chromium.launch();
}

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/login/box`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 30_000 });
}

/** Garde-fou : on ne photographie que la box de démonstration. */
async function assertDemoBox(page: Page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  if (!body.includes(DEMO_BOX)) {
    throw new Error(
      `La box active n'est pas « ${DEMO_BOX} » : le script s'arrête plutôt que de photographier une vraie box.`,
    );
  }
}

async function capture(page: Page, shot: Shot): Promise<void> {
  await page.goto(`${BASE_URL}${shot.route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  if (shot.prepare) await shot.prepare(page);

  const dir = path.join(OUT, shot.slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${shot.n}.png`);

  const target = shot.area ? page.locator(shot.area).first() : null;
  if (target) await target.screenshot({ path: file });
  else await page.screenshot({ path: file });

  if (shot.cleanup) await shot.cleanup(page);
}

async function main() {
  if (!DEMO_EMAIL || !DEMO_PASSWORD) {
    throw new Error('DEMO_EMAIL et DEMO_PASSWORD sont requis.');
  }
  const only = process.argv.slice(2);
  const wanted = only.length ? SHOTS.filter((s) => only.includes(s.slug)) : SHOTS;

  const browser = await openBrowser();
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'fr-FR' });
  await context.addCookies([
    { name: 'athlex_lang', value: 'fr', url: BASE_URL },
  ]);
  const page = await context.newPage();

  const failed: string[] = [];
  try {
    await signIn(page);
    await assertDemoBox(page);

    for (const shot of wanted) {
      const id = `${shot.slug}/${shot.n}.png`;
      try {
        await capture(page, shot);
        console.log(`ok   ${id}`);
      } catch (err) {
        failed.push(id);
        console.log(`échec ${id} — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${wanted.length - failed.length}/${wanted.length} captures écrites dans public/tutorials/`);
  if (failed.length) {
    console.log(`manquantes (cadre neutre affiché) : ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
