'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Trophy, Users, CheckCircle, Loader2, Ban, Lock, Trash2, RefreshCw } from 'lucide-react';

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
  const router = useRouter();
  const [tournaments, setTournaments] = useState<DailyTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed' | 'cancelled'>('all');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('daily_tournaments')
      .select('*, creator:profiles!daily_tournaments_creator_id_fkey(username)')
      .order('created_at', { ascending: false })
      .limit(100);

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
          max_participants: t.max_players ?? t.max_participants,
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

  async function quickAction(action: string, tournamentId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (action === 'delete' && !confirm('Supprimer définitivement ce tournoi ?')) return;
    if (action === 'cancel' && !confirm('Annuler ce tournoi ? Il ne sera plus visible.')) return;
    setActionLoading(`${action}-${tournamentId}`);
    if (action === 'delete') {
      await fetch(`/api/admin/daily-tournaments?id=${tournamentId}`, { method: 'DELETE' });
    } else {
      await fetch('/api/admin/daily-tournaments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tournament_id: tournamentId }),
      });
    }
    setActionLoading(null);
    await load();
  }

  const statusColor = (s: string) =>
    s === 'open' ? 'text-emerald-400 bg-emerald-500/15' :
    s === 'completed' ? 'text-blue-400 bg-blue-500/15' :
    s === 'cancelled' ? 'text-red-400 bg-red-500/15' :
    'text-gray-400 bg-white/5';

  const statusLabel = (s: string) =>
    s === 'open' ? 'En cours' : s === 'completed' ? 'Terminé' : s === 'cancelled' ? 'Annulé' : s;

  const filtered = statusFilter === 'all' ? tournaments : tournaments.filter(t => t.status === statusFilter);
  const openCount = tournaments.filter(t => t.status === 'open').length;
  const completedCount = tournaments.filter(t => t.status === 'completed').length;
  const cancelledCount = tournaments.filter(t => t.status === 'cancelled').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Trophy size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Daily Tournaments</h1>
            <p className="text-sm text-gray-400">{filtered.length} / {tournaments.length} tournois</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Status filters */}
      <div className="flex gap-1 flex-wrap">
        {[
          { key: 'all' as const, label: `Tous (${tournaments.length})` },
          { key: 'open' as const, label: `En cours (${openCount})` },
          { key: 'completed' as const, label: `Terminés (${completedCount})` },
          { key: 'cancelled' as const, label: `Annulés (${cancelledCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === f.key ? 'bg-[#C9A227]/20 text-[#C9A227]' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#C9A227]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Trophy size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aucun tournoi {statusFilter !== 'all' ? `avec le statut "${statusLabel(statusFilter)}"` : 'créé'}.</p>
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
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(t => (
                <tr key={t.id} onClick={() => router.push(`/admin/tournaments/${t.id}`)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer">
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
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.status === 'open' && (
                        <>
                          <button onClick={(e) => quickAction('close', t.id, e)} disabled={!!actionLoading}
                            title="Forcer clôture"
                            className="p-1.5 rounded-lg hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 transition-colors disabled:opacity-50">
                            {actionLoading === `close-${t.id}` ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                          </button>
                          <button onClick={(e) => quickAction('cancel', t.id, e)} disabled={!!actionLoading}
                            title="Annuler (masquer)"
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50">
                            {actionLoading === `cancel-${t.id}` ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                          </button>
                        </>
                      )}
                      <button onClick={(e) => quickAction('delete', t.id, e)} disabled={!!actionLoading}
                        title="Supprimer"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50">
                        {actionLoading === `delete-${t.id}` ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
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
