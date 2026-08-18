import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Garde owner/co-gérant : `userId` est-il le gérant principal de `boxId`, ou un
 * membre `role = 'owner'` actif ? Le coach est exclu — il n'a rien à faire sur
 * l'argent, la facturation, les invitations ni l'export.
 *
 * Pendant serveur de `public.is_box_owner_admin()`. Un client service est utilisé
 * pour ne pas dépendre de la RLS de la requête appelante.
 */
export async function isBoxOwnerAdmin(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
): Promise<boolean> {
  const { data: box } = await supabase
    .from('boxes')
    .select('id')
    .eq('id', boxId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (box) return true;

  const { data: coOwner } = await supabase
    .from('box_members')
    .select('id')
    .eq('box_id', boxId)
    .eq('member_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();

  return !!coOwner;
}
