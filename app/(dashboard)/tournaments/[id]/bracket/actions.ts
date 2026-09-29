'use server';

import { authorizeTournament } from '@/lib/tournaments/authorizeTournament';
import { forfeitPatch, forfeitRefusal } from '@/lib/tournaments/forfeit';
import { tournamentRefusal } from '@/lib/tournaments/refusals';
import type { DecideRow } from '@/lib/tournaments/bracketDecision';

type Result = { ok: true } | { ok: false; error: string };
type AdvanceResult = { ok: true; created: number } | { ok: false; error: string };

/**
 * Toutes les écritures du tableau passent par ces actions serveur, avec le
 * client authentifié de l'appelant (RLS et `is_tournament_manager` voient
 * `auth.uid()`), après la garde commune des tournois : tournoi de la BOX
 * ACTIVE, puis `is_box_admin` (`lib/tournaments/authorizeTournament.ts`).
 */

export async function generateRound1Action(tournamentId: string): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase.rpc('generate_bracket_round_1', { p_tournament_id: tournamentId });
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

export async function advanceRoundAction(tournamentId: string, completedRound: number): Promise<AdvanceResult> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data, error: err } = await supabase.rpc('advance_bracket_round', {
    p_tournament_id: tournamentId, p_completed_round: completedRound,
  });
  if (err) return { ok: false, error: tournamentRefusal(err.message, err.code) };
  return { ok: true, created: typeof data === 'number' ? data : 0 };
}

export async function setMatchWinnerAction(
  tournamentId: string, matchId: string, winnerId: string, loserId: string | null,
): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ winner_id: winnerId, loser_id: loserId, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

/**
 * « Décider selon les scores » : la base décide les matchs en attente du tour
 * (`decide_bracket_round`, athlex-app #354) et rend une ligne par match, avec
 * son vainqueur ou la raison de le laisser à la main. Le WOD du match, s'il en
 * a un, prime sur celui de la manche, côté base.
 */
export async function decideRoundAction(
  tournamentId: string, round: number, wodId: string | null,
): Promise<{ ok: true; rows: DecideRow[] } | { ok: false; error: string }> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data, error: err } = await supabase.rpc('decide_bracket_round', {
    p_tournament_id: tournamentId, p_round: round, p_wod_id: wodId,
  });
  if (err) return { ok: false, error: tournamentRefusal(err.message, err.code) };
  return { ok: true, rows: (data ?? []) as DecideRow[] };
}

export async function setMatchWodAction(
  tournamentId: string, matchId: string, wodId: string | null,
): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ wod_id: wodId || null })
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

/**
 * Double élimination : écrit le WOD de l'étape sur les matchs du tableau des
 * gagnants de ce tour qui n'en ont pas encore et ne sont pas joués, avant
 * « Décider ». La base décide alors chaque match sur son propre WOD, sans WOD
 * de tour qui s'appliquerait aussi aux perdants.
 */
export async function assignStageWodAction(tournamentId: string, round: number, wodId: string): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ wod_id: wodId })
    .eq('tournament_id', tournamentId).eq('round', round).eq('side', 'winner')
    .is('wod_id', null).is('winner_id', null);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

/**
 * Liste « WOD de ce tour » d'une colonne du tableau des perdants : écrit le WOD
 * choisi (ou le retire) sur les matchs non joués de ce tour des perdants. Les
 * matchs joués et les exemptions gardent le leur. `decide_bracket_round`
 * utilise ensuite le WOD propre de chaque match.
 */
export async function setLoserRoundWodAction(tournamentId: string, round: number, wodId: string | null): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ wod_id: wodId || null })
    .eq('tournament_id', tournamentId).eq('round', round).eq('side', 'loser')
    .is('winner_id', null);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

/**
 * Forfait (athlex-app #355) : écrit directement sur le match, comme un
 * vainqueur. Le match est relu en base : l'autre athlète gagne, l'absent perd.
 * Possible sur un match déjà terminé (correction : son ELO est retiré par la
 * base). Aucun ELO pour un forfait.
 */
export async function forfeitMatchAction(tournamentId: string, matchId: string, absentId: string): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data: match } = await supabase
    .from('tournament_bracket_matches').select('participant1_id, participant2_id, status')
    .eq('id', matchId).eq('tournament_id', tournamentId).maybeSingle();
  if (!match) return { ok: false, error: 'Match introuvable.' };
  const patch = forfeitPatch(match, absentId);
  if ('error' in patch) return { ok: false, error: patch.error };
  const { data, error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ ...patch, completed_at: new Date().toISOString() })
    .eq('id', matchId).eq('tournament_id', tournamentId)
    .select('id');
  if (err) return { ok: false, error: forfeitRefusal(err.message, err.code) ?? tournamentRefusal(err.message, err.code) };
  if (!data || data.length === 0) return { ok: false, error: tournamentRefusal('Not authorized') };
  return { ok: true };
}

export async function resetMatchAction(tournamentId: string, matchId: string): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ winner_id: null, loser_id: null, status: 'active', completed_at: null })
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

export async function regenerateBracketAction(tournamentId: string): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  // La base vide et retire le tableau elle-même, et refuse un tableau déjà
  // joué (athlex-app #371) : le Manager ne supprime plus aucun match.
  const { error: genErr } = await supabase.rpc('generate_bracket_round_1', { p_tournament_id: tournamentId });
  return genErr ? { ok: false, error: tournamentRefusal(genErr.message, genErr.code) } : { ok: true };
}

// La grande finale et son match décisif sont créés par la base
// (`advance_bracket_round`, athlex-app #353), jamais à la main.

export async function saveMatchEditAction(
  tournamentId: string,
  matchId: string,
  patch: { participant1_id: string | null; participant2_id: string | null; scheduled_at: string | null; notes: string | null },
): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update(patch)
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}
