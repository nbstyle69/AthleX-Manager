import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

// PATCH — update tournament status or score
export async function PATCH(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const body = await req.json();
  const { action, tournament_id, score_id, score_value, status: newStatus } = body;
  const service = createServiceClient();

  if (action === 'close') {
    const { error } = await service.from('daily_tournaments').update({ status: 'completed' }).eq('id', tournament_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel') {
    const { error } = await service.from('daily_tournaments').update({ status: 'cancelled' }).eq('id', tournament_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reopen') {
    const { error } = await service.from('daily_tournaments').update({ status: 'open' }).eq('id', tournament_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_score_status') {
    if (!score_id || !newStatus) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    const { error } = await service.from('daily_tournament_scores').update({ status: newStatus }).eq('id', score_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_score_value') {
    if (!score_id || score_value === undefined) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    const { error } = await service.from('daily_tournament_scores').update({ score_value: Number(score_value) }).eq('id', score_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete_score') {
    if (!score_id) return NextResponse.json({ error: 'Missing score_id' }, { status: 400 });
    const { error } = await service.from('daily_tournament_scores').delete().eq('id', score_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}

// DELETE — delete a tournament entirely
export async function DELETE(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from('daily_tournaments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
