import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const boxId = req.nextUrl.searchParams.get('box_id');
  const boxName = req.nextUrl.searchParams.get('box_name');

  const supabase = createServiceClient();

  // No params → list all boxes with their subscription
  if (!boxId && !boxName) {
    const { data: boxes } = await supabase
      .from('boxes')
      .select('id, name, owner_id, plan, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    const results = [];
    for (const b of boxes ?? []) {
      const { data: sub } = await (supabase.from as any)('box_subscriptions')
        .select('status, stripe_customer_id, stripe_subscription_id, trial_ends_at, is_early_adopter, current_period_end')
        .eq('box_id', b.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      results.push({ box: b, subscription: sub ?? null });
    }
    return NextResponse.json(results);
  }

  let box: any = null;
  if (boxId) {
    const { data } = await supabase.from('boxes').select('id, name, owner_id, plan, is_active').eq('id', boxId).maybeSingle();
    box = data;
  } else if (boxName) {
    const { data } = await supabase.from('boxes').select('id, name, owner_id, plan, is_active').ilike('name', `%${boxName}%`).limit(1);
    box = data?.[0] ?? null;
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
