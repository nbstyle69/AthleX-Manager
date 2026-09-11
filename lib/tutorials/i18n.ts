import type { Lang } from '@/lib/translations';
import type { TutorialRole } from './schema';

export type Locale = Lang;
export const LOCALES: readonly Locale[] = ['fr', 'en'];

export function isLocale(value: string | undefined): value is Locale {
  return value === 'fr' || value === 'en';
}

/** Thèmes de regroupement de la page Aide, dérivés de `order` (§5.1). */
export const THEMES = [
  'getting-started',
  'wods',
  'members',
  'programs',
  'marketplace',
  'tournaments',
] as const;

export type ThemeId = (typeof THEMES)[number];

export function themeForOrder(order: number): ThemeId {
  if (order < 20) return 'getting-started';
  if (order < 30) return 'wods';
  if (order < 40) return 'members';
  if (order < 50) return 'programs';
  if (order < 60) return 'marketplace';
  return 'tournaments';
}

interface HelpStrings {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  searchLabel: string;
  filterAll: string;
  filterOwner: string;
  filterCoach: string;
  noResults: string;
  seeAll: string;
  resultsCount: (n: number) => string;
  roles: Record<TutorialRole, string>;
  themes: Record<ThemeId, string>;
  pages: Record<string, string>;
  toc: string;
  goTo: (page: string) => string;
  previous: string;
  next: string;
  helpButton: string;
  sheetTitle: string;
  sheetSubtitle: string;
  openInHelp: string;
  back: string;
  untranslated: string;
  screenshotPending: string;
}

export const HELP_STRINGS: Record<Locale, HelpStrings> = {
  fr: {
    title: 'Aide',
    subtitle: 'Tutoriels pas à pas pour les owners et les coachs.',
    searchPlaceholder: 'Rechercher un tutoriel…  (touche /)',
    searchLabel: 'Rechercher dans les tutoriels',
    filterAll: 'Tous',
    filterOwner: 'Owner',
    filterCoach: 'Coach',
    noResults: 'Aucun tutoriel ne correspond à cette recherche.',
    seeAll: 'Voir tous les tutoriels',
    resultsCount: (n) => (n === 1 ? '1 résultat' : `${n} résultats`),
    roles: { owner: 'Owner', coach: 'Coach', both: 'Owner & Coach' },
    themes: {
      'getting-started': 'Prise en main',
      wods: 'WODs & Whiteboard',
      members: 'Membres & planning',
      programs: 'Programmes',
      marketplace: 'Marketplace',
      tournaments: 'Tournois',
    },
    pages: {
      'page.dashboard': 'Dashboard',
      'page.whiteboard': 'Whiteboard',
      'page.members': 'Membres',
      'page.groups': 'Groupes',
      'page.schedule': 'Horaires & Créneaux',
      'page.programs': 'Programmes athlètes',
      'page.marketplace': 'Marketplace',
      'page.tournaments': 'Tournois',
      'page.settings': 'Réglages',
    },
    toc: 'Sommaire',
    goTo: (page) => `Y aller : ${page}`,
    previous: 'Précédent',
    next: 'Suivant',
    helpButton: 'Aide sur cette page',
    sheetTitle: 'Aide',
    sheetSubtitle: 'Tutoriels liés à cette page',
    openInHelp: 'Ouvrir dans la page Aide',
    back: 'Retour aux tutoriels',
    untranslated: "Ce tutoriel n'est pas encore traduit : voici la version française.",
    screenshotPending: 'Capture à venir',
  },
  en: {
    title: 'Help',
    subtitle: 'Step-by-step tutorials for owners and coaches.',
    searchPlaceholder: 'Search a tutorial…  (press /)',
    searchLabel: 'Search the tutorials',
    filterAll: 'All',
    filterOwner: 'Owner',
    filterCoach: 'Coach',
    noResults: 'No tutorial matches this search.',
    seeAll: 'See all tutorials',
    resultsCount: (n) => (n === 1 ? '1 result' : `${n} results`),
    roles: { owner: 'Owner', coach: 'Coach', both: 'Owner & Coach' },
    themes: {
      'getting-started': 'Getting started',
      wods: 'WODs & Whiteboard',
      members: 'Members & schedule',
      programs: 'Programs',
      marketplace: 'Marketplace',
      tournaments: 'Tournaments',
    },
    pages: {
      'page.dashboard': 'Dashboard',
      'page.whiteboard': 'Whiteboard',
      'page.members': 'Members',
      'page.groups': 'Groups',
      'page.schedule': 'Schedule & slots',
      'page.programs': 'Athlete programs',
      'page.marketplace': 'Marketplace',
      'page.tournaments': 'Tournaments',
      'page.settings': 'Settings',
    },
    toc: 'Contents',
    goTo: (page) => `Go there: ${page}`,
    previous: 'Previous',
    next: 'Next',
    helpButton: 'Help for this page',
    sheetTitle: 'Help',
    sheetSubtitle: 'Tutorials for this page',
    openInHelp: 'Open in the Help page',
    back: 'Back to tutorials',
    untranslated: "This tutorial isn't translated yet: here is the French version.",
    screenshotPending: 'Screenshot coming soon',
  },
};
