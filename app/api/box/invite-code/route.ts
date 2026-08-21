import { NextRequest, NextResponse } from 'next/server';
import { createClient, getServerUser, getActiveBox } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const supabase = await createClient();

  // Cible la box active du back-office, jamais « la première ».
  const box = await getActiveBox(supabase);

  if (!box) return NextResponse.json({ error: 'Aucune box trouvée pour ce compte' }, { status: 404 });

  const body = await req.json();
  const { invite_code } = body;

  if (!invite_code || typeof invite_code !== 'string' || invite_code.trim().length < 3) {
    return NextResponse.json({ error: 'Le code doit contenir au moins 3 caractères' }, { status: 400 });
  }

  const code = invite_code.trim().toUpperCase();

  // Use service client to bypass RLS
  const service = createServiceClient();

  // Check uniqueness — reject if another box already uses this code
  const { data: existing } = await service
    .from('boxes')
    .select('id')
    .eq('invite_code', code)
    .neq('id', box.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Ce code est déjà utilisé par une autre box. Choisissez-en un autre.' }, { status: 409 });
  }

  const { data, error } = await service
    .from('boxes')
    .update({ invite_code: code })
    .eq('id', box.id)
    .select('invite_code')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invite_code: data.invite_code });
}
