import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff d'une box : gérant, co-gérant ou coach.
 *
 * Distinct d'`isBoxOwnerAdmin`, qui exclut le coach parce qu'il garde l'argent,
 * la facturation et l'export. Poser ou régénérer la semaine automatique n'est
 * pas une opération d'argent : un coach de la box y a sa place.
 *
 * Le gérant principal passe par `boxes.owner_id` **en plus** de la ligne
 * `box_members` : trois des quatre box de production n'ont pas de ligne
 * `box_members` pour leur propre gérant, et un contrôle limité à `box_members`
 * les refuserait sur leur propre box.
 */
export async function isBoxStaff(
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

  const { data: member } = await supabase
    .from('box_members')
    .select('id')
    .eq('box_id', boxId)
    .eq('member_id', userId)
    .in('role', ['owner', 'coach'])
    .eq('status', 'active')
    .maybeSingle();

  return !!member;
}
