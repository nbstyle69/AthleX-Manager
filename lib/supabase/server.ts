import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    }
  );
}

export async function getOwnerBox(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: box } = await supabase
    .from('boxes').select('*').eq('owner_id', user.id).single();
  return box as {
    id: string; name: string; slug: string; owner_id: string;
    city: string | null; plan: string; logo_url: string | null;
    is_active: boolean; created_at: string;
  } | null;
}
