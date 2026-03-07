import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, len: c.value.length }));

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message ?? null,
    receivedCookies: allCookies,
  });
}
