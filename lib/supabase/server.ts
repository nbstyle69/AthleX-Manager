import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('sb-access-token')?.value ?? null;
}

export const getServerUser = cache(async () => {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
});

export async function createClient() {
  const accessToken = await getAccessToken();
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}

export function createServiceClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getServerProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId?: string) {
  const uid = userId ?? (await getServerUser())?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from('profiles').select('id, username, role, level, elo').eq('id', uid).single();
  return data as {
    id: string; username: string; role: string; level: string; elo: number;
  } | null;
}

type BoxRow = {
  id: string; name: string; slug: string; owner_id: string;
  city: string | null; plan: string; logo_url: string | null;
  is_active: boolean; created_at: string;
};

export const ACTIVE_BOX_COOKIE = 'active_box_id';

/**
 * All boxes the user administrates, as primary owner (boxes.owner_id) or as an
 * active co-owner (box_members.role = 'owner'). Deduplicated, oldest first.
 */
export async function getOwnerBoxes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId?: string,
): Promise<BoxRow[]> {
  const uid = userId ?? (await getServerUser())?.id;
  if (!uid) return [];

  const byId = new Map<string, BoxRow>();

  // 1. Primary owner (boxes.owner_id)
  const { data: owned } = await supabase
    .from('boxes').select('*').eq('owner_id', uid);
  for (const b of (owned ?? []) as BoxRow[]) byId.set(b.id, b);

  // 2. Co-owner (box_members.role = 'owner')
  const { data: memberships } = await supabase
    .from('box_members').select('box_id')
    .eq('member_id', uid).eq('role', 'owner').eq('status', 'active');
  const coIds = (memberships ?? [])
    .map((m) => (m as { box_id: string }).box_id)
    .filter((id) => !byId.has(id));
  if (coIds.length > 0) {
    const { data: coBoxes } = await supabase
      .from('boxes').select('*').in('id', coIds);
    for (const b of (coBoxes ?? []) as BoxRow[]) byId.set(b.id, b);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * The currently-active box for the dashboard. Resolves the `active_box_id`
 * cookie against the set of boxes the user is authorized to administrate
 * (rejecting a forged/stale cookie to prevent IDOR), and falls back to the
 * first box otherwise. Returns null when the user administrates no box.
 */
export async function getActiveBox(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId?: string,
): Promise<BoxRow | null> {
  const boxes = await getOwnerBoxes(supabase, userId);
  if (boxes.length === 0) return null;

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_BOX_COOKIE)?.value;
  const active = wanted ? boxes.find((b) => b.id === wanted) : undefined;
  return active ?? boxes[0];
}

/**
 * Backwards-compatible single-box resolver. Now returns the active box so every
 * existing caller is transparently multi-box aware.
 */
export async function getOwnerBox(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId?: string,
): Promise<BoxRow | null> {
  return getActiveBox(supabase, userId);
}
