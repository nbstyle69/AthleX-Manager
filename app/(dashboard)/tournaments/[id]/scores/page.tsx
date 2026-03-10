import { createServiceClient, getOwnerBox, createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ScoresClient, { ScoreRow } from './ScoresClient';

export default async function TournamentScoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params;

  const userClient = await createClient();
  const box = await getOwnerBox(userClient);
  if (!box) redirect('/login');

  const svc = createServiceClient();

  const [{ data: tournament }, { data: rawScores }] = await Promise.all([
    svc.from('tournaments').select('name, box_id').eq('id', tournamentId).single(),
    svc.from('tournament_scores')
      .select('id, score_value, submitted_at, status, video_url, notes, admin_message, athlete_id, tournament_wod_id, tw:tournament_wods(title)')
      .eq('tournament_id', tournamentId)
      .order('submitted_at', { ascending: false }),
  ]);

  if (!tournament || (tournament as any).box_id !== box.id) redirect('/tournaments');

  const athleteIds = [...new Set((rawScores ?? []).map((s: any) => s.athlete_id))];
  let profileMap: Record<string, { username: string; level: string }> = {};
  if (athleteIds.length > 0) {
    const { data: profs } = await svc.from('profiles').select('id, username, level').in('id', athleteIds);
    (profs ?? []).forEach((p: any) => { profileMap[p.id] = { username: p.username, level: p.level }; });
  }

  const scores: ScoreRow[] = (rawScores ?? []).map((s: any) => ({
    id:               s.id,
    score_value:      s.score_value,
    submitted_at:     s.submitted_at,
    status:           s.status,
    video_url:        s.video_url ?? null,
    notes:            s.notes ?? null,
    admin_message:    s.admin_message ?? null,
    athlete_id:       s.athlete_id,
    tournament_wod_id: s.tournament_wod_id,
    username:         profileMap[s.athlete_id]?.username ?? null,
    level:            profileMap[s.athlete_id]?.level    ?? null,
    wod_title:        (Array.isArray(s.tw) ? s.tw[0] : s.tw)?.title ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-black text-white">Scores — {(tournament as any).name}</h1>
      </div>

      <ScoresClient tournamentId={tournamentId} initialScores={scores} />
    </div>
  );
}
