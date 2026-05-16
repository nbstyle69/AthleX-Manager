import { createClient, createServiceClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Dumbbell, Users, BarChart2, Trophy, Pencil, ClipboardCheck, GitBranch, Layers } from 'lucide-react';
import CloseTournamentButton from '@/components/tournaments/CloseTournamentButton';
import DeleteTournamentButton from '@/components/tournaments/DeleteTournamentButton';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Brouillon',              color: '#6B7280' },
  open:     { label: 'Inscriptions ouvertes',  color: '#3B82F6' },
  active:   { label: 'En cours',               color: '#16A34A' },
  finished: { label: 'Terminé',                color: '#C9A227' },
};

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: t } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .eq('box_id', box.id)
    .single();

  if (!t) redirect('/tournaments');

  const svc = createServiceClient();
  const [{ count: wodCount }, { count: participantCount }, { count: pendingCount }, { count: totalScores }] = await Promise.all([
    supabase.from('tournament_wods').select('*', { count: 'exact', head: true }).eq('tournament_id', id),
    supabase.from('tournament_participants').select('*', { count: 'exact', head: true }).eq('tournament_id', id),
    svc.from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', id).eq('status', 'pending'),
    svc.from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', id),
  ]);

  const st = STATUS_MAP[t.status] ?? STATUS_MAP.draft;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#C9A227]" />
          <span className="text-sm font-bold text-white">{t.name}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ backgroundColor: `${st.color}20`, color: st.color }}>
                {st.label}
              </span>
              <span className="text-xs text-gray-500 font-semibold uppercase">{t.level}</span>
            </div>
            <h1 className="text-2xl font-black text-white mb-1">{t.name}</h1>
            {t.description && <p className="text-sm text-gray-400">{t.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              {t.start_date && <span>Début : {new Date(t.start_date).toLocaleDateString('fr-FR')}</span>}
              {t.end_date   && <span>Fin : {new Date(t.end_date).toLocaleDateString('fr-FR')}</span>}
              {t.max_participants && <span>Max {t.max_participants} participants</span>}
              {t.prize && <span>🏆 {t.prize}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CloseTournamentButton
              tournamentId={id}
              pendingCount={pendingCount ?? 0}
              status={t.status}
            />
            <Link href={`/tournaments/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
              <Pencil size={12} /> Modifier
            </Link>
            <DeleteTournamentButton tournamentId={id} />
          </div>
        </div>
      </div>

      {/* Quick nav tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href={`/tournaments/${id}/wods`}
          className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-[#C9A227]/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 flex items-center justify-center mb-3">
            <Dumbbell size={18} className="text-[#C9A227]" />
          </div>
          <p className="text-white font-bold text-lg">{wodCount ?? 0}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">WODs configurés</p>
        </Link>

        <Link href={`/tournaments/${id}/participants`}
          className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-[#C9A227]/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center mb-3">
            <Users size={18} className="text-blue-400" />
          </div>
          <p className="text-white font-bold text-lg">{participantCount ?? 0}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">Participants</p>
        </Link>

        <Link href={`/tournaments/${id}/scores`}
          className="relative bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-amber-500/30 transition-colors group">
          {(pendingCount ?? 0) > 0 && (
            <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mb-3">
            <ClipboardCheck size={18} className="text-amber-400" />
          </div>
          <p className="text-white font-bold text-lg">{totalScores ?? 0}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">Scores à valider</p>
        </Link>

        <Link href={`/tournaments/${id}/leaderboard`}
          className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-[#C9A227]/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center mb-3">
            <BarChart2 size={18} className="text-green-400" />
          </div>
          <p className="text-white font-bold text-lg">Classement</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">Leaderboard</p>
        </Link>
      </div>

      {/* Format-specific section */}
      {(t.format === 'bracket' || t.format === 'swiss') && (
        <Link href={`/tournaments/${id}/bracket`}
          className="block bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-[#C9A227]/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <GitBranch size={20} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Tableau du bracket</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.format === 'swiss' ? 'Winner Bracket + Loser Bracket + Grande finale' : 'Élimination directe'}
                {t.require_video_proof ? ' · preuve vidéo requise' : ''}
              </p>
            </div>
          </div>
        </Link>
      )}
      {t.format === 'league_div' && (
        <Link href={`/tournaments/${id}/divisions`}
          className="block bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-[#C9A227]/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Layers size={20} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Divisions</p>
              <p className="text-xs text-gray-500 mt-0.5">Standings, gestion des athlètes, promotion/relégation</p>
            </div>
          </div>
        </Link>
      )}

      {/* Règlement */}
      {t.rules && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Règlement</h2>
          <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">{t.rules}</pre>
        </div>
      )}
    </div>
  );
}
