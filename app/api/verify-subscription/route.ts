import { NextRequest, NextResponse } from 'next/server';
import { requireBoxOwner } from '@/lib/requireBoxOwner';
import { syncBoxSubscriptionFromStripe } from '@/lib/syncBoxSubscription';

export async function POST(req: NextRequest) {
  try {
    const { box_id } = await req.json();

    const guard = await requireBoxOwner(box_id);
    if (!guard.ok) return guard.response;

    const result = await syncBoxSubscriptionFromStripe(guard.service, box_id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('verify-subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
