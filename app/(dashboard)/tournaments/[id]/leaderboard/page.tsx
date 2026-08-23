import { createServiceClient, createClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import LeaderboardClient from './LeaderboardClient';
import { computeBracketStandings, type BracketMatchRow } from '@/lib/bracket';
import { rankWodScores, formatWodScore } from '@/lib/tournamentScoring';

export interface ParticipantRow {
  rank: number;
  athlete_id: string;
  total_score: number;
  username: string | null;
  level: string | null;
  elo: number | null;
  placement?: string | null;
  elo_change?: number | null;
}

export interface WodRanking {
  wod_id: string;
  wod_title: string;
  order_index: number;
  scores: {
    rank: number;
    athlete_id: string;
    score_value: string;
    score_display: string;
    is_ex_aequo: boolean;
    username: string | null;
    level: string | null;
  }[];
}

export interface DivisionRanking {
  division_id: string;
  name: string;
  level: number;
  promote_count: number;
  relegate_count: number;
  rows: ParticipantRow[];
}

export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params;

  const userClient = await createClient();
  const box = await getActiveBox(userClient);
  if (!box) redirect('/login');

  const svc = createServiceClient();

  const [{ data: tournament }, { data: rawParticipants }, { data: wods }, { data: validatedScores }, { data: divisionsRaw }, { data: divMembersRaw }, { data: bracketMatches }, { data: eloHistory }] = await Promise.all([
    svc.from('tournaments').select('*').eq('id', tournamentId).single(),
    svc.from('tournament_participants').select('athlete_id, score').eq('tournament_id', tournamentId).order('score', { ascending: false }),
    svc.from('tournament_wods').select('id, title, order_index, type').eq('tournament_id', tournamentId).order('order_index'),
    svc.from('tournament_scores').select('athlete_id, tournament_wod_id, score_value, capped, tiebreak_value').eq('tournament_id', tournamentId).eq('status', 'validated'),
    svc.from('tournament_divisions').select('*').eq('tournament_id', tournamentId).order('level'),
    svc.from('tournament_division_members').select('division_id, athlete_id, points, rank').order('points', { ascending: false }),
    svc.from('tournament_bracket_matches').select('round, side, participant1_id, participant2_id, winner_id, loser_id, status').eq('tournament_id', tournamentId),
    svc.from('tournament_elo_history').select('athlete_id, elo_change, final_rank').eq('tournament_id', tournamentId),
  ]);

  if (!tournament || (tournament as any).box_id !== box.id) redirect('/tournaments');

  const format = (tournament as any).format;
  const isBracket = format === 'bracket' || format === 'swiss';
  const eloChangeById: Record<string, number> = {};
  (eloHistory ?? []).forEach((h: any) => { eloChangeById[h.athlete_id] = h.elo_change; });

  // Include athletes found only in bracket matches (robustness for double-elim seeding).
  const bracketAthleteIds = (bracketMatches ?? []).flatMap((m: any) => [m.participant1_id, m.participant2_id]).filter(Boolean);
  const athleteIds = [...new Set([...(rawParticipants ?? []).map((p: any) => p.athlete_id), ...bracketAthleteIds])];
  let profileMap: Record<string, { username: string; level: string; elo: number }> = {};
  if (athleteIds.length > 0) {
    const { data: profs } = await svc.from('profiles').select('id, username, level, elo').in('id', athleteIds);
    (profs ?? []).forEach((p: any) => { profileMap[p.id] = { username: p.username, level: p.level, elo: p.elo }; });
  }

  const bracketStandings = isBracket
    ? computeBracketStandings((bracketMatches ?? []) as BracketMatchRow[], format === 'swiss')
    : [];

  const general: ParticipantRow[] = bracketStandings.length > 0
    ? bracketStandings.map(s => ({
        rank:        s.rank,
        athlete_id:  s.athlete_id,
        total_score: 0,
        username:    profileMap[s.athlete_id]?.username ?? null,
        level:       profileMap[s.athlete_id]?.level    ?? null,
        elo:         profileMap[s.athlete_id]?.elo       ?? null,
        placement:   s.placement,
        elo_change:  eloChangeById[s.athlete_id] ?? null,
      }))
    : (rawParticipants ?? []).map((p: any, i: number) => ({
        rank:        i + 1,
        athlete_id:  p.athlete_id,
        total_score: p.score ?? 0,
        username:    profileMap[p.athlete_id]?.username ?? null,
        level:       profileMap[p.athlete_id]?.level    ?? null,
        elo:         profileMap[p.athlete_id]?.elo       ?? null,
        elo_change:  eloChangeById[p.athlete_id] ?? null,
      }));

  const wodRankings: WodRanking[] = (wods ?? []).map((wod: any) => {
    const rows = (validatedScores ?? [])
      .filter((s: any) => s.tournament_wod_id === wod.id)
      .map((s: any) => ({
        athlete_id:     s.athlete_id as string,
        score_value:    s.score_value as string,
        capped:         (s.capped ?? null) as boolean | null,
        tiebreak_value: (s.tiebreak_value ?? null) as number | null,
      }));
    const wodScores = rankWodScores(rows, wod.type).map((r) => ({
      rank:          r.rank,
      athlete_id:    r.score.athlete_id,
      score_value:   r.score.score_value,
      score_display: formatWodScore(r.score.score_value, r.score.capped, wod.type),
      is_ex_aequo:   r.isExAequo,
      username:      profileMap[r.score.athlete_id]?.username ?? null,
      level:         profileMap[r.score.athlete_id]?.level    ?? null,
    }));
    return { wod_id: wod.id, wod_title: wod.title, order_index: wod.order_index, scores: wodScores };
  });

  // Build per-division rankings if league_div
  const divisionRankings: DivisionRanking[] = (divisionsRaw ?? []).map((d: any) => {
    const memberRows = (divMembersRaw ?? [])
      .filter((m: any) => m.division_id === d.id)
      .sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0) || (a.rank ?? 999) - (b.rank ?? 999))
      .map((m: any, i: number): ParticipantRow => ({
        rank:        i + 1,
        athlete_id:  m.athlete_id,
        total_score: m.points ?? 0,
        username:    profileMap[m.athlete_id]?.username ?? null,
        level:       profileMap[m.athlete_id]?.level    ?? null,
        elo:         profileMap[m.athlete_id]?.elo       ?? null,
      }));
    return {
      division_id:    d.id,
      name:           d.name,
      level:          d.level,
      promote_count:  d.promote_count ?? 0,
      relegate_count: d.relegate_count ?? 0,
      rows:           memberRows,
    };
  });

  const isLeague = (tournament as any).format === 'league_div';
  const currentSeason = (tournament as any).current_season ?? 1;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`}
          className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Trophy size={16} className="text-white" />
        <h1 className="text-xl font-black text-white">Classement — {(tournament as any).name}</h1>
        {isLeague && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300">
            Saison {currentSeason}
          </span>
        )}
      </div>

      <LeaderboardClient
        general={general}
        wodRankings={wodRankings}
        divisionRankings={isLeague ? divisionRankings : []}
      />
    </div>
  );
}
