'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Crown, ArrowRight, Trophy, AlertTriangle, RotateCcw, Pencil, Trash2, X, Save, Calendar, Zap, Youtube } from 'lucide-react';
import {
  generateRound1Action, advanceRoundAction, setMatchWinnerAction, applyDecisionsAction,
  setMatchWodAction, resetMatchAction, regenerateBracketAction, saveMatchEditAction,
  createGrandFinalAction,
} from '@/app/(dashboard)/tournaments/[id]/bracket/actions';
import { formatAmrapScore, isRepsScoredType } from '@/lib/movements';

/** A participant's submitted score for a match's WOD, resolved for display. */
interface Submission { label: string; video: string | null; validated: boolean; }

// Human-readable score: For Time → mm:ss, AMRAP/Max Reps → "123 reps (3 tours + 12)",
// anything else → the raw stored value.
function formatScoreLabel(value: string, wod: { type: string | null; reps_per_round: number | null }): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  if ((wod.type ?? '') === 'For Time') {
    if (raw.includes(':')) return raw;
    const secs = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(secs)) return raw;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (isRepsScoredType(wod.type)) {
    const total = parseFloat(raw);
    if (!Number.isNaN(total)) return formatAmrapScore(total, wod.reps_per_round);
  }
  return raw;
}

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
interface Wod { id: string; name: string; type: string | null; position: number | null; bracket_stage: number | null; reps_per_round: number | null; }

interface Props {
  tournamentId: string;
  format: 'bracket' | 'swiss';
  requireVideoProof: boolean;
  finalWodPool: string[];
  initialMatches: Match[];
  profilesById: Record<string, Profile>;
  participantsCount: number;
  wods: Wod[];
  /** Submitted scores per WOD then athlete — shown on cards; validated ones drive auto-decide. */
  scoresByWod?: Record<string, Record<string, { value: string; video: string | null; status: string }>>;
}

export default function BracketManager({
  tournamentId, format, requireVideoProof, finalWodPool,
  initialMatches, profilesById, participantsCount, wods, scoresByWod = {},
}: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Match | null>(null);

  // Tous les participants inscrits (pour le seeding / édition libre).
  const participantsList = useMemo(
    () => Object.values(profilesById).sort((a, b) => a.username.localeCompare(b.username)),
    [profilesById]
  );

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

  // Total number of WB rounds this bracket will have (fixed for the whole bracket,
  // derived from the round-1 participant count) — NOT the count generated so far.
  // Using the fixed total keeps each round mapped to a stable WOD stage while rounds
  // are generated one at a time (round 1 = 8es, …, last = finale = stage 0).
  const totalRounds = useMemo(() => {
    const r1 = grouped.winnerByRound[1] ?? [];
    const n = r1.reduce((acc, m) => acc + (m.participant1_id ? 1 : 0) + (m.participant2_id ? 1 : 0), 0);
    if (n < 2) return winnerRounds.length ? winnerRounds[winnerRounds.length - 1] : 1;
    return Math.max(1, Math.ceil(Math.log2(n)));
  }, [grouped, winnerRounds]);

  // Map each WB round to its assigned WOD via bracket_stage (distance to final).
  function wodForRound(r: number): Wod | undefined {
    const stage = totalRounds - r;
    return wods.find(w => w.bracket_stage === stage);
  }

  // "Temps" (For Time) → le plus petit score gagne ; sinon (AMRAP/reps/…) le plus grand.
  function parseScoreVal(v: string | undefined | null): number | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (s.includes(':')) {
      const parts = s.split(':').map(x => parseFloat(x.replace(',', '.')));
      if (parts.some(p => Number.isNaN(p))) return null;
      return parts.reduce((acc, p) => acc * 60 + p, 0);
    }
    const num = parseFloat(s.replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isNaN(num) ? null : num;
  }

  // Retourne l'athlète gagnant d'après les scores validés du WOD, ou null si indécidable
  // (score manquant/non validé d'un côté, ou égalité → l'owner tranche manuellement).
  function winnerFromScores(wod: Wod, aId: string, bId: string): string | null {
    const map = scoresByWod[wod.id] ?? {};
    const sa = map[aId];
    const sb = map[bId];
    const pa = sa && sa.status === 'validated' ? parseScoreVal(sa.value) : null;
    const pb = sb && sb.status === 'validated' ? parseScoreVal(sb.value) : null;
    if (pa == null || pb == null || pa === pb) return null;
    const higherWins = (wod.type ?? '') !== 'For Time';
    if (higherWins) return pa > pb ? aId : bId;
    return pa < pb ? aId : bId;
  }

  // WOD assigné à un match (colonne explicite sinon la manche).
  function wodForMatch(match: Match): Wod | undefined {
    if (match.wod_id) return wods.find(w => w.id === match.wod_id);
    return wodForRound(match.round);
  }

  // Score soumis d'un athlète pour le WOD du match, formaté pour l'affichage.
  function submissionFor(match: Match, pid: string | null): Submission | null {
    if (!pid) return null;
    const wod = wodForMatch(match);
    if (!wod) return null;
    const sub = scoresByWod[wod.id]?.[pid];
    if (!sub) return null;
    return { label: formatScoreLabel(sub.value, wod), video: sub.video, validated: sub.status === 'validated' };
  }

  // Option : décide automatiquement les gagnants d'une manche selon les meilleurs
  // scores validés. L'owner peut ensuite corriger en cliquant sur un athlète (anti-triche).
  async function autoResolveRound(round: number) {
    const wod = wodForRound(round);
    if (!wod) {
      setError("Aucun WOD assigné à cette manche — impossible de décider selon les scores.");
      return;
    }
    const pending = (grouped.winnerByRound[round] ?? []).filter(
      m => m.status !== 'bye' && m.status !== 'completed' && m.winner_id == null && m.participant1_id && m.participant2_id,
    );
    const decisions = pending
      .map(m => ({ m, w: winnerFromScores(wod, m.participant1_id!, m.participant2_id!) }))
      .filter((d): d is { m: Match; w: string } => d.w != null);
    if (decisions.length === 0) {
      setError("Aucun match décidable : scores validés manquants ou à égalité. Valide d'abord les scores (onglet Scores).");
      return;
    }
    const skipped = pending.length - decisions.length;
    if (!confirm(
      `Décider ${decisions.length} match(s) selon les meilleurs scores validés du WOD « ${wod.name} » ?`
      + (skipped > 0 ? `\n\n${skipped} match(s) sans scores complets resteront à décider à la main.` : '')
      + `\n\nTu pourras corriger un résultat en cliquant sur un athlète (anti-triche).`,
    )) return;
    setBusy(`auto-${round}`); setError(null);
    const nowIso = new Date().toISOString();
    const res = await applyDecisionsAction(tournamentId, decisions.map(({ m, w }) => ({
      matchId: m.id, winnerId: w, loserId: w === m.participant1_id ? m.participant2_id : m.participant1_id,
    })));
    if (!res.ok) { setBusy(null); setError(res.error); return; }
    setMatches(arr => arr.map(m => {
      const d = decisions.find(x => x.m.id === m.id);
      if (!d) return m;
      const loserId = d.w === m.participant1_id ? m.participant2_id : m.participant1_id;
      return { ...m, winner_id: d.w, loser_id: loserId, status: 'completed' as const, completed_at: nowIso };
    }));
    setBusy(null);
  }

  // Latest WB round status
  const lastWBRound = winnerRounds[winnerRounds.length - 1];
  const lastWBMatches = lastWBRound ? grouped.winnerByRound[lastWBRound] : [];
  const lastWBComplete = lastWBMatches.length > 0 && lastWBMatches.every(m => m.winner_id !== null);
  const lastWBHasOneWinner = lastWBMatches.length === 1 && lastWBComplete;

  async function generateRound1() {
    if (!confirm(`Générer le round 1 avec ${participantsCount} participants ?`)) return;
    setBusy('generate'); setError(null);
    const res = await generateRound1Action(tournamentId);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  async function setMatchWinner(match: Match, winnerId: string) {
    const loserId = winnerId === match.participant1_id ? match.participant2_id : match.participant1_id;
    setBusy(match.id); setError(null);
    const res = await setMatchWinnerAction(tournamentId, match.id, winnerId, loserId);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    setMatches(arr => arr.map(m => m.id === match.id
      ? { ...m, winner_id: winnerId, loser_id: loserId, status: 'completed', completed_at: new Date().toISOString() }
      : m));
  }

  async function advanceRound(round: number) {
    setBusy(`advance-${round}`); setError(null);
    const res = await advanceRoundAction(tournamentId, round);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  async function setMatchWod(matchId: string, wodId: string) {
    setBusy(matchId); setError(null);
    const res = await setMatchWodAction(tournamentId, matchId, wodId || null);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    setMatches(arr => arr.map(m => m.id === matchId ? { ...m, wod_id: wodId || null } : m));
  }

  // Annule le vainqueur d'un match (le repasse en "à jouer").
  async function resetMatch(match: Match) {
    if (!confirm(
      `Annuler le résultat du match #${match.match_number} ?\n\n`
      + `Attention : si le round suivant a déjà été généré, ses matchs peuvent devenir incohérents. `
      + `Tu peux alors régénérer le bracket.`
    )) return;
    setBusy(match.id); setError(null);
    const res = await resetMatchAction(tournamentId, match.id);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    setMatches(arr => arr.map(m => m.id === match.id
      ? { ...m, winner_id: null, loser_id: null, status: 'active', completed_at: null }
      : m));
  }

  // Supprime tous les matchs et régénère le round 1 (tirage aléatoire).
  async function regenerateBracket() {
    if (!confirm(
      `Régénérer TOUT le bracket ?\n\n`
      + `Cela supprime tous les matchs existants (y compris les résultats) et retire un nouveau round 1 `
      + `au hasard parmi les ${participantsCount} participants.`
    )) return;
    setBusy('regenerate'); setError(null);
    const res = await regenerateBracketAction(tournamentId);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  // Édition libre d'un match : participants (seeding), date/heure, notes.
  async function saveMatchEdit(
    matchId: string,
    patch: { participant1_id: string | null; participant2_id: string | null; scheduled_at: string | null; notes: string | null }
  ) {
    setBusy(matchId); setError(null);
    const res = await saveMatchEditAction(tournamentId, matchId, patch);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    setMatches(arr => arr.map(m => m.id === matchId ? { ...m, ...patch } : m));
    setEditing(null);
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-[#e0b730] text-[#0A0A0A] disabled:opacity-50 transition-colors">
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Crown size={14} className="text-yellow-400" />
              {format === 'swiss' ? 'Winner Bracket' : 'Bracket'}
            </h2>
            <div className="flex items-center gap-2">
              {/* Auto-decide winners from validated scores (opt-in, overridable) */}
              {(() => {
                const lastRound = winnerRounds[winnerRounds.length - 1];
                const lastMatches = grouped.winnerByRound[lastRound] ?? [];
                const decidable = lastMatches.some(
                  m => m.status !== 'bye' && m.winner_id == null && m.participant1_id && m.participant2_id,
                );
                if (!decidable) return null;
                return (
                  <button onClick={() => autoResolveRound(lastRound)} disabled={busy === `auto-${lastRound}`}
                    title="Décide les gagnants selon les meilleurs scores validés du WOD de la manche. Corrigeable ensuite à la main."
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 disabled:opacity-50 transition-colors">
                    {busy === `auto-${lastRound}` ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    Décider selon les scores
                  </button>
                );
              })()}
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
              <button onClick={regenerateBracket} disabled={busy === 'regenerate'}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 disabled:opacity-50 transition-colors">
                {busy === 'regenerate' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Régénérer
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            Le score soumis par chaque athlète (et sa vidéo si dispo) s'affiche sur sa carte — un <span className="text-gray-400 font-semibold">*</span> signale un score non encore validé (à valider dans l'onglet Scores). Clique sur un athlète pour le désigner vainqueur, ou utilise <span className="text-purple-300 font-semibold">« Décider selon les scores »</span> pour trancher automatiquement d'après les scores validés (le plus grand gagne, ou le plus petit temps pour un WOD « For Time »). Tu peux toujours corriger un résultat à la main. Survole une carte pour éditer (joueurs / date / notes) ou annuler.
          </p>

          <div className="overflow-x-auto pb-2">
            <VisualBracket
              rounds={winnerRounds}
              matchesByRound={grouped.winnerByRound}
              wodForRound={wodForRound}
              onSelectWinner={setMatchWinner}
              onReset={resetMatch}
              onEdit={setEditing}
              busyId={busy}
              pName={pName}
              submissionFor={submissionFor}
            />
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
                  submissionFor={submissionFor}
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

      {/* Modal édition libre d'un match */}
      {editing && (
        <MatchEditModal
          match={editing}
          participants={participantsList}
          busy={busy === editing.id}
          onClose={() => setEditing(null)}
          onSave={saveMatchEdit}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function RoundColumn({
  title, wodName, matches, onSelectWinner, busyId, pName, submissionFor,
}: {
  title: string;
  wodName?: string;
  matches: Match[];
  onSelectWinner: (m: Match, winnerId: string) => void;
  busyId: string | null;
  pName: (id: string | null) => string;
  submissionFor: (m: Match, pid: string | null) => Submission | null;
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
        <MatchCard key={m.id} match={m} onSelectWinner={onSelectWinner} busyId={busyId} pName={pName} submissionFor={submissionFor} />
      ))}
    </div>
  );
}

function MatchCard({
  match, onSelectWinner, busyId, pName, onReset, onEdit, submissionFor,
}: {
  match: Match;
  onSelectWinner: (m: Match, winnerId: string) => void;
  busyId: string | null;
  pName: (id: string | null) => string;
  onReset?: (m: Match) => void;
  onEdit?: (m: Match) => void;
  submissionFor?: (m: Match, pid: string | null) => Submission | null;
}) {
  const isBye = match.status === 'bye';
  const completed = match.status === 'completed';
  const busy = busyId === match.id;

  function row(pid: string | null, label: string) {
    if (!pid) return <div className="text-xs text-gray-600 italic px-3 py-2">{label}</div>;
    const isWinner = match.winner_id === pid;
    const isLoser = match.loser_id === pid;
    const sub = submissionFor?.(match, pid) ?? null;
    return (
      <div className="space-y-0.5">
        <button
          type="button"
          disabled={completed || isBye || busy || !match.participant1_id || !match.participant2_id}
          onClick={() => onSelectWinner(match, pid)}
          className={`w-full text-left rounded-lg px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-between gap-2
            ${isWinner ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : isLoser ? 'bg-white/[0.02] text-gray-500 line-through'
                : 'bg-white/[0.04] text-white hover:bg-white/[0.08] border border-white/5 disabled:opacity-50 disabled:hover:bg-white/[0.04]'}`}
        >
          <span className="truncate">{pName(pid)}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {sub && (
              <span className={`text-[10px] font-bold tabular-nums ${isLoser ? 'text-gray-500' : 'text-gray-300'}`}
                title={sub.validated ? 'Score validé' : 'Score non validé'}>
                {sub.label}{!sub.validated && ' *'}
              </span>
            )}
            {isWinner && <Crown size={12} className="text-yellow-400" />}
          </span>
        </button>
        {sub?.video && (
          <a href={sub.video} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 pl-3 text-[10px] text-red-400 hover:text-red-300 transition-colors">
            <Youtube size={11} className="shrink-0" /> Vidéo
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="group bg-white/[0.02] border border-white/8 rounded-xl p-2 space-y-1 relative">
      <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
        <span className="flex items-center gap-1">
          Match #{match.match_number}
          {match.scheduled_at && (
            <span className="inline-flex items-center gap-0.5 text-gray-500">
              <Calendar size={9} />
              {new Date(match.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {isBye && <span className="text-yellow-400 font-bold">BYE</span>}
          {completed && !isBye && <span className="text-emerald-400 font-bold">✓</span>}
          {/* Actions (hover) */}
          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && !isBye && (
              <button type="button" title="Éditer (joueurs / date / notes)"
                disabled={busy}
                onClick={() => onEdit(match)}
                className="text-gray-400 hover:text-white disabled:opacity-40">
                <Pencil size={11} />
              </button>
            )}
            {onReset && completed && !isBye && (
              <button type="button" title="Annuler le résultat"
                disabled={busy}
                onClick={() => onReset(match)}
                className="text-gray-400 hover:text-red-300 disabled:opacity-40">
                <RotateCcw size={11} />
              </button>
            )}
          </span>
        </span>
      </div>
      {row(match.participant1_id, 'À déterminer')}
      {row(match.participant2_id, isBye ? '—' : 'À déterminer')}
      {match.notes && (
        <p className="text-[10px] text-gray-500 italic px-1 truncate" title={match.notes}>📝 {match.notes}</p>
      )}
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
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createGrandFinal() {
    if (!lbChampionId) return;
    setCreating(true); setErr(null);
    const res = await createGrandFinalAction(tournamentId, wbChampionId, lbChampionId);
    setCreating(false);
    if (!res.ok) { setErr(res.error); return; }
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

/* ─── Bracket visuel (arbre connecté) ─────────────────────────── */

function VisualBracket({
  rounds, matchesByRound, wodForRound, onSelectWinner, onReset, onEdit, busyId, pName, submissionFor,
}: {
  rounds: number[];
  matchesByRound: Record<number, Match[]>;
  wodForRound: (r: number) => Wod | undefined;
  onSelectWinner: (m: Match, winnerId: string) => void;
  onReset: (m: Match) => void;
  onEdit: (m: Match) => void;
  busyId: string | null;
  pName: (id: string | null) => string;
  submissionFor: (m: Match, pid: string | null) => Submission | null;
}) {
  const CARD_H = 132;
  const COL_W = 240;
  const GAP_X = 56;
  const TITLE_H = 56;
  const ROW_UNIT = CARD_H + 40;

  const n0 = matchesByRound[rounds[0]]?.length ?? 1;
  const H = Math.max(n0 * ROW_UNIT, ROW_UNIT);
  const centersFor = (count: number) => {
    const s = H / Math.max(count, 1);
    return Array.from({ length: count }, (_, k) => s * (k + 0.5));
  };

  return (
    <div className="flex items-start min-w-max">
      {rounds.map((r, rIdx) => {
        const ms = matchesByRound[r];
        const centers = centersFor(ms.length);
        const wod = wodForRound(r);
        const isLast = rIdx === rounds.length - 1;
        return (
          <Fragment key={r}>
            <div style={{ width: COL_W }}>
              <div style={{ height: TITLE_H }} className="space-y-1">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {isLast && ms.length === 1 ? 'Finale' : `Round ${r}`}
                </div>
                {wod ? (
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 inline-flex items-center gap-1">
                    🏋️ {wod.name}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600 italic">WOD non assigné</div>
                )}
              </div>
              <div style={{ position: 'relative', height: H, width: COL_W }}>
                {ms.map((m, k) => (
                  <div key={m.id} style={{ position: 'absolute', top: centers[k] - CARD_H / 2, width: COL_W }}>
                    <MatchCard match={m} onSelectWinner={onSelectWinner} busyId={busyId} pName={pName}
                      onReset={onReset} onEdit={onEdit} submissionFor={submissionFor} />
                  </div>
                ))}
              </div>
            </div>
            {!isLast && (
              <Connector
                width={GAP_X}
                titleH={TITLE_H}
                height={H}
                parentCenters={centers}
                childCenters={centersFor(matchesByRound[rounds[rIdx + 1]].length)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Connector({
  width, titleH, height, parentCenters, childCenters,
}: {
  width: number;
  titleH: number;
  height: number;
  parentCenters: number[];
  childCenters: number[];
}) {
  const mid = width / 2;
  const stroke = 'rgba(255,255,255,0.16)';
  return (
    <div style={{ width }}>
      <div style={{ height: titleH }} />
      <svg width={width} height={height} style={{ display: 'block' }}>
        {childCenters.map((cc, j) => {
          const p1 = parentCenters[2 * j];
          const p2 = parentCenters[2 * j + 1];
          if (p1 == null) return null;
          if (p2 == null) {
            return (
              <path key={j} d={`M0 ${p1} H ${mid} V ${cc} H ${width}`} stroke={stroke} strokeWidth={2} fill="none" />
            );
          }
          return (
            <g key={j} stroke={stroke} strokeWidth={2} fill="none">
              <path d={`M0 ${p1} H ${mid}`} />
              <path d={`M0 ${p2} H ${mid}`} />
              <path d={`M${mid} ${p1} V ${p2}`} />
              <path d={`M${mid} ${cc} H ${width}`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Modal édition libre d'un match ──────────────────────────── */

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MatchEditModal({
  match, participants, busy, onClose, onSave,
}: {
  match: Match;
  participants: Profile[];
  busy: boolean;
  onClose: () => void;
  onSave: (
    matchId: string,
    patch: { participant1_id: string | null; participant2_id: string | null; scheduled_at: string | null; notes: string | null }
  ) => void;
}) {
  const [p1, setP1] = useState(match.participant1_id ?? '');
  const [p2, setP2] = useState(match.participant2_id ?? '');
  const [sched, setSched] = useState(match.scheduled_at ? toDatetimeLocal(match.scheduled_at) : '');
  const [notes, setNotes] = useState(match.notes ?? '');

  function submit() {
    onSave(match.id, {
      participant1_id: p1 || null,
      participant2_id: p2 || null,
      scheduled_at: sched ? new Date(sched).toISOString() : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Pencil size={14} className="text-white" />
            Éditer le match #{match.match_number}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Joueur 1 (seeding)</label>
          <select value={p1} onChange={e => setP1(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
            <option value="" className="text-black">— Aucun —</option>
            {participants.map(p => <option key={p.id} value={p.id} className="text-black">{p.username}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Joueur 2 (seeding)</label>
          <select value={p2} onChange={e => setP2(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
            <option value="" className="text-black">— Aucun —</option>
            {participants.map(p => <option key={p.id} value={p.id} className="text-black">{p.username}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date / heure</label>
          <input type="datetime-local" value={sched} onChange={e => setSched(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Ex. tapis 3, juge attribué…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none" />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            Annuler
          </button>
          <button onClick={submit} disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-[#e0b730] text-[#0A0A0A] disabled:opacity-50 transition-colors">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
