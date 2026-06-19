'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Play, Crown, ArrowRight, Trophy, AlertTriangle } from 'lucide-react';

interface Match {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  side: 'winner' | 'loser' | 'grand_final';
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  wod_id: string | null;
  status: 'pending' | 'active' | 'completed' | 'bye';
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

interface Profile { id: string; username: string; level: string; elo: number; }
interface Wod { id: string; name: string; position: number | null; bracket_stage: number | null; }

interface Props {
  tournamentId: string;
  format: 'bracket' | 'swiss';
  requireVideoProof: boolean;
  finalWodPool: string[];
  initialMatches: Match[];
  profilesById: Record<string, Profile>;
  participantsCount: number;
  wods: Wod[];
}

export default function BracketManager({
  tournamentId, format, requireVideoProof, finalWodPool,
  initialMatches, profilesById, participantsCount, wods,
}: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const grouped = useMemo(() => {
    const winnerByRound: Record<number, Match[]> = {};
    const loserByRound: Record<number, Match[]> = {};
    let grandFinal: Match | null = null;
    matches.forEach(m => {
      if (m.side === 'grand_final') grandFinal = m;
      else if (m.side === 'winner') (winnerByRound[m.round] ??= []).push(m);
      else if (m.side === 'loser') (loserByRound[m.round] ??= []).push(m);
    });
    Object.values(winnerByRound).forEach(arr => arr.sort((a, b) => a.match_number - b.match_number));
    Object.values(loserByRound).forEach(arr => arr.sort((a, b) => a.match_number - b.match_number));
    return { winnerByRound, loserByRound, grandFinal };
  }, [matches]);

  const winnerRounds = Object.keys(grouped.winnerByRound).map(Number).sort((a, b) => a - b);
  const loserRounds = Object.keys(grouped.loserByRound).map(Number).sort((a, b) => a - b);

  // Map each WB round to its assigned WOD via bracket_stage (distance to final).
  const maxWBRound = winnerRounds.length ? winnerRounds[winnerRounds.length - 1] : 0;
  function wodForRound(r: number): Wod | undefined {
    const stage = maxWBRound - r;
    return wods.find(w => w.bracket_stage === stage);
  }

  // Latest WB round status
  const lastWBRound = winnerRounds[winnerRounds.length - 1];
  const lastWBMatches = lastWBRound ? grouped.winnerByRound[lastWBRound] : [];
  const lastWBComplete = lastWBMatches.length > 0 && lastWBMatches.every(m => m.winner_id !== null);
  const lastWBHasOneWinner = lastWBMatches.length === 1 && lastWBComplete;

  async function generateRound1() {
    if (!confirm(`Générer le round 1 avec ${participantsCount} participants ?`)) return;
    setBusy('generate'); setError(null);
    const { error: err } = await supabase.rpc('generate_bracket_round_1', { p_tournament_id: tournamentId });
    setBusy(null);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  async function setMatchWinner(match: Match, winnerId: string) {
    const loserId = winnerId === match.participant1_id ? match.participant2_id : match.participant1_id;
    setBusy(match.id); setError(null);
    const { error: err } = await supabase
      .from('tournament_bracket_matches')
      .update({ winner_id: winnerId, loser_id: loserId, status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', match.id);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setMatches(arr => arr.map(m => m.id === match.id
      ? { ...m, winner_id: winnerId, loser_id: loserId, status: 'completed', completed_at: new Date().toISOString() }
      : m));
  }

  async function advanceRound(round: number) {
    setBusy(`advance-${round}`); setError(null);
    const { error: err } = await supabase.rpc('advance_bracket_round', {
      p_tournament_id: tournamentId, p_completed_round: round,
    });
    setBusy(null);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  async function setMatchWod(matchId: string, wodId: string) {
    setBusy(matchId); setError(null);
    const { error: err } = await supabase
      .from('tournament_bracket_matches')
      .update({ wod_id: wodId || null })
      .eq('id', matchId);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setMatches(arr => arr.map(m => m.id === matchId ? { ...m, wod_id: wodId || null } : m));
  }

  function pName(id: string | null) {
    if (!id) return '—';
    return profilesById[id]?.username ?? id.slice(0, 8);
  }

  const allWBComplete = winnerRounds.length > 0 && winnerRounds.every(r =>
    grouped.winnerByRound[r].every(m => m.winner_id !== null)
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {requireVideoProof && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300">
          Preuve vidéo requise : valide les vainqueurs uniquement après vérification de la vidéo soumise.
        </div>
      )}

      {/* Generate round 1 */}
      {matches.length === 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-400 mb-4">
            Aucun match généré. {participantsCount} participant(s) inscrit(s).
          </p>
          <button onClick={generateRound1} disabled={busy === 'generate' || participantsCount < 2}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] hover:bg-[#e0b730] text-white disabled:opacity-50 transition-colors">
            {busy === 'generate' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Générer le round 1
          </button>
          {participantsCount < 2 && (
            <p className="text-xs text-gray-500 mt-3">Au moins 2 participants requis.</p>
          )}
        </div>
      )}

      {/* Winner Bracket */}
      {winnerRounds.length > 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Crown size={14} className="text-yellow-400" />
              {format === 'swiss' ? 'Winner Bracket' : 'Bracket'}
            </h2>
            {/* Advance round button */}
            {(() => {
              const lastRound = winnerRounds[winnerRounds.length - 1];
              const lastMatches = grouped.winnerByRound[lastRound];
              const allDone = lastMatches.every(m => m.winner_id !== null);
              const lastHasOnlyOne = lastMatches.length === 1;
              if (!allDone || lastHasOnlyOne) return null;
              return (
                <button onClick={() => advanceRound(lastRound)} disabled={busy === `advance-${lastRound}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors">
                  {busy === `advance-${lastRound}` ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                  Round suivant
                </button>
              );
            })()}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-6 min-w-max">
              {winnerRounds.map(r => (
                <RoundColumn key={`w-${r}`} title={`Round ${r}`}
                  wodName={wodForRound(r)?.name}
                  matches={grouped.winnerByRound[r]}
                  onSelectWinner={setMatchWinner}
                  busyId={busy}
                  pName={pName}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loser Bracket (swiss) */}
      {format === 'swiss' && loserRounds.length > 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Loser Bracket</h2>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-6 min-w-max">
              {loserRounds.map(r => (
                <RoundColumn key={`l-${r}`} title={`LB Round ${r}`}
                  matches={grouped.loserByRound[r]}
                  onSelectWinner={setMatchWinner}
                  busyId={busy}
                  pName={pName}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grand final (swiss) */}
      {format === 'swiss' && lastWBHasOneWinner && allWBComplete && (
        <div className="bg-[#111111] border border-yellow-500/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-2">
            <Trophy size={14} /> Grande finale
          </h2>
          <p className="text-xs text-gray-400">
            Le champion du Winner Bracket choisit le WOD de la grande finale parmi le pool configuré.
          </p>
          <GrandFinalSection
            tournamentId={tournamentId}
            wbChampionId={lastWBMatches[0].winner_id!}
            lbChampionId={(() => {
              const lastLB = loserRounds[loserRounds.length - 1];
              if (!lastLB) return null;
              const lbMatches = grouped.loserByRound[lastLB];
              if (lbMatches.length === 1 && lbMatches[0].winner_id) return lbMatches[0].winner_id;
              return null;
            })()}
            grandFinal={grouped.grandFinal}
            wodOptions={wods.filter(w => finalWodPool.length === 0 || finalWodPool.includes(w.id))}
            pName={pName}
            onChange={() => router.refresh()}
            onSetWodForFinal={setMatchWod}
            onSelectWinner={setMatchWinner}
            busyId={busy}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function RoundColumn({
  title, wodName, matches, onSelectWinner, busyId, pName,
}: {
  title: string;
  wodName?: string;
  matches: Match[];
  onSelectWinner: (m: Match, winnerId: string) => void;
  busyId: string | null;
  pName: (id: string | null) => string;
}) {
  return (
    <div className="w-64 shrink-0 space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</div>
        {wodName ? (
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 inline-flex items-center gap-1">
            🏋️ {wodName}
          </div>
        ) : (
          <div className="text-[10px] text-gray-600 italic">WOD non assigné</div>
        )}
      </div>
      {matches.map(m => (
        <MatchCard key={m.id} match={m} onSelectWinner={onSelectWinner} busyId={busyId} pName={pName} />
      ))}
    </div>
  );
}

function MatchCard({
  match, onSelectWinner, busyId, pName,
}: {
  match: Match;
  onSelectWinner: (m: Match, winnerId: string) => void;
  busyId: string | null;
  pName: (id: string | null) => string;
}) {
  const isBye = match.status === 'bye';
  const completed = match.status === 'completed';
  const busy = busyId === match.id;

  function row(pid: string | null, label: string) {
    if (!pid) return <div className="text-xs text-gray-600 italic">{label}</div>;
    const isWinner = match.winner_id === pid;
    const isLoser = match.loser_id === pid;
    return (
      <button
        type="button"
        disabled={completed || isBye || busy || !match.participant1_id || !match.participant2_id}
        onClick={() => onSelectWinner(match, pid)}
        className={`w-full text-left rounded-lg px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-between
          ${isWinner ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : isLoser ? 'bg-white/[0.02] text-gray-500 line-through'
              : 'bg-white/[0.04] text-white hover:bg-white/[0.08] border border-white/5 disabled:opacity-50 disabled:hover:bg-white/[0.04]'}`}
      >
        <span className="truncate">{pName(pid)}</span>
        {isWinner && <Crown size={12} className="text-yellow-400 shrink-0" />}
      </button>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl p-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
        <span>Match #{match.match_number}</span>
        {isBye && <span className="text-yellow-400 font-bold">BYE</span>}
        {completed && !isBye && <span className="text-emerald-400 font-bold">✓</span>}
      </div>
      {row(match.participant1_id, 'À déterminer')}
      {row(match.participant2_id, isBye ? '—' : 'À déterminer')}
    </div>
  );
}

function GrandFinalSection({
  tournamentId, wbChampionId, lbChampionId, grandFinal, wodOptions, pName,
  onChange, onSetWodForFinal, onSelectWinner, busyId,
}: {
  tournamentId: string;
  wbChampionId: string;
  lbChampionId: string | null;
  grandFinal: Match | null;
  wodOptions: Wod[];
  pName: (id: string | null) => string;
  onChange: () => void;
  onSetWodForFinal: (matchId: string, wodId: string) => void;
  onSelectWinner: (m: Match, winnerId: string) => void;
  busyId: string | null;
}) {
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createGrandFinal() {
    if (!lbChampionId) return;
    setCreating(true); setErr(null);
    const { error } = await supabase.from('tournament_bracket_matches').insert({
      tournament_id: tournamentId, round: 99, match_number: 1, side: 'grand_final',
      participant1_id: wbChampionId, participant2_id: lbChampionId, status: 'pending',
    });
    setCreating(false);
    if (error) { setErr(error.message); return; }
    onChange();
  }

  if (!lbChampionId) {
    return (
      <p className="text-xs text-gray-500 italic">
        En attente du champion du Loser Bracket. Termine le LB pour activer la grande finale.
      </p>
    );
  }

  if (!grandFinal) {
    return (
      <div className="space-y-2">
        {err && <div className="text-xs text-red-400">{err}</div>}
        <p className="text-xs text-gray-300">
          <span className="font-bold text-yellow-300">{pName(wbChampionId)}</span> (WB) vs{' '}
          <span className="font-bold">{pName(lbChampionId)}</span> (LB)
        </p>
        <button onClick={createGrandFinal} disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50 transition-colors">
          {creating && <Loader2 size={12} className="animate-spin" />}
          Créer la grande finale
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white/[0.02] border border-yellow-500/20 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-yellow-400 font-bold uppercase">
          <span>Grande finale</span>
          {grandFinal.status === 'completed' && <span>✓ Terminée</span>}
        </div>

        <div className="text-xs text-gray-400">
          WOD choisi par <span className="font-bold text-yellow-300">{pName(wbChampionId)}</span> :
        </div>
        <select value={grandFinal.wod_id ?? ''}
          onChange={e => onSetWodForFinal(grandFinal.id, e.target.value)}
          disabled={grandFinal.status === 'completed' || busyId === grandFinal.id}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
          <option value="" className="text-black">— Sélectionner un WOD —</option>
          {wodOptions.map(w => (
            <option key={w.id} value={w.id} className="text-black">{w.name}</option>
          ))}
        </select>

        {/* Pick winner */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            disabled={grandFinal.status === 'completed' || !grandFinal.wod_id || busyId === grandFinal.id}
            onClick={() => onSelectWinner(grandFinal, wbChampionId)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors
              ${grandFinal.winner_id === wbChampionId
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.04] text-white hover:bg-white/[0.08] border border-white/5 disabled:opacity-50'}`}
          >
            {pName(wbChampionId)} (WB)
          </button>
          <button
            disabled={grandFinal.status === 'completed' || !grandFinal.wod_id || busyId === grandFinal.id}
            onClick={() => onSelectWinner(grandFinal, lbChampionId!)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors
              ${grandFinal.winner_id === lbChampionId
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.04] text-white hover:bg-white/[0.08] border border-white/5 disabled:opacity-50'}`}
          >
            {pName(lbChampionId)} (LB)
          </button>
        </div>
      </div>
    </div>
  );
}
