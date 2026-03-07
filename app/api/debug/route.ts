import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET';
  const keyOk = !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const { data: boxes, error: boxError } = await supabase
      .from('boxes').select('id, name, owner_id, invite_code').limit(5);

    return NextResponse.json({
      supabaseUrl: url,
      anonKeyPresent: keyOk,
      user: user ? { id: user.id, email: user.email } : null,
      authError: authError?.message ?? null,
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
