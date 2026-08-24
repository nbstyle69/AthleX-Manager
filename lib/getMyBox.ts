import { SupabaseClient } from '@supabase/supabase-js';

export const ACTIVE_BOX_COOKIE = 'active_box_id';

function readActiveBoxCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(
    new RegExp('(?:^|; )' + ACTIVE_BOX_COOKIE + '=([^;]*)'),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export interface MyAdminBox {
  id: string;
  name: string;
  my_role: 'owner' | 'coach';
}

/**
 * Toutes les box administrées par l'appelant, dans l'ordre de la RPC.
 *
 * Une page qui a besoin de la liste (sélecteur, offres de plusieurs box) ne
 * refait pas l'inventaire à la main : `/programming` le faisait sur
 * `boxes.owner_id` + `box_members.role = 'owner'`, ignorait l'`error`, et
 * rendait « Aucune box active » quand la lecture échouait.
 */
export async function getMyAdminBoxes(supabase: SupabaseClient): Promise<MyAdminBox[]> {
  const { data, error } = await supabase.rpc('get_my_admin_boxes');
  if (error) {
    // Une liste vide voudrait dire « cet utilisateur n'administre aucune box ».
    // Une panne de la RPC n'est pas cette phrase-là : on la laisse remonter à
    // l'écran plutôt que de la déguiser en absence de box.
    throw new Error(`get_my_admin_boxes a échoué : ${error.message}`);
  }
  return (data ?? []) as MyAdminBox[];
}

/**
 * Resolve the *active* box for a user in the multi-box back-office.
 *
 * Lot 5-B : client de la RPC `get_my_admin_boxes()`, comme le résolveur
 * serveur. La règle « qui administre quoi, et à quel titre » ne se recompose
 * plus ici — deux copies d'une règle d'autorisation divergent toujours, et
 * celle-ci ignorait `role = 'coach'`.
 *
 * Aucun `userId` en paramètre : l'autorité est `auth.uid()` côté base. Le
 * passer aurait laissé croire que l'appelant choisit de qui il lit le titre.
 *
 * On garde toutes les box (jamais `.single()`, qui lève sur plusieurs lignes)
 * et on choisit celle du cookie `active_box_id` posé par le sélecteur, sinon la
 * plus ancienne. Le titre remonte avec la box : une page argent doit s'en
 * servir pour se taire, jamais comme autorisation — le refus est côté serveur.
 */
export async function getMyBox(
  supabase: SupabaseClient,
): Promise<{ id: string; my_role: 'owner' | 'coach' } | null> {
  const boxes = await getMyAdminBoxes(supabase);
  if (boxes.length === 0) return null;

  const wanted = readActiveBoxCookie();
  const active = wanted ? boxes.find((b) => b.id === wanted) : undefined;
  const box = active ?? boxes[0];
  return { id: box.id, my_role: box.my_role };
}
