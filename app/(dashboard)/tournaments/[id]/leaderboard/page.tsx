import { divisionIdsOf, getTournamentForActiveBox } from '@/lib/tournaments/getTournamentForActiveBox';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import LeaderboardClient from './LeaderboardClient';
import { computeBracketStandings, type BracketMatchRow } from '@/lib/bracket';
import { SCALE_NOTE, generalFromBase, requestedSeason, seasonOptions, wodRankingsFromBase, type StandingRow, type WodRankRow } from '@/lib/tournaments/standings';
import { GENERIC_REFUSAL } from '@/lib/tournaments/refusals';
import type { ParticipantRow, WodRanking, DivisionRanking } from './types';

// Toujours relu : un score validé ou rejeté change le classement de la base.
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saison?: string }> }) {
  const { id: tournamentId } = await params;
  const { saison } = await searchParams;

  // Appartenance à la box active vérifiée AVANT toute lecture privilégiée :
  // les huit requêtes ci-dessous ignorent la RLS, et elles s'exécutaient
  // auparavant avant le contrôle.
  const { tournament, svc } = await getTournamentForActiveBox<Record<string, any>>(tournamentId);

  // `tournament_division_members` n'a pas de `tournament_id` : on le borne par
  // les divisions de CE tournoi, au lieu de lire la table entière et de trier
  // en mémoire.
  const divisionIds = await divisionIdsOf(svc, tournamentId);

  const [{ data: rawParticipants }, { data: wods }, { data: validatedScores }, { data: divisionsRaw }, { data: divMembersRaw }, { data: bracketMatches }, { data: eloHistory }] = await Promise.all([
    svc.from('tournament_participants').select('athlete_id').eq('tournament_id', tournamentId),
    svc.from('tournament_wods').select('id, title, order_index, type').eq('tournament_id', tournamentId).order('order_index'),
    svc.from('tournament_scores').select('athlete_id, tournament_wod_id, score_value, capped, tiebreak_value').eq('tournament_id', tournamentId).eq('status', 'validated'),
    svc.from('tournament_divisions').select('*').eq('tournament_id', tournamentId).order('level'),
    divisionIds.length > 0
      ? svc.from('tournament_division_members').select('division_id, athlete_id, points, rank').in('division_id', divisionIds).order('points', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    svc.from('tournament_bracket_matches').select('round, side, participant1_id, participant2_id, winner_id, loser_id, status').eq('tournament_id', tournamentId),
    svc.from('tournament_elo_history').select('athlete_id, elo_change, final_rank').eq('tournament_id', tournamentId),
  ]);

  const format = (tournament as any).format;
  const isBracket = format === 'bracket' || format === 'swiss';
  const isLeague = format === 'league_div';
  const currentSeason = (tournament as any).current_season ?? 1;
  // Ligue : saison en cours, ou une saison terminée choisie (`?saison=n`).
  const season = isLeague ? requestedSeason(saison, currentSeason) : null;

  // Classement calculé par la base (barème 100, 97, 95…, rang de compétition) :
  // le Manager n'a plus de barème (athlex-app #359 à #365).
  const [{ data: standingsRaw, error: standingsError }, { data: wodRanksRaw, error: wodRanksError }] = await Promise.all([
    isBracket
      ? Promise.resolve({ data: [] as StandingRow[], error: null })
      : isLeague
        ? svc.rpc('tournament_ligue_standings', { p_tournament_id: tournamentId, p_season: season })
        : svc.rpc('tournament_classique_standings', { p_tournament_id: tournamentId }),
    svc.rpc('tournament_classique_wod_ranks', { p_tournament_id: tournamentId }),
  ]);
  const loadError = standingsError || wodRanksError ? GENERIC_REFUSAL : null;
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
    : generalFromBase((standingsRaw ?? []) as StandingRow[], profileMap, eloChangeById);

  const wodRankings: WodRanking[] = wodRankingsFromBase(
    (wods ?? []) as { id: string; title: string; order_index: number; type: string | null }[],
    (wodRanksRaw ?? []) as WodRankRow[],
    (validatedScores ?? []) as { athlete_id: string; tournament_wod_id: string; score_value: string; capped: boolean | null }[],
    profileMap,
  );

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

      {isLeague && currentSeason > 1 && (
        <nav aria-label="Saison du classement général" className="flex flex-wrap gap-1 p-1 rounded-ax-control border border-ax-border w-fit">
          {seasonOptions(currentSeason).map(o => (
            <Link key={o.label} data-testid={o.season == null ? 'saison-en-cours' : `saison-${o.season}`}
              href={o.season == null ? `/tournaments/${tournamentId}/leaderboard` : `/tournaments/${tournamentId}/leaderboard?saison=${o.season}`}
              aria-current={season === o.season ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-ax-control text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus ${season === o.season ? 'bg-ax-accent-soft text-ax-accent-text' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'}`}>
              {o.label}
            </Link>
          ))}
        </nav>
      )}

      {!isBracket && (
        <p data-testid="bareme-classement" className="text-xs text-ax-text-secondary">Rang · Points · {SCALE_NOTE}</p>
      )}
      {loadError && (
        <p role="alert" className="rounded-ax-control border border-ax-danger bg-ax-danger-soft px-4 py-3 text-sm text-ax-danger">{loadError}</p>
      )}

      <LeaderboardClient
        general={general}
        wodRankings={wodRankings}
        divisionRankings={isLeague ? divisionRankings : []}
      />
    </div>
  );
}
