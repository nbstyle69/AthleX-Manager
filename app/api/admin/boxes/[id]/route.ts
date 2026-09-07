import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { boxPlanInfo, type BoxSubscriptionTier } from '@/lib/boxPlanTier';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const supabase = createServiceClient();

  // Box info
  const { data: box } = await supabase
    .from('boxes')
    .select('*, owner:profiles!boxes_owner_id_fkey(id, username, role, level, elo)')
    .eq('id', id)
    .single();

  if (!box) return NextResponse.json({ error: 'Box not found' }, { status: 404 });

  const { data: subs } = await supabase
    .from('box_subscriptions')
    .select('box_id, status, plan_tier, current_period_end')
    .eq('box_id', id);

  // Members
  const { data: members } = await supabase
    .from('box_members')
    .select('*, profile:profiles!box_members_member_id_fkey(id, username, role, level, elo, total_matches, wins, created_at)')
    .eq('box_id', id)
    .order('joined_at', { ascending: true });

  // WODs (whiteboard) : liste limitée aux 50 derniers, compteur exact à part
  const [{ data: wods }, { count: wodCount }] = await Promise.all([
    supabase
      .from('box_wods')
      .select('*')
      .eq('box_id', id)
      .order('scheduled_date', { ascending: false })
      .limit(50),
    supabase
      .from('box_wods')
      .select('id', { count: 'exact', head: true })
      .eq('box_id', id),
  ]);

  // Scores for each WOD
  const wodIds = (wods ?? []).map((w: any) => w.id);
  let scores: any[] = [];
  if (wodIds.length > 0) {
    const { data: s } = await supabase
      .from('wod_scores')
      .select('*, profile:profiles!wod_scores_member_id_fkey(username, level)')
      .in('wod_id', wodIds)
      .order('score_value', { ascending: true });
    scores = s ?? [];
  }

  // Tournois de la box (table `tournaments`, celle du back-office gérant)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, description, status, format, max_participants, start_date, created_at')
    .eq('box_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    box: { ...box, ...boxPlanInfo((subs ?? []) as BoxSubscriptionTier[]) },
    members: members ?? [],
    wods: wods ?? [],
    wod_count: wodCount ?? (wods ?? []).length,
    scores: scores ?? [],
    competitions: tournaments ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.city !== undefined) updates.city = body.city;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.allowed_tournament_formats !== undefined) {
    const valid = ['simple','bracket','swiss','league_div'];
    const fmts = Array.isArray(body.allowed_tournament_formats)
      ? body.allowed_tournament_formats.filter((f: string) => valid.includes(f))
      : ['simple'];
    updates.allowed_tournament_formats = fmts.length > 0 ? fmts : ['simple'];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('boxes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
