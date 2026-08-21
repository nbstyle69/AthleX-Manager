import { forbidden } from 'next/navigation';
import { createClient, getActiveBox, getServerUser } from '@/lib/supabase/server';
import type { BoxRole } from '@/lib/authz/coach-perimeter';

export { COACH_ROUTE_SEGMENTS, COACH_HREFS } from '@/lib/authz/coach-perimeter';

/**
 * Refus serveur des routes réservées au gérant/co-gérant.
 *
 * Rend un vrai 403 (`forbidden()`) avant tout rendu : un coach qui tape l'URL
 * à la main n'obtient ni la page, ni un écran vide, ni une redirection
 * client — il obtient un refus, et le statut le nomme.
 */
export async function requireOwnerAdminRoute(): Promise<void> {
  const role = await getMyRoleOnActiveBox();
  if (role !== 'owner') forbidden();
}

/** Titre de l'appelant sur la box active, ou null s'il n'administre rien. */
export async function getMyRoleOnActiveBox(): Promise<BoxRole | null> {
  const user = await getServerUser();
  if (!user) return null;
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  return box?.my_role ?? null;
}
