import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
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
