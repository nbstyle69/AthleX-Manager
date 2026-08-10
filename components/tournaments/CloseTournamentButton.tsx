'use client';

import { useState } from 'react';
import { Loader2, Lock, AlertTriangle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { computeBracketStandings, type BracketMatchRow } from '@/lib/bracket';

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
  /** Mis en avant dans l'état « En révision » : c'est l'action attendue. */
  emphasis?: boolean;
}

export default function CloseTournamentButton({ tournamentId, pendingCount, status, format, emphasis }: Props) {
  const router  = useRouter();
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  // For league_div: closing is done per-season via end_season_and_advance (Divisions tab)
  if (format === 'league_div') {
    return status === 'completed' ? (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-white/5 cursor-default">
        <Lock size={12} /> Tournoi clôturé
      </div>
    ) : null;
  }

  const isCompleted = status === 'completed';

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

    // Idempotent baseline: if the tournament was already closed, reuse the
    // ELO recorded *before* that distribution so re-running corrects the result
    // instead of stacking a new gain on top of the previous one.
    const { data: prevHistory } = await supabase
      .from('tournament_elo_history')
      .select('athlete_id, elo_before')
      .eq('tournament_id', tournamentId);
    const baselineElo: Record<string, number> = {};
    (prevHistory ?? []).forEach((h: any) => { baselineElo[h.athlete_id] = h.elo_before; });
    const eloOf = (id: string) => baselineElo[id] ?? profMap[id]?.elo ?? 1000;

    // Ranking source: for a bracket, derive placement from the bracket outcome
    // (champion → finalist → semis …), otherwise fall back to the score order.
    let ranked: { athlete_id: string; rank: number }[] = tp.map((p: any, i: number) => ({ athlete_id: p.athlete_id, rank: i + 1 }));
    if (format === 'bracket' || format === 'swiss') {
      const { data: matches } = await supabase
        .from('tournament_bracket_matches')
        .select('round, side, participant1_id, participant2_id, winner_id, loser_id, status')
        .eq('tournament_id', tournamentId);
      const standings = computeBracketStandings((matches ?? []) as BracketMatchRow[], format === 'swiss');
      if (standings.length > 0) ranked = standings.map(s => ({ athlete_id: s.athlete_id, rank: s.rank }));
    }

    const total  = ranked.length;
    const avgElo = Math.round(ranked.reduce((s, r) => s + eloOf(r.athlete_id), 0) / total);
    const changes: { name: string; rank: number; change: number }[] = [];

    for (const { athlete_id, rank } of ranked) {
      const prof = profMap[athlete_id] ?? null;
      const base = eloOf(athlete_id);
      const ch   = calcElo(base, rank, total, avgElo);
      const newElo = Math.max(100, base + ch);

      await supabase.from('profiles').update({ elo: newElo }).eq('id', athlete_id);
      await supabase.from('tournament_elo_history').upsert({
        tournament_id: tournamentId, athlete_id,
        final_rank: rank, participants_count: total,
        avg_opponent_elo: avgElo, elo_before: base,
        elo_after: newElo, elo_change: ch,
      }, { onConflict: 'tournament_id,athlete_id' });
      changes.push({ name: prof?.username ?? '?', rank, change: ch });
    }
    changes.sort((a, b) => a.rank - b.rank);

    const { error: statusErr } = await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('id', tournamentId);
    if (statusErr) {
      setError(`ELO distribué mais la clôture a échoué : ${statusErr.message}`);
      setClosing(false);
      return;
    }
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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
          emphasis
            ? 'bg-amber-500 text-black hover:bg-amber-400 border border-amber-500'
            : 'text-amber-400 hover:text-white hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40'
        }`}>
        <Zap size={13} /> {isCompleted ? "Recalculer l'ELO" : "Distribuer l'ELO et clôturer"}
      </button>

      {open && !result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-black text-white mb-1">{isCompleted ? "Recalculer l'ELO ?" : "Distribuer l'ELO et clôturer ?"}</h2>
                <p className="text-sm text-gray-400">
                  {isCompleted
                    ? "L'ELO est recalculé selon le classement final actuel (utile après une correction de vainqueur). Le recalcul repart de l'ELO d'avant clôture, il ne s'empile donc pas."
                    : 'Les points ELO seront calculés et distribués à tous les participants selon leur classement, et le tournoi passera « Clôturé ». C’est la dernière étape : ne la lance qu’une fois les scores vérifiés.'}
                </p>
                {pendingCount > 0 && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-semibold">
                    ⚠️ {pendingCount} score(s) encore en attente — valide ou rejette-les avant de distribuer l’ELO.
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
                {closing ? 'Calcul en cours…' : "Distribuer l'ELO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-black text-white">{isCompleted ? '✅ ELO recalculé !' : '✅ Tournoi clôturé !'}</h2>
            <p className="text-sm text-gray-400">ELO distribué :</p>
            <pre className="text-sm text-white font-mono bg-white/5 rounded-xl p-4 whitespace-pre-wrap">{result}</pre>
            <button onClick={() => setResult(null)}
              className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
