import { createServiceClient, createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import LeaderboardClient from './LeaderboardClient';

export interface ParticipantRow {
  rank: number;
  athlete_id: string;
  total_score: number;
  username: string | null;
  level: string | null;
  elo: number | null;
}

export interface WodRanking {
  wod_id: string;
  wod_title: string;
  order_index: number;
  scores: { rank: number; athlete_id: string; score_value: string; username: string | null; level: string | null }[];
}

export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params;

  const userClient = await createClient();
  const box = await getOwnerBox(userClient);
  if (!box) redirect('/login');

  const svc = createServiceClient();

  const [{ data: tournament }, { data: rawParticipants }, { data: wods }, { data: validatedScores }] = await Promise.all([
    svc.from('tournaments').select('name, box_id').eq('id', tournamentId).single(),
    svc.from('tournament_participants').select('athlete_id, score').eq('tournament_id', tournamentId).order('score', { ascending: false }),
    svc.from('tournament_wods').select('id, title, order_index').eq('tournament_id', tournamentId).order('order_index'),
    svc.from('tournament_scores').select('athlete_id, tournament_wod_id, score_value').eq('tournament_id', tournamentId).eq('status', 'validated'),
  ]);

  if (!tournament || (tournament as any).box_id !== box.id) redirect('/tournaments');

  const athleteIds = [...new Set((rawParticipants ?? []).map((p: any) => p.athlete_id))];
  let profileMap: Record<string, { username: string; level: string; elo: number }> = {};
  if (athleteIds.length > 0) {
    const { data: profs } = await svc.from('profiles').select('id, username, level, elo').in('id', athleteIds);
    (profs ?? []).forEach((p: any) => { profileMap[p.id] = { username: p.username, level: p.level, elo: p.elo }; });
  }

  const general: ParticipantRow[] = (rawParticipants ?? []).map((p: any, i: number) => ({
    rank:        i + 1,
    athlete_id:  p.athlete_id,
    total_score: p.score ?? 0,
    username:    profileMap[p.athlete_id]?.username ?? null,
    level:       profileMap[p.athlete_id]?.level    ?? null,
    elo:         profileMap[p.athlete_id]?.elo       ?? null,
  }));

  const wodRankings: WodRanking[] = (wods ?? []).map((wod: any) => {
    const wodScores = (validatedScores ?? [])
      .filter((s: any) => s.tournament_wod_id === wod.id)
      .sort((a: any, b: any) => parseFloat(b.score_value) - parseFloat(a.score_value))
      .map((s: any, i: number) => ({
        rank:        i + 1,
        athlete_id:  s.athlete_id,
        score_value: s.score_value,
        username:    profileMap[s.athlete_id]?.username ?? null,
        level:       profileMap[s.athlete_id]?.level    ?? null,
      }));
    return { wod_id: wod.id, wod_title: wod.title, order_index: wod.order_index, scores: wodScores };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`}
          className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Trophy size={16} className="text-[#C9A227]" />
        <h1 className="text-xl font-black text-white">Classement — {(tournament as any).name}</h1>
      </div>

      <LeaderboardClient general={general} wodRankings={wodRankings} />
    </div>
  );
}
