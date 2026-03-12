'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Swords, CheckCircle, XCircle, Youtube, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

interface ContestedScore {
  id: string;
  tournament_id: string;
  user_id: string;
  score_value: number;
  rx: boolean;
  video_url: string | null;
  status: string;
  contest_reason: string | null;
  contested_by: string | null;
  submitted_at: string;
  tournament_name: string;
  score_mode: string;
  athlete_name: string;
  contester_name: string;
}

export default function DailyContestsPage() {
  const [scores, setScores] = useState<ContestedScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('daily_tournament_scores')
      .select('*, tournament:daily_tournaments(wod_name, score_mode), profile:profiles!daily_tournament_scores_user_id_profiles_fkey(username), contester:profiles!daily_tournament_scores_contested_by_fkey(username)')
      .eq('status', 'contested')
      .order('submitted_at', { ascending: false });

    const mapped: ContestedScore[] = (data ?? []).map((s: any) => {
      const tournament = Array.isArray(s.tournament) ? s.tournament[0] : s.tournament;
      const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
      const contester = Array.isArray(s.contester) ? s.contester[0] : s.contester;
      return {
        id: s.id,
        tournament_id: s.tournament_id,
        user_id: s.user_id,
        score_value: s.score_value,
        rx: s.rx,
        video_url: s.video_url,
        status: s.status,
        contest_reason: s.contest_reason,
        contested_by: s.contested_by,
        submitted_at: s.submitted_at,
        tournament_name: tournament?.wod_name ?? '—',
        score_mode: tournament?.score_mode ?? 'time',
        athlete_name: profile?.username ?? 'Inconnu',
        contester_name: contester?.username ?? 'Inconnu',
      };
    });
    setScores(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleValidate(score: ContestedScore) {
    if (!confirm(`Valider le score de ${score.athlete_name} ?`)) return;
    setActionLoading(score.id);
    await supabase
      .from('daily_tournament_scores')
      .update({ status: 'validated' })
      .eq('tournament_id', score.tournament_id)
      .eq('user_id', score.user_id);
    setScores(prev => prev.filter(s => s.id !== score.id));
    setActionLoading(null);
  }

  async function handleReject(score: ContestedScore) {
    if (!confirm(`Rejeter et supprimer le score de ${score.athlete_name} ?`)) return;
    setActionLoading(score.id);
    await supabase
      .from('daily_tournament_scores')
      .delete()
      .eq('tournament_id', score.tournament_id)
      .eq('user_id', score.user_id);
    setScores(prev => prev.filter(s => s.id !== score.id));
    setActionLoading(null);
  }

  function formatScore(value: number, mode: string) {
    if (mode === 'time') {
      const m = Math.floor(value / 60);
      const s = value % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${value}`;
  }

  function timeAgo(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `il y a ${mins} min`;
    if (mins < 1440) return `il y a ${Math.floor(mins / 60)}h`;
    return `il y a ${Math.floor(mins / 1440)}j`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Swords size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Contestations Daily WOD</h1>
            <p className="text-sm text-gray-400">{scores.length} score{scores.length !== 1 ? 's' : ''} contesté{scores.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-all"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-1">Aucune contestation</h2>
          <p className="text-sm text-gray-400">Tous les scores Daily WOD sont validés.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scores.map(score => (
            <div key={score.id} className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{score.athlete_name}</p>
                    <p className="text-xs text-gray-500">{score.tournament_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20">
                    CONTESTÉ
                  </span>
                  <span className="text-xs text-gray-500">{timeAgo(score.submitted_at)}</span>
                </div>
              </div>

              {/* Score info */}
              <div className="flex items-center gap-6 bg-white/[0.03] rounded-xl p-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Score</p>
                  <p className="text-2xl font-black text-white">{formatScore(score.score_value, score.score_mode)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Mode</p>
                  <p className="text-sm font-bold text-gray-300">{score.score_mode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">RX</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${score.rx ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
                    {score.rx ? 'RX' : 'Scaled'}
                  </span>
                </div>
              </div>

              {/* Contest reason */}
              {score.contest_reason && (
                <div className="bg-yellow-500/[0.07] border border-yellow-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    <p className="text-xs font-bold text-yellow-500">Raison de contestation — par {score.contester_name}</p>
                  </div>
                  <p className="text-sm text-gray-300">{score.contest_reason}</p>
                </div>
              )}

              {/* Video */}
              <div>
                {score.video_url ? (
                  <a
                    href={score.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-all"
                  >
                    <Youtube size={16} />
                    Voir la vidéo
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    <span className="text-xs font-semibold text-yellow-500">Pas de vidéo soumise</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                <button
                  onClick={() => handleReject(score)}
                  disabled={actionLoading === score.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Rejeter le score
                </button>
                <button
                  onClick={() => handleValidate(score)}
                  disabled={actionLoading === score.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  Valider le score
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
