'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Users, Star, Building2, CalendarDays, UserX, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  scaled: { bg: 'bg-gray-500/20',   text: 'text-gray-400'   },
  inter:  { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  rx:     { bg: 'bg-[#C9A227]/20',  text: 'text-[#C9A227]'  },
  'rx+':  { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  gx:     { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  pro:    { bg: 'bg-red-500/20',    text: 'text-red-400'    },
};

interface Participant {
  athlete_id: string;
  score: number;
  created_at: string;
  profile: {
    username: string;
    level: string;
    elo: number;
    box_members: { box: { name: string } | null }[];
  } | null;
}

export default function TournamentParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = use(params);
  const supabase = createClient();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tournament,   setTournament]   = useState<{ name: string } | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [kicking,      setKicking]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: tp }] = await Promise.all([
      supabase.from('tournaments').select('name').eq('id', tournamentId).single(),
      supabase.from('tournament_participants')
        .select('athlete_id, score, created_at, profile:profiles(username, level, elo, box_members(box:boxes(name)))')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true }),
    ]);
    setTournament(t);
    setParticipants((tp ?? []).map((p: any) => ({
      ...p,
      profile: Array.isArray(p.profile) ? p.profile[0] ?? null : p.profile,
    })));
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  async function handleKick(athleteId: string, username: string) {
    if (!confirm(`Exclure ${username} du tournoi ?`)) return;
    setKicking(athleteId);
    await supabase.from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('athlete_id', athleteId);
    setParticipants(prev => prev.filter(p => p.athlete_id !== athleteId));
    setKicking(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Users size={18} className="text-blue-400" />
            Participants — {tournament?.name ?? '…'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{participants.length} inscrit(s)</p>
        </div>
      </div>

      {/* Admin notice */}
      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <ShieldAlert size={14} className="text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300 font-semibold">
          Mode admin — cliquer sur <UserX size={11} className="inline" /> pour exclure un participant du tournoi.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={28} className="animate-spin text-[#C9A227] mx-auto" />
        </div>
      ) : participants.length === 0 ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-16 text-center">
          <Users size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">Aucun inscrit</p>
          <p className="text-gray-500 text-sm mt-1">Les inscriptions apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {participants.map((p, i) => {
            const lvl = (p.profile?.level ?? 'rx').toLowerCase();
            const lc  = LEVEL_COLORS[lvl] ?? LEVEL_COLORS.rx;
            const boxName = p.profile?.box_members?.[0]?.box?.name ?? null;
            const regDate = new Date(p.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric',
            });

            return (
              <div key={p.athlete_id}
                className="bg-[#111111] border border-white/8 rounded-2xl p-4 flex items-center gap-4 hover:border-white/15 transition-colors">

                {/* Rank */}
                <span className="text-sm font-black text-gray-600 w-6 text-center shrink-0">#{i + 1}</span>

                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full ${lc.bg} flex items-center justify-center shrink-0`}>
                  <span className={`text-lg font-black ${lc.text}`}>
                    {(p.profile?.username ?? '?')[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white truncate">
                      {p.profile?.username ?? '?'}
                    </span>
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

                {/* Score badge */}
                {p.score > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-[#C9A227]">{p.score}</p>
                    <p className="text-[10px] text-gray-500">pts</p>
                  </div>
                )}

                {/* Kick button */}
                <button
                  onClick={() => handleKick(p.athlete_id, p.profile?.username ?? '?')}
                  disabled={kicking === p.athlete_id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Exclure du tournoi">
                  {kicking === p.athlete_id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <UserX size={13} />}
                  Exclure
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
