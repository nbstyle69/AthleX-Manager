'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, XCircle, ExternalLink, Loader2, Clock, Youtube, FileText } from 'lucide-react';

export interface ScoreRow {
  id: string;
  score_value: string;
  submitted_at: string;
  status: 'pending' | 'validated' | 'rejected';
  video_url: string | null;
  notes: string | null;
  athlete_id: string;
  tournament_wod_id: string;
  username: string | null;
  level: string | null;
  wod_title: string | null;
}

interface Props {
  tournamentId: string;
  initialScores: ScoreRow[];
}

export default function ScoresClient({ tournamentId, initialScores }: Props) {
  const supabase = createClient();
  const [scores,     setScores]     = useState<ScoreRow[]>(initialScores);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter,     setFilter]     = useState<'pending' | 'validated' | 'rejected' | 'all'>('pending');

  async function updateStatus(scoreId: string, newStatus: 'validated' | 'rejected') {
    setProcessing(scoreId);
    const payload: any = { status: newStatus };
    if (newStatus === 'validated') payload.validated_at = new Date().toISOString();
    await supabase.from('tournament_scores').update(payload).eq('id', scoreId);

    if (newStatus === 'validated') {
      const { data: allValidated } = await supabase
        .from('tournament_scores').select('athlete_id, score_value, tournament_wod_id')
        .eq('tournament_id', tournamentId).eq('status', 'validated');
      if (allValidated) {
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
    }
    setScores(prev => prev.map(s => s.id === scoreId ? { ...s, status: newStatus } : s));
    setProcessing(null);
  }

  const filtered       = filter === 'all' ? scores : scores.filter(s => s.status === filter);
  const pendingCount   = scores.filter(s => s.status === 'pending').length;
  const validatedCount = scores.filter(s => s.status === 'validated').length;
  const rejectedCount  = scores.filter(s => s.status === 'rejected').length;

  const FILTERS = [
    { key: 'pending'   as const, label: `En attente${pendingCount   > 0 ? ` (${pendingCount})`   : ''}`, activeClass: 'bg-amber-500 border-amber-500 text-white' },
    { key: 'validated' as const, label: `Validés${validatedCount   > 0 ? ` (${validatedCount})` : ''}`, activeClass: 'bg-green-600 border-green-600 text-white' },
    { key: 'rejected'  as const, label: `Rejetés${rejectedCount    > 0 ? ` (${rejectedCount})`  : ''}`, activeClass: 'bg-red-600 border-red-600 text-white' },
    { key: 'all'       as const, label: `Tous (${scores.length})`,                                        activeClass: 'bg-[#C9A227] border-[#C9A227] text-white' },
  ] as const;

  return (
    <>
      <p className="text-xs text-gray-500 -mt-4 mb-2">{pendingCount} score(s) en attente</p>

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
            {filter === 'all' ? 'Aucun score soumis' : `Aucun score "${filter}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(score => (
            <div key={score.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">

              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-sm font-black shrink-0">
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
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{score.wod_title ?? '—'}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-white">{score.score_value}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Clock size={10} className="text-gray-600" />
                    <p className="text-xs text-gray-500">
                      {new Date(score.submitted_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {score.notes && (
                <div className="flex items-start gap-2 bg-white/3 rounded-xl px-3 py-2.5">
                  <FileText size={13} className="text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-400 leading-relaxed">{score.notes}</p>
                </div>
              )}

              {/* Video link — prominent */}
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

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex gap-2 ml-auto">
                  {score.status !== 'rejected' && (
                    <button onClick={() => updateStatus(score.id, 'rejected')}
                      disabled={processing === score.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
                      Rejeter
                    </button>
                  )}
                  {score.status !== 'validated' && (
                    <button onClick={() => updateStatus(score.id, 'validated')}
                      disabled={processing === score.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-green-400 border border-green-500/20 rounded-xl hover:bg-green-500/10 transition-colors disabled:opacity-50">
                      {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                      Valider
                    </button>
                  )}
                  {score.status !== 'pending' && (
                    <span className={`text-xs font-bold px-3 py-2 rounded-xl ${
                      score.status === 'validated' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                    }`}>
                      {score.status === 'validated' ? '✓ Validé' : '✗ Rejeté'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
