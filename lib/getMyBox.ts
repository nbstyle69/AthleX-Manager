import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve the box for a user — either as primary owner (boxes.owner_id)
 * or as co-owner (box_members.role = 'owner').
 * Returns { id: string } or null.
 */
export async function getMyBox(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string } | null> {
  // 1. Primary owner
  const { data: box } = await supabase
    .from('boxes').select('id').eq('owner_id', userId).single();
  if (box) return box;

  // 2. Co-owner via box_members
  const { data: membership } = await supabase
    .from('box_members').select('box_id').eq('member_id', userId).eq('role', 'owner').eq('status', 'active').single();
  if (membership) return { id: membership.box_id };

  return null;
}
