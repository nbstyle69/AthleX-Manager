import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Box info
  const { data: box } = await supabase
    .from('boxes')
    .select('*, owner:profiles!boxes_owner_id_fkey(id, username, role, level, elo)')
    .eq('id', id)
    .single();

  if (!box) return NextResponse.json({ error: 'Box not found' }, { status: 404 });

  // Members
  const { data: members } = await supabase
    .from('box_members')
    .select('*, profile:profiles!box_members_member_id_fkey(id, username, role, level, elo, total_matches, wins, created_at)')
    .eq('box_id', id)
    .order('joined_at', { ascending: true });

  // WODs (whiteboard)
  const { data: wods } = await supabase
    .from('box_wods')
    .select('*')
    .eq('box_id', id)
    .order('scheduled_date', { ascending: false })
    .limit(50);

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

  // Competitions
  const { data: competitions } = await supabase
    .from('competitions')
    .select('*')
    .eq('box_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    box,
    members: members ?? [],
    wods: wods ?? [],
    scores: scores ?? [],
    competitions: competitions ?? [],
  });
}
