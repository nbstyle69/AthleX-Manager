'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, Loader2, Clock } from 'lucide-react';
import Link from 'next/link';

interface Score {
  id: string;
  score_value: string;
  submitted_at: string;
  status: 'pending' | 'validated' | 'rejected';
  video_url: string | null;
  notes: string | null;
  athlete_id: string;
  tournament_wod_id: string;
  profile: { username: string; level: string } | null;
  tw: { title: string } | null;
}

export default function TournamentScoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = use(params);
  const supabase = createClient();

  const [scores,      setScores]      = useState<Score[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState<string | null>(null);
  const [filter,      setFilter]      = useState<'pending' | 'validated' | 'rejected' | 'all'>('pending');
  const [tournament,  setTournament]  = useState<{ name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: sc }] = await Promise.all([
      supabase.from('tournaments').select('name').eq('id', tournamentId).single(),
      supabase.from('tournament_scores')
        .select('id, score_value, submitted_at, status, video_url, notes, athlete_id, tournament_wod_id, profile:profiles(username, level), tw:tournament_wods(title)')
        .eq('tournament_id', tournamentId)
        .order('submitted_at', { ascending: false }),
    ]);
    setTournament(t);
    setScores((sc ?? []).map((s: any) => ({
      ...s,
      profile: Array.isArray(s.profile) ? s.profile[0] ?? null : s.profile,
      tw:      Array.isArray(s.tw)      ? s.tw[0]      ?? null : s.tw,
    })));
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(scoreId: string, newStatus: 'validated' | 'rejected') {
    setProcessing(scoreId);
    const payload: any = { status: newStatus };
    if (newStatus === 'validated') payload.validated_at = new Date().toISOString();
    await supabase.from('tournament_scores').update(payload).eq('id', scoreId);
    if (newStatus === 'validated') {
      // Recalc leaderboard points
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

  const filtered = filter === 'all' ? scores : scores.filter(s => s.status === filter);
  const pendingCount  = scores.filter(s => s.status === 'pending').length;
  const validatedCount = scores.filter(s => s.status === 'validated').length;
  const rejectedCount  = scores.filter(s => s.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">Scores — {tournament?.name ?? '…'}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{pendingCount} score(s) en attente</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'validated', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
              filter === f
                ? f === 'pending'    ? 'bg-amber-500 border-amber-500 text-white'
                : f === 'validated' ? 'bg-green-600 border-green-600 text-white'
                : f === 'rejected'  ? 'bg-red-600 border-red-600 text-white'
                : 'bg-[#C9A227] border-[#C9A227] text-white'
                : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
            }`}>
            {f === 'pending'   ? `En attente${pendingCount > 0 ? ` (${pendingCount})` : ''}`
              : f === 'validated' ? `Validés${validatedCount > 0 ? ` (${validatedCount})` : ''}`
              : f === 'rejected'  ? `Rejetés${rejectedCount > 0 ? ` (${rejectedCount})` : ''}`
              : 'Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-[#C9A227] mx-auto" /></div>
      ) : !filtered.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
          <p className="text-white font-bold">Aucun score {filter !== 'all' ? `"${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(score => (
            <div key={score.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-sm font-black shrink-0">
                    {(score.profile?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{score.profile?.username ?? '?'}</p>
                      <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                        {score.profile?.level?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{score.tw?.title}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-white">{score.score_value}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Clock size={10} className="text-gray-600" />
                    <p className="text-xs text-gray-500">
                      {new Date(score.submitted_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              {score.notes && (
                <p className="text-xs text-gray-500 mt-3 bg-white/3 rounded-lg px-3 py-2">{score.notes}</p>
              )}

              <div className="flex items-center gap-2 mt-4">
                {score.video_url && (
                  <a href={score.video_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:text-[#C9A227]/80 transition-colors">
                    <ExternalLink size={12} /> Voir vidéo
                  </a>
                )}
                <div className="flex gap-2 ml-auto">
                  {score.status !== 'rejected' && (
                    <button
                      onClick={() => updateStatus(score.id, 'rejected')}
                      disabled={processing === score.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {processing === score.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
                      Rejeter
                    </button>
                  )}
                  {score.status !== 'validated' && (
                    <button
                      onClick={() => updateStatus(score.id, 'validated')}
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
    </div>
  );
}
