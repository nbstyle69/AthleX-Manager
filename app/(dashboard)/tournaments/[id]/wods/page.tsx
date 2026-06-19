import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import TournamentWODManager from '@/components/tournaments/TournamentWODManager';
import { ChevronLeft, Trophy } from 'lucide-react';

export default async function TournamentWODsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, level, status, format, current_season, max_participants')
    .eq('id', id)
    .eq('box_id', box.id)
    .single();

  if (!tournament) redirect('/tournaments');

  const isBracket = tournament.format === 'bracket' || tournament.format === 'swiss';
  // Bracket stages encoded as distance-to-final (0 = Finale). Options derived
  // from max_participants; displayed earliest stage first (e.g. 16e -> Finale).
  const STAGE_LABELS = ['Finale', 'Demi-finale', 'Quart de finale', '8e de finale', '16e de finale', '32e de finale'];
  const totalStages = Math.max(1, Math.ceil(Math.log2(Math.max(2, tournament.max_participants ?? 2))));
  const bracketStages = isBracket
    ? Array.from({ length: totalStages }, (_, i) => ({ value: i, label: STAGE_LABELS[i] ?? `${i} tours avant la finale` }))
        .sort((a, b) => b.value - a.value)
    : [];

  const [{ data: wods }, { data: divisions }] = await Promise.all([
    supabase.from('tournament_wods').select('*').eq('tournament_id', id).order('created_at'),
    supabase.from('tournament_divisions').select('id, name, level').eq('tournament_id', id).order('level'),
  ]);

  const isLeague = tournament.format === 'league_div';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#C9A227]" />
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
            Configurez les WODs du tournoi · <span className="text-[#C9A227] font-semibold">{tournament.level?.toUpperCase()}</span>
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
        currentSeason={tournament.current_season ?? 1}
      />
    </div>
  );
}
