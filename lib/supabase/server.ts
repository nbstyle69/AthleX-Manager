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

/** Titre de l'appelant sur une box, décidé par la base (lot 5-B). */
export type BoxRole = 'owner' | 'coach';

type BoxRow = {
  id: string; name: string; slug: string; owner_id: string;
  city: string | null; logo_url: string | null;
  is_active: boolean; created_at: string;
  allowed_tournament_formats: string[] | null;
  /** 'owner' = gérant ou co-gérant · 'coach' = coach actif de la box. */
  my_role: BoxRole;
};

export const ACTIVE_BOX_COOKIE = 'active_box_id';

/**
 * Toutes les box administrées par l'utilisateur, avec son titre sur chacune.
 *
 * Lot 5-B : une seule source. La règle « qui administre quoi, et à quel titre »
 * vivait à trois endroits (ici, dans le résolveur client, et dans un appel
 * séparé à `is_box_owner_admin`) ; elle vit maintenant dans la RPC
 * `get_my_admin_boxes()`. Le titre est décidé par la base, pas recomposé ici :
 * c'est lui qui ouvre ou ferme les routes argent côté serveur.
 *
 * Aucun paramètre d'identité : l'autorité est `auth.uid()` dans la base. Un
 * `userId` passé par l'appelant n'aurait servi qu'à laisser croire que le
 * résolveur décide, alors qu'il ne fait que transmettre le JWT.
 *
 * Les administrateurs globaux ne sont volontairement pas énumérés ici : la RPC
 * répond « quelles box j'administre en tant que staff ». Ils n'y étaient pas
 * non plus avant (l'ancienne lecture filtrait sur `owner_id`), donc aucune
 * régression — mais c'est un choix, pas un oubli.
 */
export async function getAdminBoxes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<BoxRow[]> {
  const { data, error } = await supabase.rpc('get_my_admin_boxes');
  if (error) {
    // Une panne de la RPC ne doit pas se lire comme « aucune box administrée » :
    // ce repli-là afficherait « Box non configurée » à un gérant dont la box
    // existe. On échoue bruyamment plutôt que de mentir avec aplomb.
    throw new Error(`get_my_admin_boxes a échoué : ${error.message}`);
  }
  return (data ?? []) as BoxRow[];
}

/**
 * The currently-active box for the dashboard. Resolves the `active_box_id`
 * cookie against the set of boxes the user is authorized to administrate
 * (rejecting a forged/stale cookie to prevent IDOR), and falls back to the
 * first box otherwise. Returns null when the user administrates no box.
 */
export async function getActiveBox(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<BoxRow | null> {
  const boxes = await getAdminBoxes(supabase);
  if (boxes.length === 0) return null;

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_BOX_COOKIE)?.value;
  const active = wanted ? boxes.find((b) => b.id === wanted) : undefined;
  return active ?? boxes[0];
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
