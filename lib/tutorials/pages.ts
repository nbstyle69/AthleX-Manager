/**
 * Registre des pages du back-office couvertes par l'aide.
 *
 * Une seule table pour deux usages : le bouton « ? » (route courante → id →
 * tutoriels dont `pages` contient l'id) et le composant `<GoTo>` (id → route).
 * Les routes sont celles réellement présentes sous `app/(dashboard)` — un id
 * sans route enverrait le gérant sur un 404 depuis un tutoriel.
 *
 * `movements` de la spec n'a pas de route dans le back-office de box : le
 * catalogue de mouvements vit sous `/admin/movements`, console plateforme
 * fermée aux owners et aux coachs. L'id est donc absent du registre, et le
 * tutoriel « Mouvements & badges » ne se rattache qu'au Whiteboard.
 */
export const PAGE_IDS = [
  'dashboard',
  'whiteboard',
  'members',
  'groups',
  'schedule',
  'plans',
  'prospects',
  'invitations',
  'subscribers',
  'programs',
  'marketplace',
  'marketplace-offers',
  'articles',
  'messages',
  'stats',
  'tournaments',
  'settings',
] as const;

export type PageId = (typeof PAGE_IDS)[number];

export interface HelpPage {
  id: PageId;
  route: string;
  /** Clé de libellé traduite dans `lib/tutorials/i18n.ts`. */
  labelKey: string;
}

export const HELP_PAGES: readonly HelpPage[] = [
  { id: 'dashboard',   route: '/',             labelKey: 'page.dashboard' },
  { id: 'whiteboard',  route: '/wods',         labelKey: 'page.whiteboard' },
  { id: 'members',     route: '/members',      labelKey: 'page.members' },
  { id: 'groups',      route: '/groups',       labelKey: 'page.groups' },
  { id: 'schedule',    route: '/schedules',    labelKey: 'page.schedule' },
  { id: 'plans',       route: '/plans',        labelKey: 'page.plans' },
  { id: 'prospects',   route: '/prospects',    labelKey: 'page.prospects' },
  { id: 'invitations', route: '/invitations',  labelKey: 'page.invitations' },
  { id: 'subscribers', route: '/subscribers',  labelKey: 'page.subscribers' },
  { id: 'programs',    route: '/programming/athletes', labelKey: 'page.programs' },
  { id: 'marketplace', route: '/programming',  labelKey: 'page.marketplace' },
  { id: 'marketplace-offers', route: '/programming/offers', labelKey: 'page.marketplaceOffers' },
  { id: 'articles',    route: '/articles',     labelKey: 'page.articles' },
  { id: 'messages',    route: '/messages',     labelKey: 'page.messages' },
  { id: 'stats',       route: '/stats',        labelKey: 'page.stats' },
  { id: 'tournaments', route: '/tournaments',  labelKey: 'page.tournaments' },
  { id: 'settings',    route: '/settings',     labelKey: 'page.settings' },
];

export function helpPage(id: PageId): HelpPage {
  const page = HELP_PAGES.find((p) => p.id === id);
  if (!page) throw new Error(`Page d'aide inconnue : ${id}`);
  return page;
}

export function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}

/** Route courante → id de page, pour le bouton « ? ». Préfixe le plus long. */
export function pageIdForRoute(pathname: string): PageId | null {
  if (pathname === '/') return 'dashboard';
  const match = HELP_PAGES
    .filter((p) => p.route !== '/' && (pathname === p.route || pathname.startsWith(`${p.route}/`)))
    .sort((a, b) => b.route.length - a.route.length)[0];
  return match?.id ?? null;
}
