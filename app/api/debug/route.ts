import { NextResponse } from 'next/server';
import { createClient, getServerUser, getAdminUser } from '@/lib/supabase/server';

export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET';
  const keyOk = !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const user = await getServerUser();
    const supabase = await createClient();

    const { data: boxes, error: boxError } = await supabase
      .from('boxes').select('id, name, owner_id, invite_code').limit(5);

    return NextResponse.json({
      supabaseUrl: url,
      anonKeyPresent: keyOk,
      user: user ? { id: user.id, email: user.email } : null,
      boxes: boxes ?? [],
      boxError: boxError?.message ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({
      supabaseUrl: url,
      anonKeyPresent: keyOk,
      fatalError: err?.message ?? 'Unknown error',
    });
  }
}
