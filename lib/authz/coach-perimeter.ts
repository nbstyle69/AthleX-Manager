/**
 * Périmètre coach du back-office web, aligné sur `CoachTabs` du mobile :
 * Whiteboard, Horaires, Messages. Le mobile a déjà tranché cette frontière ;
 * on ne la réinvente pas ici.
 *
 * Liste blanche, pas liste noire : ce qui n'est pas nommé est refusé. Une liste
 * d'exclusions laisse entrer toute route qui naîtra ensuite — c'est ainsi que
 * `/programs`, la page qui fixe les prix, manquait à l'ancienne
 * `OWNER_ONLY_HREFS` de la barre latérale.
 *
 * Module sans dépendance sur `next/*` : la garde serveur, la barre latérale et
 * le contrôle mécanique des routes lisent tous cette source unique.
 */
export const COACH_ROUTE_SEGMENTS = ['wods', 'schedules', 'messages'] as const;

export const COACH_HREFS: readonly string[] = COACH_ROUTE_SEGMENTS.map((s) => `/${s}`);

export type BoxRole = 'owner' | 'coach';
