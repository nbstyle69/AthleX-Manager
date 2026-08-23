/**
 * Destination d'après-connexion, dérivée du titre que le serveur prononce
 * (`get_my_admin_boxes()`), jamais recalculée côté client. La connexion
 * refaisait « qui est staff » à sa façon — propriétaire de box ou
 * `box_members.role='owner'` — donc un coach actif atterrissait dans l'espace
 * athlète : la porte ouverte par le lot 5-B n'avait pas de poignée.
 *
 * Priorité owner : un utilisateur owner d'une box et coach d'une autre arrive
 * sur le tableau de bord, pas sur le périmètre réduit.
 */
import { COACH_HREFS, type BoxRole } from '@/lib/authz/coach-perimeter';

export const OWNER_HOME = '/';
/** Première entrée du périmètre coach — la même source que la garde serveur. */
export const COACH_HOME = COACH_HREFS[0];
export const ATHLETE_HOME = '/compte';

export function postLoginPath(boxes: readonly { my_role: BoxRole }[]): string {
  if (boxes.some((b) => b.my_role === 'owner')) return OWNER_HOME;
  if (boxes.some((b) => b.my_role === 'coach')) return COACH_HOME;
  return ATHLETE_HOME;
}
