import { getTournamentForActiveBox } from '@/lib/tournaments/getTournamentForActiveBox';
import Link from 'next/link';
import TournamentWODManager from '@/components/tournaments/TournamentWODManager';
import { ChevronLeft, Trophy } from 'lucide-react';
import { stageOptions, type StageRow } from '@/lib/tournaments/wodStages';

export default async function TournamentWODsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tournament, userClient: supabase } = await getTournamentForActiveBox<Record<string, any>>(
    id, 'id, name, level, status, format, current_season, max_participants, registrations_open_during_tournament',
  );

  const isBracket = tournament.format === 'bracket' || tournament.format === 'swiss';
  // Étapes à proposer, dans l'ordre et avec leurs libellés : la base les rend
  // (tableau, étape, petite finale si le tournoi l'a), lib/tournaments/wodStages.ts.
  const [{ data: wods }, { data: divisions }, stages] = await Promise.all([
    supabase.from('tournament_wods').select('*').eq('tournament_id', id).order('created_at'),
    supabase.from('tournament_divisions').select('id, name, level').eq('tournament_id', id).order('level'),
    isBracket ? supabase.rpc('tournament_bracket_stages', { p_tournament_id: id }) : Promise.resolve({ data: [], error: null }),
  ]);
  const bracketStages = stageOptions((stages.data ?? []) as StageRow[]);
  const stagesUnavailable = isBracket && !!stages.error;

  const isLeague = tournament.format === 'league_div';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-white" />
          <span className="text-sm text-gray-400">{tournament.name}</span>
          <span className="text-gray-600">/</span>
          <span className="text-sm font-bold text-white">WODs</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Programme des WODs</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configurez les WODs du tournoi · <span className="text-white font-semibold">{tournament.level?.toUpperCase()}</span>
          </p>
        </div>
        <Link href={`/tournaments/${id}`}
          className="text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-colors">
          Infos du tournoi
        </Link>
      </div>

      {/* WOD Manager */}
      <TournamentWODManager
        tournamentId={id}
        initialWODs={wods ?? []}
        divisions={(divisions ?? []) as any}
        isLeague={isLeague}
        isBracket={isBracket}
        bracketStages={bracketStages}
        stagesUnavailable={stagesUnavailable}
        currentSeason={tournament.current_season ?? 1}
        registrationsOpen={tournament.registrations_open_during_tournament === true}
      />
    </div>
  );
}
