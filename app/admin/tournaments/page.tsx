'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Users, Clock, CheckCircle } from 'lucide-react';

interface DailyTournament {
  id: string;
  wod_name: string;
  wod_type: string;
  score_mode: string;
  max_participants: number;
  status: string;
  elo_reward: number;
  created_at: string;
  creator_name: string;
  participant_count: number;
  score_count: number;
}

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<DailyTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('daily_tournaments')
      .select('*, creator:profiles!daily_tournaments_creator_id_fkey(username)')
      .order('created_at', { ascending: false })
      .limit(50);

    const mapped: DailyTournament[] = await Promise.all(
      (data ?? []).map(async (t: any) => {
        const creator = Array.isArray(t.creator) ? t.creator[0] : t.creator;

        const { count: pCount } = await supabase
          .from('daily_tournament_participants')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id);

        const { count: sCount } = await supabase
          .from('daily_tournament_scores')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id);

        return {
          id: t.id,
          wod_name: t.wod_name,
          wod_type: t.wod_type,
          score_mode: t.score_mode,
          max_participants: t.max_participants,
          status: t.status,
          elo_reward: t.elo_reward,
          created_at: t.created_at,
          creator_name: creator?.username ?? 'Inconnu',
          participant_count: pCount ?? 0,
          score_count: sCount ?? 0,
        };
      })
    );
    setTournaments(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusColor = (s: string) =>
    s === 'open' ? 'text-emerald-400 bg-emerald-500/15' :
    s === 'completed' ? 'text-blue-400 bg-blue-500/15' :
    'text-gray-400 bg-white/5';

  const statusLabel = (s: string) =>
    s === 'open' ? 'En cours' : s === 'completed' ? 'Terminé' : s;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Trophy size={22} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Daily Tournaments</h1>
          <p className="text-sm text-gray-400">{tournaments.length} tournois</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20">
          <Trophy size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aucun tournoi créé.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-left">
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">WOD</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Créateur</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Participants</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Scores</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ELO</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tournaments.map(t => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-white">{t.wod_name}</p>
                    <p className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300">{t.creator_name}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold text-gray-400 uppercase">{t.wod_type}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-gray-500" />
                      <span className="text-gray-300">{t.participant_count}/{t.max_participants}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={13} className="text-gray-500" />
                      <span className="text-gray-300">{t.score_count}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-black text-yellow-500">+{t.elo_reward}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
