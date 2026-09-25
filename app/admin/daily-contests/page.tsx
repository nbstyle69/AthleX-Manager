'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Swords, CheckCircle, XCircle, Youtube, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUB_ORANGE_SOFT, SUB_ORANGE_TEXT } from '@/components/admin/adminTokens';

// Libellés affichés seulement : `score_mode` garde ses valeurs en base.
const SCORE_MODE_LABEL: Record<string, string> = { time: 'Temps', reps: 'Répétitions', rounds: 'Tours' };

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
  const { dialog, ask } = useConfirmDialog();

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

  const contested = (score: ContestedScore) =>
    `${score.athlete_name} · ${score.tournament_name} · ${formatScore(score.score_value, score.score_mode)}${score.rx ? ' RX' : ''}`;

  function askValidate(score: ContestedScore) {
    ask({
      title: 'Valider ce score contesté ?',
      element: `${contested(score)}, contesté par ${score.contester_name}${score.contest_reason ? ` : « ${score.contest_reason} »` : ''}`,
      body: 'Le score sera marqué comme validé et la contestation sera close.',
      confirmLabel: 'Valider le score',
      run: () => handleValidate(score),
    });
  }

  function askReject(score: ContestedScore) {
    ask({
      title: 'Rejeter ce score contesté ?',
      element: `${contested(score)}, contesté par ${score.contester_name}`,
      body: 'Le score sera supprimé définitivement. L’athlète reste inscrit au tournoi.',
      confirmLabel: 'Rejeter et supprimer',
      danger: true,
      run: () => handleReject(score),
    });
  }

  async function handleValidate(score: ContestedScore) {
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
      {dialog}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-danger-soft flex items-center justify-center">
            <Swords size={22} className="text-ax-danger" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Contestations Daily WOD</h1>
            <p className="text-sm text-ax-text-secondary">{scores.length} score{scores.length !== 1 ? 's' : ''} contesté{scores.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button variant="ax-outline" onClick={load}>
          <RefreshCw size={14} />
          Actualiser
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle size={48} className="text-ax-success mx-auto mb-4" />
          <h2 className="text-lg font-bold text-ax-text mb-1">Aucune contestation</h2>
          <p className="text-sm text-ax-text-secondary">Tous les scores Daily WOD sont validés.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scores.map(score => (
            <div key={score.id} className="bg-ax-surface border border-ax-border rounded-ax-card p-4 sm:p-6 space-y-4">
              {/* Top row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-ax-danger-soft flex items-center justify-center">
                    <AlertTriangle size={18} className="text-ax-danger" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ax-text break-words">{score.athlete_name}</p>
                    <p className="text-xs text-ax-text-secondary break-words">{score.tournament_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge bg-ax-danger-soft text-ax-danger border border-ax-danger">
                    CONTESTÉ
                  </span>
                  <span className="text-xs text-ax-text-secondary">{timeAgo(score.submitted_at)}</span>
                </div>
              </div>

              {/* Score info */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-ax-surface-secondary rounded-ax-control p-4">
                <div>
                  <p className="text-xs text-ax-text-secondary uppercase tracking-wider font-bold mb-1">Score</p>
                  <p className="text-2xl font-black text-ax-text">{formatScore(score.score_value, score.score_mode)}</p>
                </div>
                <div>
                  <p className="text-xs text-ax-text-secondary uppercase tracking-wider font-bold mb-1">Mode</p>
                  <p className="text-sm font-bold text-ax-text">{SCORE_MODE_LABEL[score.score_mode] ?? score.score_mode}</p>
                </div>
                <div>
                  <p className="text-xs text-ax-text-secondary uppercase tracking-wider font-bold mb-1">RX</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-ax-badge ${score.rx ? 'bg-ax-success-soft text-ax-success' : `${SUB_ORANGE_SOFT} ${SUB_ORANGE_TEXT}`}`}>
                    {score.rx ? 'RX' : 'Scaled'}
                  </span>
                </div>
              </div>

              {/* Contest reason */}
              {score.contest_reason && (
                <div className="bg-ax-warning-soft border border-ax-warning rounded-ax-control p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle size={14} className="text-ax-warning shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-ax-warning break-words min-w-0">Raison de contestation — par {score.contester_name}</p>
                  </div>
                  <p className="text-sm text-ax-text break-words">{score.contest_reason}</p>
                </div>
              )}

              {/* Video */}
              <div>
                {score.video_url ? (
                  <a
                    href={score.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-ax-control bg-ax-danger-soft border border-ax-danger text-ax-danger text-sm font-semibold transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none"
                  >
                    <Youtube size={16} />
                    Voir la vidéo
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-ax-control bg-ax-warning-soft border border-ax-warning">
                    <AlertTriangle size={14} className="text-ax-warning" />
                    <span className="text-xs font-semibold text-ax-warning">Pas de vidéo soumise</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-ax-border">
                <button
                  onClick={() => askReject(score)}
                  disabled={actionLoading === score.id}
                  className="flex-1 min-w-[10rem] flex items-center justify-center gap-2 px-4 py-3 rounded-ax-control bg-ax-danger-soft border border-ax-danger text-ax-danger font-bold text-sm transition-[filter] hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none"
                >
                  <XCircle size={16} />
                  Rejeter le score
                </button>
                <Button
                  variant="ax-mint"
                  onClick={() => askValidate(score)}
                  disabled={actionLoading === score.id}
                  className="flex-1 min-w-[10rem]"
                >
                  <CheckCircle size={16} />
                  Valider le score
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
