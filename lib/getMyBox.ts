import { SupabaseClient } from '@supabase/supabase-js';

export const ACTIVE_BOX_COOKIE = 'active_box_id';

function readActiveBoxCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(
    new RegExp('(?:^|; )' + ACTIVE_BOX_COOKIE + '=([^;]*)'),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Resolve the *active* box for a user in the multi-box back-office.
 *
 * A user can own/co-own several boxes. We collect them all (never `.single()`,
 * which throws on multiple rows) and pick the one matching the `active_box_id`
 * cookie set by the box switcher — falling back to the first box by creation
 * date. Mono-box owners keep the exact same behaviour.
 */
export async function getMyBox(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string } | null> {
  const ids = new Set<string>();

  const { data: owned } = await supabase
    .from('boxes')
    .select('id, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  const ordered: { id: string }[] = (owned ?? []).map((b) => ({ id: b.id }));
  for (const b of ordered) ids.add(b.id);

  const { data: memberships } = await supabase
    .from('box_members')
    .select('box_id')
    .eq('member_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active');
  for (const m of memberships ?? []) {
    if (!ids.has(m.box_id)) {
      ids.add(m.box_id);
      ordered.push({ id: m.box_id });
    }
  }

  if (ordered.length === 0) return null;

  const wanted = readActiveBoxCookie();
  const active = wanted ? ordered.find((b) => b.id === wanted) : undefined;
  return active ?? ordered[0];
}
