import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const boxId = req.nextUrl.searchParams.get('box_id');
  const boxName = req.nextUrl.searchParams.get('box_name');

  if (!boxId && !boxName) {
    return NextResponse.json({ error: 'box_id or box_name required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  let box: any = null;
  if (boxId) {
    const { data } = await supabase.from('boxes').select('id, name, owner_id, plan, is_active').eq('id', boxId).single();
    box = data;
  } else if (boxName) {
    const { data } = await supabase.from('boxes').select('id, name, owner_id, plan, is_active').ilike('name', `%${boxName}%`).limit(1).single();
    box = data;
  }

  if (!box) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const { data: sub } = await (supabase.from as any)('box_subscriptions')
    .select('*')
    .eq('box_id', box.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    box: { id: box.id, name: box.name, plan: box.plan, is_active: box.is_active },
    subscription: sub ?? null,
  });
}
