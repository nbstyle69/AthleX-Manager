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

/**
 * Libellés visibles des routes du périmètre, source unique de la barre latérale
 * et de la phrase de refus. La phrase énumérait « Whiteboard, Horaires et
 * Messages » alors que `/templates` était entré dans le périmètre : un libellé
 * orphelin dit au coach qu'une page lui est fermée quand elle lui est ouverte.
 */
export const COACH_ROUTE_LABELS: Record<(typeof COACH_ROUTE_SEGMENTS)[number], string> = {
  wods: 'Whiteboard',
  schedules: 'Horaires',
  templates: 'Créneaux types',
  messages: 'Messages',
};

/** « Whiteboard, Horaires, Créneaux types et Messages » */
export function coachPerimeterSentence(): string {
  const labels = COACH_ROUTE_SEGMENTS.map((s) => COACH_ROUTE_LABELS[s]);
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}
