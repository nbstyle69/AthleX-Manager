'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  ArrowLeft, Trophy, Users, Clock, CheckCircle, XCircle, Pencil, Trash2,
  Loader2, Youtube, ExternalLink, AlertTriangle, Ban, RotateCcw, Lock
} from 'lucide-react';

interface Tournament {
  id: string;
  wod_name: string;
  wod_type: string;
  duration: number;
  level: string;
  movements: string;
  scoring: string | null;
  score_mode: string;
  max_players: number;
  status: string;
  elo_reward: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  creator_name: string;
}

interface Score {
  id: string;
  user_id: string;
  score_value: number;
  rx: boolean;
  notes: string | null;
  video_url: string | null;
  status: string;
  contest_reason: string | null;
  contested_by: string | null;
  submitted_at: string;
  username: string;
  contester_name: string | null;
}

export default function DailyTournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState<Record<string, string>>({});
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'validated' | 'contested' | 'rejected'>('all');

  const load = useCallback(async () => {
    setLoading(true);

    const { data: t } = await supabase
      .from('daily_tournaments')
      .select('*, creator:profiles!daily_tournaments_creator_id_fkey(username)')
      .eq('id', id)
      .single();

    if (!t) { router.push('/admin/tournaments'); return; }

    const creator = Array.isArray(t.creator) ? t.creator[0] : t.creator;
    setTournament({
      id: t.id, wod_name: t.wod_name, wod_type: t.wod_type, duration: t.duration,
      level: t.level, movements: t.movements, scoring: t.scoring, score_mode: t.score_mode,
      max_players: t.max_players, status: t.status, elo_reward: t.elo_reward,
      starts_at: t.starts_at, ends_at: t.ends_at, created_at: t.created_at,
      creator_name: creator?.username ?? 'Inconnu',
    });

    const { data: scoresRaw } = await supabase
      .from('daily_tournament_scores')
      .select('*, profile:profiles!daily_tournament_scores_user_id_profiles_fkey(username), contester:profiles!daily_tournament_scores_contested_by_fkey(username)')
      .eq('tournament_id', id)
      .order('score_value', { ascending: t.score_mode === 'time' });

    const mapped: Score[] = (scoresRaw ?? []).map((s: any) => {
      const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
      const contester = Array.isArray(s.contester) ? s.contester[0] : s.contester;
      return {
        id: s.id, user_id: s.user_id, score_value: s.score_value, rx: s.rx,
        notes: s.notes, video_url: s.video_url, status: s.status ?? 'pending',
        contest_reason: s.contest_reason, contested_by: s.contested_by,
        submitted_at: s.submitted_at,
        username: profile?.username ?? 'Inconnu',
        contester_name: contester?.username ?? null,
      };
    });
    setScores(mapped);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function adminAction(body: any) {
    setActionLoading(body.action + (body.score_id ?? body.tournament_id ?? ''));
    const res = await fetch('/api/admin/daily-tournaments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
    setActionLoading(null);
  }

  async function handleDeleteTournament() {
    if (!confirm('Supprimer définitivement ce tournoi et tous ses scores ?')) return;
    setActionLoading('delete');
    const res = await fetch(`/api/admin/daily-tournaments?id=${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/tournaments');
    setActionLoading(null);
  }

  async function handleSaveScore(scoreId: string) {
    const val = editingScore[scoreId]?.trim();
    if (!val || isNaN(Number(val))) return;
    setSavingScore(scoreId);
    await adminAction({ action: 'update_score_value', score_id: scoreId, score_value: val });
    setEditingScore(prev => { const n = { ...prev }; delete n[scoreId]; return n; });
    setSavingScore(null);
  }

  async function handleDeleteScore(scoreId: string) {
    if (!confirm('Supprimer ce score ?')) return;
    await adminAction({ action: 'delete_score', score_id: scoreId });
  }

  function formatScore(value: number, mode: string) {
    if (mode === 'time') {
      const m = Math.floor(value / 60);
      const s = value % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${value}`;
  }

  const statusColor = (s: string) =>
    s === 'open' ? 'text-emerald-400 bg-emerald-500/15' :
    s === 'completed' ? 'text-blue-400 bg-blue-500/15' :
    s === 'cancelled' ? 'text-red-400 bg-red-500/15' :
    'text-gray-400 bg-white/5';

  const statusLabel = (s: string) =>
    s === 'open' ? 'En cours' : s === 'completed' ? 'Terminé' : s === 'cancelled' ? 'Annulé' : s;

  const scoreStatusColor = (s: string) =>
    s === 'validated' ? 'text-emerald-400 bg-emerald-500/15' :
    s === 'rejected' ? 'text-red-400 bg-red-500/15' :
    s === 'contested' ? 'text-yellow-400 bg-yellow-500/15' :
    'text-gray-400 bg-white/5';

  const scoreStatusLabel = (s: string) =>
    s === 'validated' ? 'Validé' : s === 'rejected' ? 'Rejeté' : s === 'contested' ? 'Contesté' : 'En attente';

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 size={28} className="animate-spin text-[#C9A227]" />
    </div>
  );

  if (!tournament) return null;

  const filtered = filter === 'all' ? scores : scores.filter(s => s.status === filter);
  const pendingCount = scores.filter(s => s.status === 'pending').length;
  const validatedCount = scores.filter(s => s.status === 'validated').length;
  const contestedCount = scores.filter(s => s.status === 'contested').length;
  const rejectedCount = scores.filter(s => s.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/tournaments" className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">{tournament.wod_name}</h1>
          <p className="text-sm text-gray-400">
            par {tournament.creator_name} · {new Date(tournament.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${statusColor(tournament.status)}`}>
          {statusLabel(tournament.status)}
        </span>
      </div>

      {/* Tournament info */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Type</p>
            <p className="text-sm font-bold text-white">{tournament.wod_type}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Durée</p>
            <p className="text-sm font-bold text-white">{tournament.duration} min</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Niveau</p>
            <p className="text-sm font-bold text-white uppercase">{tournament.level}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Score mode</p>
            <p className="text-sm font-bold text-white">{tournament.score_mode}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Max joueurs</p>
            <p className="text-sm font-bold text-white">{tournament.max_players}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">ELO Reward</p>
            <p className="text-sm font-black text-yellow-500">+{tournament.elo_reward}</p>
          </div>
        </div>
        {tournament.movements && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Mouvements</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{tournament.movements}</p>
          </div>
        )}
      </div>

      {/* Tournament actions */}
      <div className="flex flex-wrap gap-2">
        {tournament.status === 'open' && (
          <>
            <button onClick={() => adminAction({ action: 'close', tournament_id: tournament.id })}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-50">
              {actionLoading === 'close' + tournament.id ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Forcer la clôture
            </button>
            <button onClick={() => adminAction({ action: 'cancel', tournament_id: tournament.id })}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50">
              {actionLoading === 'cancel' + tournament.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              Annuler (masquer)
            </button>
          </>
        )}
        {(tournament.status === 'completed' || tournament.status === 'cancelled') && (
          <button onClick={() => adminAction({ action: 'reopen', tournament_id: tournament.id })}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
            {actionLoading === 'reopen' + tournament.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Ré-ouvrir
          </button>
        )}
        <button onClick={handleDeleteTournament}
          disabled={!!actionLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50">
          {actionLoading === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Supprimer le tournoi
        </button>
      </div>

      {/* Score filters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Trophy size={16} className="text-[#C9A227]" />
            Scores ({scores.length})
          </h2>
        </div>
        <div className="flex gap-1 mb-4 flex-wrap">
          {[
            { key: 'all' as const, label: `Tous (${scores.length})` },
            { key: 'pending' as const, label: `En attente (${pendingCount})` },
            { key: 'validated' as const, label: `Validés (${validatedCount})` },
            { key: 'contested' as const, label: `Contestés (${contestedCount})` },
            { key: 'rejected' as const, label: `Rejetés (${rejectedCount})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f.key ? 'bg-[#C9A227]/20 text-[#C9A227]' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scores list */}
      {filtered.length === 0 ? (
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-10 text-center">
          <p className="text-sm text-gray-500">Aucun score {filter !== 'all' ? `avec le statut "${filter}"` : 'soumis'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((score, rank) => (
            <div key={score.id} className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-3">
              {/* Top row */}
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-gray-500 w-7 text-right">#{rank + 1}</span>
                <div className="w-9 h-9 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-xs font-black shrink-0">
                  {score.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{score.username}</p>
                  <p className="text-xs text-gray-500">{new Date(score.submitted_at).toLocaleString('fr-FR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${score.rx ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
                    {score.rx ? 'RX' : 'Scaled'}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${scoreStatusColor(score.status)}`}>
                    {scoreStatusLabel(score.status)}
                  </span>
                </div>
              </div>

              {/* Score value (editable) */}
              <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Score</p>
                  {editingScore[score.id] !== undefined ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value={editingScore[score.id]}
                        onChange={e => setEditingScore(prev => ({ ...prev, [score.id]: e.target.value }))}
                        className="bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-[#C9A227]/50"
                        autoFocus />
                      <button onClick={() => handleSaveScore(score.id)} disabled={savingScore === score.id}
                        className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                        {savingScore === score.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      </button>
                      <button onClick={() => setEditingScore(prev => { const n = { ...prev }; delete n[score.id]; return n; })}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                        <XCircle size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black text-white">{formatScore(score.score_value, tournament.score_mode)}</p>
                      <button onClick={() => setEditingScore(prev => ({ ...prev, [score.id]: String(score.score_value) }))}
                        className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {score.video_url && (
                  <a href={score.video_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors">
                    <Youtube size={14} /> Vidéo <ExternalLink size={10} />
                  </a>
                )}
              </div>

              {/* Contest reason */}
              {score.contest_reason && (
                <div className="bg-yellow-500/[0.07] border border-yellow-500/15 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={12} className="text-yellow-500" />
                    <p className="text-[10px] font-bold text-yellow-500">Contesté par {score.contester_name ?? '?'}</p>
                  </div>
                  <p className="text-xs text-gray-300">{score.contest_reason}</p>
                </div>
              )}

              {score.notes && (
                <p className="text-xs text-gray-500 italic">Note: {score.notes}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                {score.status !== 'validated' && (
                  <button onClick={() => adminAction({ action: 'update_score_status', score_id: score.id, status: 'validated' })}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                    <CheckCircle size={13} /> Valider
                  </button>
                )}
                {score.status !== 'rejected' && (
                  <button onClick={() => adminAction({ action: 'update_score_status', score_id: score.id, status: 'rejected' })}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50">
                    <XCircle size={13} /> Rejeter
                  </button>
                )}
                {score.status === 'validated' && (
                  <button onClick={() => adminAction({ action: 'update_score_status', score_id: score.id, status: 'pending' })}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50">
                    <RotateCcw size={13} /> Remettre en attente
                  </button>
                )}
                <button onClick={() => handleDeleteScore(score.id)}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50 ml-auto">
                  <Trash2 size={13} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
