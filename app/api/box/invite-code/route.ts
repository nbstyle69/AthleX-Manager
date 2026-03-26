import { NextRequest, NextResponse } from 'next/server';
import { createClient, getServerUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const supabase = await createClient();

  // Find the box owned by this user
  const { data: box } = await supabase
    .from('boxes')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!box) return NextResponse.json({ error: 'Aucune box trouvée pour ce compte' }, { status: 404 });

  const body = await req.json();
  const { invite_code } = body;

  if (!invite_code || typeof invite_code !== 'string' || invite_code.trim().length < 3) {
    return NextResponse.json({ error: 'Le code doit contenir au moins 3 caractères' }, { status: 400 });
  }

  const code = invite_code.trim().toUpperCase();

  // Use service client to bypass RLS
  const service = createServiceClient();
  const { data, error } = await service
    .from('boxes')
    .update({ invite_code: code })
    .eq('id', box.id)
    .select('invite_code')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invite_code: data.invite_code });
}
