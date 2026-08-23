/**
 * Périmètre coach du back-office web, aligné sur `CoachTabs` du mobile :
 * Whiteboard, Horaires, Modèles de créneaux, Messages. Le mobile a déjà tranché
 * cette frontière ; on ne la réinvente pas ici.
 *
 * Lot 6 : `templates` (la grille de créneaux récurrents) entre dans le
 * périmètre. Le coach détient déjà côté serveur les quatre gestes de
 * programmation et la génération des créneaux depuis les modèles — l'écran
 * s'aligne sur le serveur, et il est NOMMÉ ici : une garde simplement retirée
 * du layout se relirait comme un oubli.
 *
 * Liste blanche, pas liste noire : ce qui n'est pas nommé est refusé. Une liste
 * d'exclusions laisse entrer toute route qui naîtra ensuite — c'est ainsi que
 * `/programs`, la page qui fixe les prix, manquait à l'ancienne
 * `OWNER_ONLY_HREFS` de la barre latérale.
 *
 * Module sans dépendance sur `next/*` : la garde serveur, la barre latérale et
 * le contrôle mécanique des routes lisent tous cette source unique.
 */
export const COACH_ROUTE_SEGMENTS = ['wods', 'schedules', 'templates', 'messages'] as const;

export const COACH_HREFS: readonly string[] = COACH_ROUTE_SEGMENTS.map((s) => `/${s}`);

export type BoxRole = 'owner' | 'coach';
