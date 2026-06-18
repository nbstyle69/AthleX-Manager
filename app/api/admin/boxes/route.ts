import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = createServiceClient();
  const body = await req.json();

  const { name, description, city, owner_id, invite_code } = body;

  if (!name || !owner_id || !invite_code) {
    return NextResponse.json({ error: 'name, owner_id and invite_code are required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('boxes').insert({
    name,
    description: description || null,
    city: city || null,
    owner_id,
    invite_code,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also add the owner as a member of the box
  await supabase.from('box_members').insert({
    box_id: data.id,
    member_id: owner_id,
    status: 'active',
  });

  return NextResponse.json(data);
}
