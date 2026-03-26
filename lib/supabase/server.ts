import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('sb-access-token')?.value ?? null;
}

export async function getServerUser() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

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

export async function getServerProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const user = await getServerUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles').select('id, username, role, level, elo').eq('id', user.id).single();
  return data as {
    id: string; username: string; role: string; level: string; elo: number;
  } | null;
}

export async function getOwnerBox(supabase: Awaited<ReturnType<typeof createClient>>) {
  const user = await getServerUser();
  if (!user) return null;

  type BoxRow = {
    id: string; name: string; slug: string; owner_id: string;
    city: string | null; plan: string; logo_url: string | null;
    is_active: boolean; created_at: string;
  };

  // 1. Primary owner (boxes.owner_id)
  const { data: box } = await supabase
    .from('boxes').select('*').eq('owner_id', user.id).single();
  if (box) return box as BoxRow;

  // 2. Co-owner (box_members.role = 'owner')
  const { data: membership } = await supabase
    .from('box_members').select('box_id').eq('member_id', user.id).eq('role', 'owner').eq('status', 'active').single();
  if (!membership) return null;

  const { data: coBox } = await supabase
    .from('boxes').select('*').eq('id', membership.box_id).single();
  return coBox as BoxRow | null;
}
