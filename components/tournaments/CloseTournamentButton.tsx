'use client';

import { useState } from 'react';
import { Loader2, Lock, AlertTriangle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

/** Ligne rendue par la RPC `finalize_tournament_elo` (une par participant). */
interface FinalizedRow {
  athlete_id: string;
  username: string | null;
  final_rank: number;
  elo_before: number;
  elo_after: number;
  elo_change: number;
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

  const isCompleted = status === 'completed';

  // Clôturé : la RPC refuse une seconde distribution (TOURNOI_DEJA_CLOTURE),
  // il n'y a donc rien à proposer. En ligue, les saisons se ferment dans
  // l'onglet Divisions (end_season_and_advance) ; la clôture finale passe ici.
  if (isCompleted) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-white/5 cursor-default">
        <Lock size={12} /> Tournoi clôturé
      </div>
    );
  }

  // Une seule écriture, côté serveur : classement, historique ELO, profils et
  // statut dans la même transaction. Aucune écriture profiles /
  // tournament_elo_history depuis le client (cf. règle 19).
  async function handleClose() {
    setClosing(true);
    setError(null);
    const supabase = createClient();

    const { data, error: rpcErr } = await supabase.rpc('finalize_tournament_elo', {
      p_tournament_id: tournamentId,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setClosing(false);
      return;
    }

    const rows = ((data ?? []) as FinalizedRow[]).slice().sort((a, b) => a.final_rank - b.final_rank);
    setClosing(false);
    setOpen(false);

    const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);
    const recap = rows.slice(0, 5).map(e =>
      `${medal(e.final_rank)} ${e.username ?? '?'}: ${e.elo_change >= 0 ? '+' : ''}${e.elo_change} ELO`
    ).join('\n');
    setResult(recap + (rows.length > 5 ? `\n…et ${rows.length - 5} autres` : ''));
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
        <Zap size={13} /> Distribuer l'ELO et clôturer
      </button>

      {open && !result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-black text-white mb-1">Distribuer l'ELO et clôturer ?</h2>
                <p className="text-sm text-gray-400">
                  {format === 'bracket' || format === 'swiss' || format === 'league_div'
                    ? 'Le classement final est figé et inscrit à l’historique de chaque participant (l’ELO a déjà été distribué match par match). Le tournoi passe « Clôturé » — définitif.'
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
            <h2 className="text-base font-black text-white">✅ Tournoi clôturé !</h2>
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
