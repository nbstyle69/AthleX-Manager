'use client';

import { useState } from 'react';
import { Loader2, Lock, AlertTriangle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

function calcElo(athleteElo: number, rank: number, total: number, avgOpp: number, k = 48) {
  if (total <= 1) return 0;
  const actual   = (total - rank) / (total - 1);
  const expected = 1 / (1 + Math.pow(10, (avgOpp - athleteElo) / 400));
  return Math.round(k * (actual - expected));
}

interface Props {
  tournamentId: string;
  pendingCount:  number;
  status: string;
  format?: string;
}

export default function CloseTournamentButton({ tournamentId, pendingCount, status, format }: Props) {
  const router  = useRouter();
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  if (status === 'finished' || status === 'completed') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-white/5 cursor-default">
        <Lock size={12} /> Tournoi clôturé
      </div>
    );
  }

  // For league_div: closing is done per-season via end_season_and_advance (Divisions tab)
  if (format === 'league_div') {
    return null;
  }

  async function handleClose() {
    setClosing(true);
    setError(null);
    const supabase = createClient();

    const { data: tp, error: tpErr } = await supabase
      .from('tournament_participants')
      .select('athlete_id, score')
      .eq('tournament_id', tournamentId)
      .order('score', { ascending: false });

    if (tpErr) {
      setError(tpErr.message);
      setClosing(false);
      return;
    }
    if (!tp || tp.length === 0) {
      setError('Aucun participant trouvé.');
      setClosing(false);
      return;
    }

    // Fetch profiles separately (no FK embed reliance)
    const athleteIds = tp.map((p: any) => p.athlete_id);
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, elo')
      .in('id', athleteIds);
    const profMap: Record<string, any> = {};
    (profs ?? []).forEach((pr: any) => { profMap[pr.id] = pr; });
    const getProf = (p: any) => profMap[p.athlete_id] ?? null;
    const avgElo  = Math.round(tp.reduce((s: number, p: any) => s + (getProf(p)?.elo ?? 1000), 0) / tp.length);
    const changes: { name: string; rank: number; change: number }[] = [];

    for (let i = 0; i < tp.length; i++) {
      const p    = tp[i];
      const prof = getProf(p);
      const rank = i + 1;
      const ch   = calcElo(prof?.elo ?? 1000, rank, tp.length, avgElo);
      const newElo = Math.max(100, (prof?.elo ?? 1000) + ch);

      await supabase.from('profiles').update({ elo: newElo }).eq('id', p.athlete_id);
      await supabase.from('tournament_elo_history').upsert({
        tournament_id: tournamentId, athlete_id: p.athlete_id,
        final_rank: rank, participants_count: tp.length,
        avg_opponent_elo: avgElo, elo_before: prof?.elo ?? 1000,
        elo_after: newElo, elo_change: ch,
      }, { onConflict: 'tournament_id,athlete_id' });
      changes.push({ name: prof?.username ?? '?', rank, change: ch });
    }

    await supabase.from('tournaments').update({ status: 'finished' }).eq('id', tournamentId);
    setClosing(false);
    setOpen(false);

    const recap = changes.slice(0, 5).map(e =>
      `${e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`} ${e.name}: ${e.change >= 0 ? '+' : ''}${e.change} ELO`
    ).join('\n');
    setResult(recap + (changes.length > 5 ? `\n…et ${changes.length - 5} autres` : ''));
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:text-white hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
        <Zap size={13} /> Clôturer &amp; ELO
      </button>

      {open && !result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-black text-white mb-1">Clôturer le tournoi ?</h2>
                <p className="text-sm text-gray-400">
                  Les points ELO seront calculés et distribués à tous les participants selon leur classement.
                  Cette action est <strong className="text-white">irréversible</strong>.
                </p>
                {pendingCount > 0 && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-semibold">
                    ⚠️ {pendingCount} score(s) encore en attente — valide ou rejette-les avant de clôturer.
                  </div>
                )}
                {error && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">{error}</div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                Annuler
              </button>
              <button onClick={handleClose} disabled={closing || pendingCount > 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 transition-colors">
                {closing && <Loader2 size={14} className="animate-spin" />}
                {closing ? 'Calcul en cours…' : 'Confirmer la clôture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-black text-white">✅ Tournoi clôturé !</h2>
            <p className="text-sm text-gray-400">ELO distribué :</p>
            <pre className="text-sm text-white font-mono bg-white/5 rounded-xl p-4 whitespace-pre-wrap">{result}</pre>
            <button onClick={() => setResult(null)}
              className="w-full py-3 rounded-xl bg-[#C9A227] text-black font-bold text-sm hover:bg-[#C9A227]/90 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
