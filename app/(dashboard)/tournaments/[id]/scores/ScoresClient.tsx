'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle, XCircle, ExternalLink, Loader2, Clock,
  Youtube, FileText, Pencil, Send, MessageSquare, RotateCcw,
} from 'lucide-react';

export interface ScoreRow {
  id: string;
  score_value: string;
  submitted_at: string;
  status: 'pending' | 'validated' | 'rejected';
  video_url: string | null;
  notes: string | null;
  admin_message: string | null;
  athlete_id: string;
  tournament_wod_id: string;
  username: string | null;
  level: string | null;
  wod_title: string | null;
}

interface Props {
  tournamentId: string;
  initialScores: ScoreRow[];
  requireVideoProof?: boolean;
}

export default function ScoresClient({ tournamentId, initialScores, requireVideoProof = false }: Props) {
  const supabase = createClient();
  const [scores,      setScores]      = useState<ScoreRow[]>(initialScores);
  const [processing,  setProcessing]  = useState<string | null>(null);
  const [filter,      setFilter]      = useState<'pending' | 'validated' | 'rejected' | 'all'>('pending');
  const [editingScore,  setEditingScore]  = useState<Record<string, string>>({});
  const [editingMsg,    setEditingMsg]    = useState<Record<string, string>>({});
  const [savingScore,   setSavingScore]   = useState<string | null>(null);
  const [savingMsg,     setSavingMsg]     = useState<string | null>(null);

  async function recalcLeaderboard() {
    const { data: allValidated } = await supabase
      .from('tournament_scores').select('athlete_id, score_value, tournament_wod_id')
      .eq('tournament_id', tournamentId).eq('status', 'validated');
    if (!allValidated) return;
    const pointsMap: Record<string, number> = {};
    const byWod: Record<string, { athlete_id: string; score_value: string }[]> = {};
    allValidated.forEach((s: any) => {
      if (!byWod[s.tournament_wod_id]) byWod[s.tournament_wod_id] = [];
      byWod[s.tournament_wod_id].push(s);
    });
    for (const [, wodScores] of Object.entries(byWod)) {
      const sorted = [...wodScores].sort((a, b) => parseFloat(b.score_value) - parseFloat(a.score_value));
      sorted.forEach((s, i) => {
        const pts = Math.max(1, 100 - i * 3);
        pointsMap[s.athlete_id] = (pointsMap[s.athlete_id] ?? 0) + pts;
      });
    }
    for (const [athleteId, pts] of Object.entries(pointsMap)) {
      await supabase.from('tournament_participants')
        .update({ score: pts }).eq('tournament_id', tournamentId).eq('athlete_id', athleteId);
    }
  }

  async function updateStatus(scoreId: string, newStatus: 'validated' | 'rejected') {
    if (newStatus === 'validated' && requireVideoProof) {
      const score = scores.find(s => s.id === scoreId);
      if (!String(score?.video_url ?? '').trim()) {
        alert("Preuve vidéo requise : ce tournoi exige une preuve vidéo. Impossible de valider un score sans lien vidéo — demande à l'athlète de soumettre sa vidéo, ou rejette le score.");
        return;
      }
    }
    setProcessing(scoreId);
    const payload: any = { status: newStatus };
    if (newStatus === 'validated') payload.validated_at = new Date().toISOString();
    await supabase.from('tournament_scores').update(payload).eq('id', scoreId);
    if (newStatus === 'validated') await recalcLeaderboard();
    setScores(prev => prev.map(s => s.id === scoreId ? { ...s, status: newStatus } : s));
    setProcessing(null);
  }

  async function saveScoreValue(scoreId: string) {
    const newVal = editingScore[scoreId]?.trim();
    if (!newVal) return;
    setSavingScore(scoreId);
    await supabase.from('tournament_scores').update({ score_value: newVal }).eq('id', scoreId);
    setScores(prev => prev.map(s => s.id === scoreId ? { ...s, score_value: newVal } : s));
    setEditingScore(prev => { const n = { ...prev }; delete n[scoreId]; return n; });
    setSavingScore(null);
    await recalcLeaderboard();
  }

  async function saveAdminMessage(scoreId: string) {
    const msg = editingMsg[scoreId] ?? '';
    setSavingMsg(scoreId);
    await supabase.from('tournament_scores').update({ admin_message: msg || null }).eq('id', scoreId);
    setScores(prev => prev.map(s => s.id === scoreId ? { ...s, admin_message: msg || null } : s));
    setEditingMsg(prev => { const n = { ...prev }; delete n[scoreId]; return n; });
    setSavingMsg(null);
  }

  const filtered       = filter === 'all' ? scores : scores.filter(s => s.status === filter);
  const pendingCount   = scores.filter(s => s.status === 'pending').length;
  const validatedCount = scores.filter(s => s.status === 'validated').length;
  const rejectedCount  = scores.filter(s => s.status === 'rejected').length;

  const FILTERS = [
    { key: 'pending'   as const, label: pendingCount   > 0 ? `En attente (${pendingCount})`   : 'En attente',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
    { key: 'validated' as const, label: validatedCount > 0 ? `Validés (${validatedCount})`     : 'Validés',       activeClass: 'bg-green-600 border-green-600 text-white' },
    { key: 'rejected'  as const, label: rejectedCount  > 0 ? `Rejetés (${rejectedCount})`      : 'Rejetés',       activeClass: 'bg-red-600 border-red-600 text-white' },
    { key: 'all'       as const, label: `Tous (${scores.length})`,                                                 activeClass: 'bg-white border-white text-[#0A0A0A]' },
  ] as const;

  const statusBadge = (status: ScoreRow['status']) => {
    if (status === 'validated') return <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">✓ Validé</span>;
    if (status === 'rejected')  return <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">✗ Rejeté</span>;
    return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">⏳ En attente</span>;
  };

  return (
    <>
      <p className="text-xs text-gray-500 -mt-4 mb-2">{pendingCount} score(s) en attente de validation</p>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
              filter === f.key ? f.activeClass : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
          <p className="text-white font-bold">
            {filter === 'all' ? 'Aucun score soumis' : `Aucun score « ${filter} »`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(score => {
            const isEditingScoreVal = (scoreId: string) => scoreId in editingScore;
            const isEditingMsgVal   = (scoreId: string) => scoreId in editingMsg;
            return (
              <div key={score.id} className={`bg-[#111111] border rounded-2xl p-5 space-y-4 transition-colors ${
                score.status === 'pending'   ? 'border-amber-500/20' :
                score.status === 'validated' ? 'border-green-500/20' : 'border-red-500/20'
              }`}>

                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-black shrink-0">
                      {(score.username ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{score.username ?? '?'}</p>
                        {score.level && (
                          <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">
                            {score.level}
                          </span>
                        )}
                        {statusBadge(score.status)}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{score.wod_title ?? '—'}</p>
                    </div>
                  </div>

                  {/* Score value — editable */}
                  <div className="text-right shrink-0">
                    {isEditingScoreVal(score.id) ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingScore[score.id]}
                          onChange={e => setEditingScore(prev => ({ ...prev, [score.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveScoreValue(score.id)}
                          className="w-24 text-right text-lg font-black bg-white/5 border border-white/20 rounded-lg px-2 py-1 text-white outline-none focus:border-white/60"
                          autoFocus
                        />
                        <button onClick={() => saveScoreValue(score.id)} disabled={savingScore === score.id}
                          className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors disabled:opacity-50">
                          {savingScore === score.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        </button>
                        <button onClick={() => setEditingScore(prev => { const n = { ...prev }; delete n[score.id]; return n; })}
                          className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors">
                          <XCircle size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <p className="text-2xl font-black text-white">{score.score_value}</p>
                        <button onClick={() => setEditingScore(prev => ({ ...prev, [score.id]: score.score_value }))}
                          className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                          title="Modifier le score">
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <Clock size={10} className="text-gray-600" />
                      <p className="text-xs text-gray-500">
                        {new Date(score.submitted_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes athlète */}
                {score.notes && (
                  <div className="flex items-start gap-2 bg-white/3 rounded-xl px-3 py-2.5">
                    <FileText size={13} className="text-gray-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-600 uppercase mb-0.5">Note athlète</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{score.notes}</p>
                    </div>
                  </div>
                )}

                {/* Vidéo YouTube */}
                {score.video_url ? (
                  <a href={score.video_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 hover:bg-red-500/15 transition-colors group">
                    <Youtube size={18} className="text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-red-400 group-hover:text-red-300">Vidéo YouTube soumise</p>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{score.video_url}</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-500 shrink-0" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                    <Youtube size={18} className="text-gray-600 shrink-0" />
                    <p className="text-xs text-gray-500">Aucune vidéo soumise</p>
                  </div>
                )}

                {/* Message admin → athlète */}
                <div className="space-y-2">
                  {score.admin_message && !isEditingMsgVal(score.id) && (
                    <div className="flex items-start gap-2 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
                      <MessageSquare size={13} className="text-blue-400 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5">Message à l'athlète</p>
                        <p className="text-xs text-gray-300 leading-relaxed">{score.admin_message}</p>
                      </div>
                      <button onClick={() => setEditingMsg(prev => ({ ...prev, [score.id]: score.admin_message ?? '' }))}
                        className="p-1 rounded text-gray-500 hover:text-white transition-colors shrink-0">
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}

                  {isEditingMsgVal(score.id) ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingMsg[score.id]}
                        onChange={e => setEditingMsg(prev => ({ ...prev, [score.id]: e.target.value }))}
                        placeholder="Message à l'athlète (visible dans l'app mobile)…"
                        rows={2}
                        className="w-full text-xs bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 outline-none focus:border-blue-500/40 resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingMsg(prev => { const n = { ...prev }; delete n[score.id]; return n; })}
                          className="px-3 py-1.5 text-xs font-bold text-gray-400 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
                          Annuler
                        </button>
                        <button onClick={() => saveAdminMessage(score.id)} disabled={savingMsg === score.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-500/10 transition-colors disabled:opacity-50">
                          {savingMsg === score.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                          Envoyer
                        </button>
                      </div>
                    </div>
                  ) : (
                    !score.admin_message && (
                      <button onClick={() => setEditingMsg(prev => ({ ...prev, [score.id]: '' }))}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-400 transition-colors">
                        <MessageSquare size={12} />
                        Envoyer un message à l'athlète
                      </button>
                    )
                  )}
                </div>

                {/* ── Actions valider / rejeter ── */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                  {score.status === 'validated' ? (
                    <button onClick={() => updateStatus(score.id, 'rejected')} disabled={processing === score.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
                      Rejeter
                    </button>
                  ) : score.status === 'rejected' ? (
                    <>
                      <button onClick={() => updateStatus(score.id, 'validated')} disabled={processing === score.id}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-green-400 border border-green-500/20 rounded-xl hover:bg-green-500/10 transition-colors disabled:opacity-50">
                        {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                        Valider quand même
                      </button>
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">✗ Rejeté</span>
                    </>
                  ) : (
                    <>
                      <button onClick={() => updateStatus(score.id, 'rejected')} disabled={processing === score.id}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50">
                        {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
                        Rejeter
                      </button>
                      <button onClick={() => updateStatus(score.id, 'validated')} disabled={processing === score.id}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 rounded-xl hover:bg-green-500 transition-colors disabled:opacity-50">
                        {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                        Valider
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
