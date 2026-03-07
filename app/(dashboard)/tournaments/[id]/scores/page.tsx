'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, XCircle, ExternalLink, Bot, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime, statusBadge } from '@/lib/utils';

export default function ScoresPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [scores,      setScores]      = useState<any[]>([]);
  const [wods,        setWods]        = useState<any[]>([]);
  const [filterWod,   setFilterWod]   = useState('all');
  const [filterStatus,setFilterStatus]= useState('all');
  const [loading,     setLoading]     = useState(true);
  const [rejectModal, setRejectModal] = useState<{ scoreId: string } | null>(null);
  const [rejectReason,setRejectReason]= useState('');
  const [aiModal,     setAiModal]     = useState<string | null>(null);
  const [aiLoading,   setAiLoading]   = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    const { data } = await supabase
      .from('tournament_scores')
      .select('*, profile:profiles(username, level, elo), tw:tournament_wods(title, type)')
      .eq('tournament_id', id)
      .order('submitted_at', { ascending: false });
    setScores(data ?? []);
    const { data: wData } = await supabase.from('tournament_wods').select('id, title').eq('tournament_id', id);
    setWods(wData ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  async function validate(scoreId: string) {
    await supabase.from('tournament_scores').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', scoreId);
    fetchScores();
  }

  async function reject(scoreId: string) {
    await supabase.from('tournament_scores').update({ status: 'rejected', ai_analysis: rejectReason ? `Motif de rejet : ${rejectReason}` : undefined }).eq('id', scoreId);
    setRejectModal(null);
    setRejectReason('');
    fetchScores();
  }

  async function analyzeWithAI(score: any) {
    setAiLoading(score.id);
    const profile = Array.isArray(score.profile) ? score.profile[0] : score.profile;
    const tw = Array.isArray(score.tw) ? score.tw[0] : score.tw;
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoreId: score.id, athleteName: profile?.username, wodTitle: tw?.title,
          wodType: tw?.type, scoreValue: score.score_value, tiebreakValue: score.tiebreak_value,
          athleteLevel: profile?.level, athleteElo: profile?.elo, notes: score.notes,
        }),
      });
      const data = await res.json();
      if (data.analysis) setAiModal(data.analysis);
    } finally {
      setAiLoading(null);
    }
  }

  const filtered = scores.filter(s => {
    if (filterWod !== 'all' && s.tournament_wod_id !== filterWod) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    return true;
  });

  const stats = { total: scores.length, pending: scores.filter(s => s.status === 'pending').length, validated: scores.filter(s => s.status === 'validated').length, rejected: scores.filter(s => s.status === 'rejected').length };

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-white flex-1">Validation des scores</h1>
        <button onClick={fetchScores} className="p-2 text-gray-400 hover:text-white"><RefreshCw size={15} /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '#6B7280' },
          { label: 'En attente', value: stats.pending, color: '#D97706' },
          { label: 'Validés', value: stats.validated, color: '#22C55E' },
          { label: 'Rejetés', value: stats.rejected, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="bg-[#16162A] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterWod} onChange={e => setFilterWod(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
          <option value="all">Tous les WODs</option>
          {wods.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="validated">Validés</option>
          <option value="rejected">Rejetés</option>
        </select>
      </div>

      {/* Scores table */}
      {!filtered.length ? (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-12 text-center">
          <p className="text-gray-500">Aucun score trouvé.</p>
        </div>
      ) : (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Athlète</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">WOD</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => {
                const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
                const tw = Array.isArray(s.tw) ? s.tw[0] : s.tw;
                const sb = statusBadge(s.status);
                return (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-300 text-xs font-black shrink-0">
                          {(profile?.username ?? '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{profile?.username ?? '?'}</p>
                          <p className="text-xs text-gray-500">{profile?.level?.toUpperCase()} · ELO {profile?.elo ?? 1000}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300">{tw?.title ?? '—'}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-white">{s.score_value}</p>
                      {s.tiebreak_value && <p className="text-xs text-gray-500">TB: {s.tiebreak_value}</p>}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-400">{formatDateTime(s.submitted_at)}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${sb.color}20`, color: sb.color }}>{sb.label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {s.video_url && (
                          <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Voir vidéo">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <button onClick={() => analyzeWithAI(s)} disabled={aiLoading === s.id}
                          className="p-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 transition-colors" title="Analyse IA">
                          <Bot size={13} className={aiLoading === s.id ? 'animate-pulse' : ''} />
                        </button>
                        {s.status === 'pending' && (
                          <>
                            <button onClick={() => validate(s.id)} className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors" title="Valider">
                              <CheckCircle size={13} />
                            </button>
                            <button onClick={() => setRejectModal({ scoreId: s.id })} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Rejeter">
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-[#16162A] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Motif de rejet</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Raison du rejet (optionnel)..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 min-h-[80px] resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl">Annuler</button>
              <button onClick={() => reject(rejectModal.scoreId)} className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl">Rejeter</button>
            </div>
          </div>
        </div>
      )}

      {/* AI modal */}
      {aiModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setAiModal(null)}>
          <div className="bg-[#16162A] border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Bot size={18} className="text-violet-400" />
              <h3 className="text-base font-bold text-white">Analyse IA</h3>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{aiModal}</p>
            <p className="text-xs text-gray-600 mt-4 italic">⚠️ L&apos;IA peut se tromper. Vérifiez la vidéo avant toute décision.</p>
            <button onClick={() => setAiModal(null)} className="mt-5 w-full py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
