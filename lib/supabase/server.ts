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
  city: string | null; logo_url: string | null;
  is_active: boolean; created_at: string;
};

/**
 * Colonnes de `boxes` lues avec le JWT de l'utilisateur. Jamais `*` : la Phase 3
 * révoque `invite_code`, `stripe_account_id` et `dunning_grace_days` à
 * `authenticated`, et une étoile tomberait alors en 42501 pour tout le tableau.
 * Le code d'invitation passe par `get_my_box_invite_code`.
 */
const BOX_ROW_COLUMNS = 'id, name, slug, owner_id, city, logo_url, is_active, created_at';

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
    .from('boxes').select(BOX_ROW_COLUMNS).eq('owner_id', uid);
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
      .from('boxes').select(BOX_ROW_COLUMNS).in('id', coIds);
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

export interface BoxBillingState {
  /** Multi-box owner subscription is active/trialing/past_due. */
  multiActive: boolean;
  /** This box is unlocked by the owner's active Multi plan. */
  coveredByMulti: boolean;
  /** This is an additional box and Multi is not active → must upgrade to unlock. */
  requiresMulti: boolean;
  /** Number of boxes owned directly by the box owner. */
  boxCount: number;
  /** This box is the owner's primary (oldest) box. */
  isPrimary: boolean;
}

/**
 * Billing entitlement for a given box under the owner-level Solo/Multi model.
 *
 * - The primary (oldest) box keeps its legacy per-box `box_subscriptions` gate.
 * - Every additional box is LOCKED until the owner has an active Multi plan
 *   (`owner_subscriptions`) whose `box_quota` covers it (base + 29 €/box).
 *
 * Uses the service client so it resolves correctly for co-owners too (billing
 * follows the box's actual `owner_id`, not the current viewer).
 */
export async function getBoxBillingState(
  box: { id: string; owner_id: string },
): Promise<BoxBillingState> {
  const svc = createServiceClient();

  const { data: owned } = await svc
    .from('boxes').select('id, created_at')
    .eq('owner_id', box.owner_id)
    .order('created_at', { ascending: true });
  const ids = (owned ?? []).map((b) => (b as { id: string }).id);
  const boxCount = ids.length;
  const index = ids.indexOf(box.id);
  const isPrimary = index === 0;

  const { data: sub } = await svc
    .from('owner_subscriptions')
    .select('status, box_quota')
    .eq('owner_id', box.owner_id)
    .maybeSingle();

  const s = sub as { status: string; box_quota: number } | null;
  const multiActive = !!s && ['active', 'trialing', 'past_due'].includes(s.status);
  // Ranked position of this box among the owner's boxes (1-based).
  const rank = index >= 0 ? index + 1 : boxCount;
  const coveredByMulti = multiActive && (s?.box_quota ?? 0) >= rank;
  const requiresMulti = !coveredByMulti && !isPrimary;

  return { multiActive, coveredByMulti, requiresMulti, boxCount, isPrimary };
}
