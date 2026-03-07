import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, len: c.value.length }));

  const user = await getServerUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    receivedCookies: allCookies,
  });
}
