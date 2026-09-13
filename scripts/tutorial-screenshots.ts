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
import { chromium, type Browser, type Locator, type Page } from 'playwright';

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
  /** Route connue seulement à l'exécution (jeton d'invitation, par exemple). */
  routeFn?: () => string;
  /** Capture hors session : la page publique vue par un visiteur. */
  anon?: boolean;
  /** Zone capturée. Absent = viewport entier. */
  area?: string | ((page: Page) => Locator);
  /** Amène la page dans l'état voulu (ouvrir une modale, etc.). */
  prepare?: (page: Page) => Promise<void>;
  /** Remet la page dans son état initial (aucune donnée laissée derrière). */
  cleanup?: (page: Page) => Promise<void>;
}

/**
 * Invitation jetable : elle sert aux captures du lien d'invitation et de
 * `/rejoindre`, puis elle est révoquée avant la fin du script.
 */
const INVITE_PREFIX = 'zz-invitation-capture';
const INVITE_EMAIL = `${INVITE_PREFIX}-${Date.now()}@exemple.fr`;
let inviteToken = '';

/** Panneau des modales du Manager : un overlay plein écran et son unique enfant. */
const MODAL = '.fixed.inset-0.z-50 > div';

/** Les modales des pages publiques (essai, souscription) montent plus haut. */
const PUBLIC_MODAL = '.fixed.inset-0.z-\\[100\\] > div';

/** Ferme une modale sans enregistrer : rien ne doit rester dans la box. */
const escape = async (page: Page) => {
  await page.keyboard.press('Escape');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
};

const click = (label: string | RegExp) => async (page: Page) => {
  await page.getByRole('button', { name: label }).first().click();
  await page.waitForTimeout(1200);
};

/**
 * Une section du Manager : le titre et la carte `rounded-2xl` qui le porte.
 * Capturer la section plutôt que l'écran entier garde le cadre lisible sur les
 * pages longues (Réglages, Statistiques).
 */
const section = (label: RegExp) => (page: Page) =>
  page
    .getByText(label)
    .first()
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');

/** Amène un titre au centre du viewport avant la capture de sa section. */
const scrollTo = (label: RegExp) => async (page: Page) => {
  const text = page.getByText(label).first();
  // Les titres des pages publiques portent une icône : leur nœud texte n'est
  // pas atteignable par getByText, on retombe alors sur le rôle « heading ».
  const target = (await text.count()) > 0 ? text : page.getByRole('heading', { name: label }).first();
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  await page.waitForTimeout(500);
};

const SHOTS: Shot[] = [
  { slug: 'premiers-pas', n: 1, route: '/' },
  { slug: 'creer-un-wod', n: 1, route: '/wods' },
  {
    slug: 'creer-un-wod',
    n: 2,
    route: '/wods',
    prepare: click(/Nouveau WOD/i),
    cleanup: escape,
    area: MODAL,
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
    area: (page) =>
      page.getByText(/Qui reçoit ce WOD/i).first().locator('xpath=ancestor::div[1]'),
  },
  {
    slug: 'blocs-force-musculation-cardio',
    n: 1,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      // La modale défile dans sa propre boîte : sans scroll forcé, la capture
      // s'arrête avant les séries de musculation et de cardio.
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 500;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'blocs-force-musculation-cardio',
    n: 2,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 900;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'creneaux-et-reservations',
    n: 4,
    route: '/schedules',
    prepare: click(/Nouveau créneau/i),
    cleanup: escape,
    area: MODAL,
  },
  { slug: 'essai-gratuit-et-reservation', n: 5, route: '/prospects' },
  {
    slug: 'mouvements-et-badges',
    n: 1,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await click(/Ajouter un mouvement/i)(page);
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: MODAL,
  },
  // « Importer » est un label sur un input fichier caché : le cliquer ouvrirait
  // le sélecteur de fichiers de l'OS, donc on capture la barre d'outils.
  {
    slug: 'importer-un-pdf-de-programmation',
    n: 1,
    route: '/wods',
    area: (page) =>
      page.getByText(/Template CSV/i).first().locator('xpath=ancestor::div[1]'),
  },
  {
    slug: 'semaines-types',
    n: 1,
    route: '/wods',
    prepare: click(/Enregistrer comme semaine type/i),
    cleanup: escape,
    area: MODAL,
  },
  { slug: 'groupes-de-membres', n: 1, route: '/groups' },
  { slug: 'membres-et-formules', n: 1, route: '/members' },
  { slug: 'creneaux-et-reservations', n: 1, route: '/schedules' },
  { slug: 'programmes-athletes-seances', n: 1, route: '/programming/athletes' },
  {
    slug: 'programmes-athletes-vente',
    n: 1,
    route: '/programming/athletes',
    prepare: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(400);
    },
  },
  // `marketplace-s-abonner-a-une-programmation/1-3.png` et
  // `marketplace-appliquer-au-whiteboard/1.png` viennent de captures fournies
  // par le gérant sur une box abonnée : AthleX Fitness n'a aucun abonnement
  // Marketplace, et s'abonner depuis la démo laisserait une trace. Le script
  // ne les régénère donc pas — il ne doit pas les écraser.
  {
    slug: 'marketplace-publier-une-offre',
    n: 1,
    route: '/programming/offers',
    // Publier une vraie offre polluerait le catalogue public des autres box :
    // on montre le formulaire de création, jamais une offre publiée.
    prepare: async (page) => {
      await click(/Nouvelle programmation/i)(page);
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: MODAL,
  },
  { slug: 'tournois', n: 1, route: '/tournaments' },
  {
    slug: 'tournois',
    n: 2,
    route: '/tournaments/new',
  },

  // ---------------------------------------------------------------------------
  // Écrans manquants du lot 1 : chaque étape qui désigne un écran, un bouton ou
  // une modale a sa capture. Les fichiers sont réutilisés d'un tutoriel à
  // l'autre quand c'est le même écran (cf. inventaire dans la PR).
  // ---------------------------------------------------------------------------
  {
    slug: 'premiers-pas',
    n: 2,
    route: '/settings',
    prepare: scrollTo(/Informations de la box/),
    area: section(/Informations de la box/),
  },
  { slug: 'groupes-de-membres', n: 2, route: '/members' },
  {
    slug: 'premiers-pas',
    n: 4,
    route: '/support',
    // Le formulaire de demande est un panneau en place, pas une modale.
    prepare: click(/Nouvelle demande/i),
    cleanup: click(/^Annuler$/),
    area: (page) =>
      page
        .getByPlaceholder('Titre de la demande')
        .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]'),
  },
  {
    slug: 'creer-un-wod',
    n: 3,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 260;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'creneaux-et-reservations',
    n: 2,
    route: '/templates',
  },
  {
    slug: 'creneaux-et-reservations',
    n: 3,
    route: '/templates',
    prepare: click(/Nouveau créneau type/i),
    cleanup: escape,
    area: MODAL,
  },
  { slug: 'membres-et-formules', n: 2, route: '/plans' },
  {
    slug: 'programmes-athletes-vente',
    n: 2,
    route: '/programming/athletes',
    prepare: click(/Créer un programme/i),
    cleanup: escape,
    area: MODAL,
  },

  // ---------------------------------------------------------------------------
  // Lot 2 : acquisition, page publique, parcours membre, facturation.
  // ---------------------------------------------------------------------------
  {
    slug: 'page-publique-de-la-box',
    n: 1,
    route: '/settings',
    prepare: scrollTo(/^Page publique$/),
    area: section(/^Page publique$/),
  },
  {
    slug: 'reglages-de-la-box',
    n: 1,
    route: '/settings',
    prepare: scrollTo(/^Page publique$/),
    area: section(/^Page publique$/),
  },
  { slug: 'page-publique-de-la-box', n: 2, route: '/box/athlex-fitness', anon: true },
  {
    slug: 'reglages-de-la-box',
    n: 2,
    route: '/settings',
    prepare: scrollTo(/^Paiements$/),
    area: section(/^Paiements$/),
  },
  {
    slug: 'reglages-de-la-box',
    n: 3,
    route: '/settings',
    prepare: scrollTo(/Logo de la box/),
    area: section(/Logo de la box/),
  },
  {
    slug: 'reglages-de-la-box',
    n: 4,
    route: '/settings',
    prepare: scrollTo(/Conditions générales \(PDF\)/),
    area: section(/Conditions générales \(PDF\)/),
  },
  {
    slug: 'reglages-de-la-box',
    n: 5,
    route: '/settings',
    prepare: scrollTo(/Notifications/),
    area: section(/Notifications/),
  },
  {
    slug: 'reglages-de-la-box',
    n: 6,
    route: '/settings',
    prepare: scrollTo(/Mes données/),
    area: section(/Mes données/),
  },
  {
    slug: 'formules-d-acces-a-la-salle',
    n: 1,
    route: '/plans',
    prepare: click(/Créer une offre/i),
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'formules-d-acces-a-la-salle',
    n: 2,
    route: '/plans',
    prepare: async (page) => {
      await click(/Créer une offre/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 400;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'formules-d-acces-a-la-salle',
    n: 3,
    route: '/plans',
    prepare: scrollTo(/^Codes promo$/),
  },
  // Un type d'offre par capture : le formulaire change de champs selon le type.
  // Abonnement n'y figure pas : c'est le type sélectionné par défaut, déjà
  // montré par les captures 1 et 2.
  ...([
    [4, /Drop-in/],
    [5, /N séances \/ X mois/],
    [6, /Gratuit · 1 séance découverte/],
  ] as const).map(([n, type]) => ({
    slug: 'formules-d-acces-a-la-salle',
    n,
    route: '/plans',
    prepare: async (page: Page) => {
      await click(/Créer une offre/i)(page);
      await page.getByRole('button', { name: type }).first().click();
      await page.waitForTimeout(600);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 150;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  })),
  {
    slug: 'essai-gratuit-et-reservation',
    n: 1,
    route: '/plans',
    prepare: async (page) => {
      await click(/Créer une offre/i)(page);
      await page.getByRole('button', { name: /Gratuit · 1 séance découverte/ }).first().click();
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'essai-gratuit-et-reservation',
    n: 2,
    route: '/box/athlex-fitness',
    anon: true,
    prepare: scrollTo(/Séance d'essai/),
  },
  {
    slug: 'essai-gratuit-et-reservation',
    n: 3,
    route: '/box/athlex-fitness',
    anon: true,
    // Le tunnel n'écrit rien avant « Confirmer ma réservation » : on s'arrête au
    // choix du créneau, avec une identité jetable, et on ferme la fenêtre.
    prepare: async (page) => {
      await click(/Réserver mon essai/)(page);
      const modal = page.locator(PUBLIC_MODAL).first();
      await modal.locator('input').nth(0).fill('Zoé');
      await modal.locator('input').nth(1).fill('Martin');
      await modal.locator('input[type="email"]').first().fill('zz-essai@exemple.fr');
      await click(/Voir les cours|Choisir un cours|Continuer/)(page);
      await page.waitForTimeout(1500);
    },
    cleanup: escape,
    area: PUBLIC_MODAL,
  },
  { slug: 'prospects-et-conversion', n: 1, route: '/prospects' },
  {
    slug: 'prospects-et-conversion',
    n: 2,
    route: '/prospects',
    prepare: click(/^Adhérents/),
  },
  {
    slug: 'prospects-et-conversion',
    n: 3,
    route: '/prospects',
    prepare: click(/Créneaux RDV/),
  },
  { slug: 'inviter-un-membre', n: 1, route: '/invitations' },
  {
    // L'invitation de test est créée ici, sert aussi à la capture de /rejoindre,
    // puis est révoquée à la capture suivante : rien ne reste dans la démo.
    slug: 'inviter-un-membre',
    n: 2,
    route: '/invitations',
    prepare: async (page) => {
      await page.getByPlaceholder('Prénom').fill('Zoé');
      await page.getByPlaceholder('Nom', { exact: true }).fill('Test');
      await page.getByPlaceholder('E-mail').fill(INVITE_EMAIL);
      await page.getByRole('button', { name: /Créer l.invitation/ }).click();
      await page.waitForTimeout(3000);
      // Le lien n'est affiché qu'une fois, dans un champ en lecture seule.
      const url = await page.locator(MODAL).first().locator('input[readonly]').first().inputValue();
      inviteToken = url.trim().split('/rejoindre/')[1] ?? '';
    },
    area: MODAL,
  },
  {
    slug: 'inviter-un-membre',
    n: 3,
    route: '/rejoindre',
    routeFn: () => {
      if (!inviteToken) throw new Error("jeton d'invitation indisponible");
      return `/rejoindre/${inviteToken}`;
    },
    anon: true,
  },
  {
    slug: 'premiers-pas',
    n: 5,
    route: '/settings',
    prepare: scrollTo(/^Coachs$/),
    area: section(/^Coachs$/),
  },
  {
    slug: 'premiers-pas',
    n: 6,
    route: '/',
    prepare: scrollTo(/Code d.invitation box/),
    area: section(/Code d.invitation box/),
  },
  { slug: 'premiers-pas', n: 7, route: '/groups' },
  {
    slug: 'creer-un-wod',
    n: 4,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Qui reçoit ce WOD/i).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'membres-et-formules',
    n: 3,
    route: '/members',
    prepare: click(/^Contrats$/),
  },
  {
    slug: 'semaines-types',
    n: 2,
    route: '/wods',
    prepare: click(/^Programmation$/i),
    cleanup: escape,
    area: MODAL,
  },
  { slug: 'parcours-d-un-nouveau-membre', n: 1, route: '/box/athlex-fitness', anon: true },
  { slug: 'parcours-d-un-nouveau-membre', n: 2, route: '/invitations' },
  {
    slug: 'parcours-d-un-nouveau-membre',
    n: 3,
    route: '/box/athlex-fitness',
    anon: true,
    prepare: scrollTo(/^Abonnements$/),
  },
  {
    slug: 'parcours-d-un-nouveau-membre',
    n: 4,
    route: '/',
    prepare: scrollTo(/Code d.invitation box/),
    area: section(/Code d.invitation box/),
  },
  {
    slug: 'page-publique-de-la-box',
    n: 3,
    route: '/settings',
    prepare: scrollTo(/Logo de la box/),
    area: section(/Logo de la box/),
  },
  {
    slug: 'page-publique-de-la-box',
    n: 4,
    route: '/settings',
    prepare: scrollTo(/Informations de la box/),
    area: section(/Informations de la box/),
  },
  {
    slug: 'page-publique-de-la-box',
    n: 5,
    route: '/settings',
    prepare: scrollTo(/Conditions générales \(PDF\)/),
    area: section(/Conditions générales \(PDF\)/),
  },
  { slug: 'essai-gratuit-et-reservation', n: 4, route: '/schedules' },
  {
    slug: 'abonnes-et-facturation',
    n: 2,
    route: '/subscribers',
    prepare: async (page) => {
      await page.getByRole('button', { name: /Encaissement reçu/ }).first().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -200));
      await page.waitForTimeout(500);
    },
  },
  {
    slug: 'statistiques',
    n: 4,
    route: '/stats',
    prepare: scrollTo(/Total membres/),
  },
  {
    slug: 'reglages-de-la-box',
    n: 7,
    route: '/settings',
    prepare: scrollTo(/délai avant suspension/),
    area: section(/délai avant suspension/),
  },
  {
    slug: 'abonnement-en-ligne-et-compte-athlete',
    n: 1,
    route: '/box/athlex-fitness',
    anon: true,
    prepare: scrollTo(/^Abonnements$/),
  },
  {
    slug: 'abonnement-en-ligne-et-compte-athlete',
    n: 3,
    route: '/box/athlex-fitness',
    anon: true,
    prepare: async (page) => {
      await page.getByRole('button', { name: /Changer de formule/ }).first().click();
      await page.waitForTimeout(1200);
    },
    cleanup: escape,
    area: PUBLIC_MODAL,
  },
  {
    slug: 'abonnement-en-ligne-et-compte-athlete',
    n: 2,
    route: '/box/athlex-fitness',
    anon: true,
    // Récapitulatif du contrat : la modale précède Stripe, rien n'est payé ni
    // écrit tant que « Payer par carte » n'est pas cliqué.
    prepare: async (page) => {
      await scrollTo(/^Abonnements$/)(page);
      await page.getByRole('button', { name: /abonner/i }).first().click();
      await page.waitForTimeout(1200);
    },
    cleanup: escape,
    area: PUBLIC_MODAL,
  },
  // Espace athlète du compte de démonstration : lecture seule, aucun achat.
  { slug: 'abonnement-en-ligne-et-compte-athlete', n: 4, route: '/compte' },
  { slug: 'abonnes-et-facturation', n: 1, route: '/subscribers' },

  {
    slug: 'actualites-et-messages',
    n: 1,
    route: '/articles',
    prepare: click(/Nouvel article/i),
    cleanup: escape,
    area: MODAL,
  },
  // « Envoyer une annonce » est un lien vers /messages/new, pas une modale.
  { slug: 'actualites-et-messages', n: 2, route: '/messages/new' },
  { slug: 'actualites-et-messages', n: 3, route: '/articles' },
  { slug: 'actualites-et-messages', n: 4, route: '/messages' },
  { slug: 'statistiques', n: 1, route: '/stats' },
  {
    slug: 'statistiques',
    n: 2,
    route: '/stats',
    prepare: scrollTo(/Réservations/),
  },
  {
    slug: 'statistiques',
    n: 3,
    route: '/stats',
    prepare: async (page) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);
    },
  },
  {
    slug: 'ce-que-voient-les-membres-dans-l-app',
    n: 1,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Qui reçoit ce WOD/i).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  { slug: 'ce-que-voient-les-membres-dans-l-app', n: 2, route: '/groups' },
  {
    slug: 'statistiques',
    n: 5,
    route: '/stats',
    prepare: scrollTo(/Impayés en cours/),
    area: (page) =>
      page.getByText(/Impayés en cours/).first().locator('xpath=ancestor::div[3]'),
  },
  {
    slug: 'statistiques',
    n: 6,
    route: '/stats',
    prepare: scrollTo(/Encaissé sur 6 mois/),
    area: section(/Encaissé sur 6 mois/),
  },
  {
    slug: 'statistiques',
    n: 7,
    route: '/stats',
    prepare: scrollTo(/Membres à risque/),
  },
  {
    slug: 'visibilite-d-un-wod',
    n: 2,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Qui reçoit ce WOD/i).first().scrollIntoViewIfNeeded();
      await page.getByText(/^Ces groupes$/).first().click();
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: (page) =>
      page.getByText(/Qui reçoit ce WOD/i).first().locator('xpath=ancestor::div[1]'),
  },
  {
    slug: 'visibilite-d-un-wod',
    n: 3,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Qui reçoit ce WOD/i).first().scrollIntoViewIfNeeded();
      await page.getByText(/^Personne encore$/).first().click();
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: (page) =>
      page.getByText(/Qui reçoit ce WOD/i).first().locator('xpath=ancestor::div[1]'),
  },
  {
    slug: 'blocs-force-musculation-cardio',
    n: 3,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 420;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'creer-un-wod',
    n: 5,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 1200;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'mouvements-et-badges',
    n: 2,
    route: '/wods',
    // Ligne de mouvement remplie : le WOD n'est jamais publié, la modale est
    // fermée par Échap.
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await click(/Ajouter un mouvement/i)(page);
      const exercise = page.locator('input[list="box-movement-catalog"]').first();
      const row = exercise.locator('xpath=ancestor::div[1]');
      await row.locator('input[inputmode="numeric"]').first().fill('21');
      await exercise.fill('Thruster');
      const loads = row.locator('input:not([inputmode="numeric"]):not([list])');
      if ((await loads.count()) > 1) {
        await loads.nth(0).fill('43');
        await loads.nth(1).fill('30');
      }
      await page.waitForTimeout(800);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'semaines-types',
    n: 3,
    route: '/wods',
  },
  {
    slug: 'membres-et-formules',
    n: 4,
    route: '/members',
    prepare: click(/^Filtres$/),
  },
  {
    slug: 'inviter-un-membre',
    n: 4,
    route: '/invitations',
    prepare: scrollTo(/Formule/i),
  },
  {
    slug: 'reglages-de-la-box',
    n: 8,
    route: '/settings',
    prepare: scrollTo(/Informations de la box/),
    area: section(/Informations de la box/),
  },
  {
    slug: 'visibilite-d-un-wod',
    n: 4,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await page.getByText(/Qui reçoit ce WOD/i).first().scrollIntoViewIfNeeded();
      await page.getByText(/^Toute la box$/).first().click();
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: (page) =>
      page.getByText(/Qui reçoit ce WOD/i).first().locator('xpath=ancestor::div[1]'),
  },
  {
    slug: 'visibilite-d-un-wod',
    n: 5,
    route: '/wods',
    // Badge d'audience tel qu'il apparaît sur la carte du Whiteboard.
    area: (page) =>
      page
        .getByText(/Visible par toute la box/)
        .first()
        .locator('xpath=ancestor::div[5]'),
  },
  {
    slug: 'blocs-force-musculation-cardio',
    n: 4,
    route: '/wods',
    prepare: async (page) => {
      await click(/Nouveau WOD/i)(page);
      await click(/Ajouter une série cardio/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 900;
      });
      await page.waitForTimeout(600);
    },
    cleanup: escape,
    area: MODAL,
  },
  // Pas de capture pour les icônes d'un créneau type : la grille de la démo
  // est vide et créer un créneau type générerait des cours dans le planning.
  // La modale « Nouveau programme » tient dans un écran : une seule capture
  // (2.png) couvre titre, prix, type, durée et la case « Actif ».
  {
    slug: 'formules-d-acces-a-la-salle',
    n: 7,
    route: '/plans',
    // Champs propres au type Abonnement (prix mensuel, séances/semaine,
    // engagement), sélectionné par défaut.
    prepare: async (page) => {
      await click(/Créer une offre/i)(page);
      await page.locator(MODAL).first().evaluate((el) => {
        el.scrollTop = 200;
      });
      await page.waitForTimeout(400);
    },
    cleanup: escape,
    area: MODAL,
  },
  {
    slug: 'inviter-un-membre',
    n: 5,
    route: '/invitations',
    // Formulaire Nouvelle invitation avec le mode « Paiement Stripe » choisi :
    // aucune invitation n'est créée, le formulaire n'est pas soumis.
    prepare: async (page) => {
      await page
        .locator('button:visible')
        .filter({ hasText: /Paiement Stripe/i })
        .first()
        .click();
      await page.waitForTimeout(600);
    },
    area: (page) =>
      page
        .getByRole('heading', { name: /Nouvelle invitation/i })
        .first()
        .locator('xpath=ancestor::div[1]'),
  },
  // Pas de capture pour la fiche d'un membre : sur la démo, les panneaux
  // « Records 1RM » et « Séries réalisées » sont vides faute de journal
  // d'entraînement, la capture ne montrerait rien d'utile.
  {
    slug: 'groupes-de-membres',
    n: 3,
    route: '/groups',
    // Détail du groupe : liste des membres et bloc « Ajouter des membres ».
    prepare: async (page) => {
      await page.getByText(/Compétiteurs/).first().click();
      await page.waitForTimeout(1500);
      await page.getByText(/AJOUTER DES MEMBRES/i).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
    area: (page) =>
      page
        .getByText(/AJOUTER DES MEMBRES/i)
        .first()
        .locator('xpath=ancestor::div[2]'),
  },
];

async function openBrowser(): Promise<Browser> {
  if (CDP_URL) return chromium.connectOverCDP(CDP_URL);
  return chromium.launch();
}

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/login/box`, { waitUntil: 'networkidle' });
  // Sans hydratation, le clic déclenche l'envoi natif du formulaire (GET) et
  // la page se recharge sans jamais appeler Supabase.
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return !!form && Object.keys(form).some((k) => k.startsWith('__react'));
  }, undefined, { timeout: 30_000 });
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

/**
 * Neutralise ce qui ne doit pas finir dans une capture publique : l'adresse du
 * gérant, le code d'invitation de la box et l'origine de capture (une preview
 * ou un poste local n'a rien à faire dans un tutoriel). Applique aussi la
 * charte de vocabulaire aux textes saisis dans la démo (Functional / Hybrid).
 */
async function anonymize(page: Page): Promise<void> {
  await page.evaluate((origin) => {
    // Charte de vocabulaire appliquée par remplacement direct : une fonction
    // déclarée ici reçoit un helper `__name` de tsx, inconnu du navigateur.
    const banned: [RegExp, string][] = [
      [/cross\s*fit/gi, 'Functional'],
      [/hyrox/gi, 'Hybrid'],
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const email = /[\w.+-]+@[\w-]+\.[\w.]+/g;
    let node: Node | null = walker.nextNode();
    while (node) {
      const text = node.nodeValue ?? '';
      let next = text;
      if (email.test(next)) next = next.replace(email, 'gerant@exemple.fr');
      email.lastIndex = 0;
      next = next.split(origin).join('https://athlexapp.eu');
      for (const [pattern, replacement] of banned) next = next.replace(pattern, replacement);
      if (next !== text) node.nodeValue = next;
      node = walker.nextNode();
    }

    // Le lien d'invitation vit dans un champ en lecture seule : son jeton ne
    // doit pas partir dans une capture publiée.
    document.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.value.includes('/rejoindre/')) {
        input.value = 'https://athlexapp.eu/rejoindre/JETON-EXEMPLE';
      }
      if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(input.value)) input.value = 'gerant@exemple.fr';
      for (const [pattern, replacement] of banned) {
        input.value = input.value.replace(pattern, replacement);
      }
    });

    document.querySelectorAll('textarea').forEach((area) => {
      for (const [pattern, replacement] of banned) {
        area.value = area.value.replace(pattern, replacement);
      }
    });

    const label = Array.from(document.querySelectorAll('*')).find(
      (el) => el.children.length === 0 && /code d'invitation box/i.test(el.textContent ?? ''),
    );
    const code = label?.nextElementSibling;
    if (code && /^[\s\w]+$/.test(code.textContent ?? '')) code.textContent = 'ABC123';
  }, BASE_URL);
}

/**
 * Les modales sont posées sur un voile flouté et translucide : la page qui est
 * derrière reste lisible à travers la capture. On rend le voile et la modale
 * opaques pour ne garder que la modale à l'image.
 */
async function opaqueOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    const overlays = document.querySelectorAll<HTMLElement>(
      '.fixed.inset-0.z-50, .fixed.inset-0.z-\\[100\\]',
    );
    overlays.forEach((overlay) => {
      overlay.style.backdropFilter = 'none';
      overlay.style.backgroundColor = '#0A0A0A';
      const panel = overlay.firstElementChild as HTMLElement | null;
      if (panel) {
        panel.style.backdropFilter = 'none';
        panel.style.backgroundColor = '#111111';
      }
    });
  });
}

async function capture(page: Page, shot: Shot): Promise<void> {
  await page.goto(`${BASE_URL}${shot.routeFn ? shot.routeFn() : shot.route}`, {
    waitUntil: 'networkidle',
  });
  // Les pages client affichent un spinner tant que la box n'est pas chargée :
  // sans cette attente, la capture ne montre que le spinner.
  await page
    .waitForFunction(() => !document.querySelector('.animate-spin'), undefined, { timeout: 30_000 })
    .catch(() => undefined);
  await page
    .waitForFunction(() => !/Chargement/.test(document.body.innerText), undefined, {
      timeout: 30_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(1200);
  if (shot.prepare) await shot.prepare(page);
  await opaqueOverlays(page);
  await anonymize(page);

  const dir = path.join(OUT, shot.slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${shot.n}.png`);

  const target =
    typeof shot.area === 'function'
      ? shot.area(page)
      : shot.area
        ? page.locator(shot.area).first()
        : null;
  if (target) {
    // Une capture d'élément conserve l'alpha du fond translucide des modales :
    // on découpe donc le viewport, qui est opaque.
    const box = await target.boundingBox();
    if (!box) throw new Error('zone introuvable');
    await page.screenshot({
      path: file,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.width, VIEWPORT.width - Math.max(0, box.x)),
        height: Math.min(box.height, VIEWPORT.height - Math.max(0, box.y)),
      },
    });
  } else {
    await page.screenshot({ path: file });
  }

  if (shot.cleanup) await shot.cleanup(page);
}

/**
 * Révoque l'invitation jetable créée pour les captures. La démo sert au
 * reviewer Apple : rien de test ne doit y survivre au script.
 */
async function revokeTestInvitations(page: Page): Promise<void> {
  page.on('dialog', (dialog) => dialog.accept());
  for (let i = 0; i < 10; i += 1) {
    await page.goto(`${BASE_URL}/invitations`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const row = page
      .locator('div', { hasText: new RegExp(INVITE_PREFIX) })
      .filter({ has: page.getByRole('button', { name: /Révoquer/ }) })
      .last();
    if ((await row.count()) === 0) {
      console.log('aucune invitation de capture restante');
      return;
    }
    await row.getByRole('button', { name: /Révoquer/ }).click();
    await page.waitForTimeout(2500);
  }
  console.log(`à vérifier à la main : des invitations ${INVITE_PREFIX} subsistent`);
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

  // Page publique : elle doit être photographiée telle qu'un visiteur la voit,
  // donc depuis un contexte sans session (sinon le gérant y voit « Gérer »).
  const anonContext = await browser.newContext({ viewport: VIEWPORT, locale: 'fr-FR' });
  await anonContext.addCookies([{ name: 'athlex_lang', value: 'fr', url: BASE_URL }]);
  const anonPage = await anonContext.newPage();

  const failed: string[] = [];
  try {
    await signIn(page);
    await assertDemoBox(page);

    for (const shot of wanted) {
      const id = `${shot.slug}/${shot.n}.png`;
      try {
        await capture(shot.anon ? anonPage : page, shot);
        console.log(`ok   ${id}`);
      } catch (err) {
        failed.push(id);
        console.log(`échec ${id} — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await revokeTestInvitations(page);
  } finally {
    await anonContext.close();
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
