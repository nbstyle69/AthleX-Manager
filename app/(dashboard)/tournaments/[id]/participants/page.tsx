import { createClient, createServiceClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Star, Building2, CalendarDays, ShieldAlert } from 'lucide-react';
import KickButton from './KickButton';

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  scaled: { bg: 'bg-gray-500/20',   text: 'text-gray-400'   },
  inter:  { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  rx:     { bg: 'bg-[#C9A227]/20',  text: 'text-[#C9A227]'  },
  'rx+':  { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  gx:     { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  pro:    { bg: 'bg-red-500/20',    text: 'text-red-400'    },
};

export default async function TournamentParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params;
  const userClient = await createClient();
  const box = await getOwnerBox(userClient);
  if (!box) redirect('/login');

  const svc = createServiceClient();
  const [{ data: tournament }, { data: tp }] = await Promise.all([
    svc.from('tournaments').select('name, box_id').eq('id', tournamentId).single(),
    svc.from('tournament_participants')
      .select('athlete_id, score, created_at, profile:profiles!tournament_participants_athlete_id_fkey(username, level, elo, box_members(box:boxes(name)))')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true }),
  ]);

  if (!tournament || (tournament as any).box_id !== box.id) redirect('/tournaments');

  const participants = (tp ?? []).map((p: any) => ({
    ...p,
    profile: Array.isArray(p.profile) ? p.profile[0] ?? null : p.profile,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Users size={18} className="text-blue-400" />
            Participants — {(tournament as any).name}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{participants.length} inscrit(s)</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <ShieldAlert size={14} className="text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300 font-semibold">
          Mode admin — cliquer sur "Exclure" pour retirer un participant du tournoi.
        </p>
      </div>

      {participants.length === 0 ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-16 text-center">
          <Users size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">Aucun inscrit</p>
          <p className="text-gray-500 text-sm mt-1">Les inscriptions apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {participants.map((p: any, i: number) => {
            const lvl = (p.profile?.level ?? 'rx').toLowerCase();
            const lc  = LEVEL_COLORS[lvl] ?? LEVEL_COLORS.rx;
            const boxName = p.profile?.box_members?.[0]?.box?.name ?? null;
            const regDate = new Date(p.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric',
            });
            return (
              <div key={p.athlete_id}
                className="bg-[#111111] border border-white/8 rounded-2xl p-4 flex items-center gap-4 hover:border-white/15 transition-colors">
                <span className="text-sm font-black text-gray-600 w-6 text-center shrink-0">#{i + 1}</span>
                <div className={`w-11 h-11 rounded-full ${lc.bg} flex items-center justify-center shrink-0`}>
                  <span className={`text-lg font-black ${lc.text}`}>
                    {(p.profile?.username ?? '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white truncate">{p.profile?.username ?? '?'}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${lc.bg} ${lc.text}`}>
                      {lvl.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Star size={10} className="text-[#C9A227]" />
                      ELO {p.profile?.elo ?? 1000}
                    </span>
                    {boxName && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Building2 size={10} className="text-gray-500" />
                        {boxName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <CalendarDays size={10} />
                      Inscrit le {regDate}
                    </span>
                  </div>
                </div>
                {p.score > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-[#C9A227]">{p.score}</p>
                    <p className="text-[10px] text-gray-500">pts</p>
                  </div>
                )}
                <KickButton
                  tournamentId={tournamentId}
                  athleteId={p.athlete_id}
                  username={p.profile?.username ?? '?'}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
