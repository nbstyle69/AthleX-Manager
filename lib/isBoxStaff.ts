import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Strict server-side check: is `userId` staff (primary owner or active
 * owner/coach) of `boxId`? Uses a service client so it isn't subject to RLS.
 * Deliberately stricter than the `is_box_admin` RPC (which globally trusts
 * any `box_owner` profile) so an owner can only act on their own box.
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

  const { data: staff } = await supabase
    .from('box_members')
    .select('id')
    .eq('box_id', boxId)
    .eq('member_id', userId)
    .in('role', ['owner', 'coach'])
    .eq('status', 'active')
    .maybeSingle();

  return !!staff;
}
