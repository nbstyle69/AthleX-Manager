'use server';

import { createClient, getActiveBox } from '@/lib/supabase/server';
import { tournamentRefusal } from '@/lib/tournaments/refusals';
import type { DecideRow } from '@/lib/tournaments/bracketDecision';

type Result = { ok: true } | { ok: false; error: string };
type AdvanceResult = { ok: true; created: number } | { ok: false; error: string };

/**
 * The back-office authenticates only via the HttpOnly `sb-access-token` cookie,
 * which the browser Supabase client cannot read — so client-side writes run
 * anonymously and are silently dropped by RLS. All bracket mutations therefore
 * go through these server actions, which use the authenticated server client
 * (RLS + `is_tournament_manager` see `auth.uid()`), guarded by `is_box_admin`.
 */
async function authorize(tournamentId: string) {
  const supabase = await createClient();

  // Le tournoi doit appartenir à la BOX ACTIVE, et pas seulement à une box
  // que l'appelant administre : un gérant de plusieurs box écrirait sinon sur
  // l'une pendant qu'il travaille dans l'autre, sans que l'écran le dise.
  // C'est aussi le contrôle que font les pages (`getTournamentForActiveBox`) ;
  // il est refait ici parce qu'une page n'est pas une garde.
  const box = await getActiveBox(supabase);
  if (!box) return { supabase, error: 'Aucune box active.' as const };

  const { data: t } = await supabase
    .from('tournaments').select('box_id').eq('id', tournamentId).eq('box_id', box.id).maybeSingle();
  if (!t) return { supabase, error: 'Tournoi introuvable.' as const };

  // `is_box_admin` reste : la box active dit SUR QUOI on travaille, le rôle
  // dit si on a le droit d'y écrire. Les deux sont nécessaires.
  const { data: allowed } = await supabase.rpc('is_box_admin', { p_box_id: t.box_id });
  if (!allowed) return { supabase, error: 'Non autorisé : réservé à l’owner/coach de la box.' as const };
  return { supabase, error: null };
}

export async function generateRound1Action(tournamentId: string): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase.rpc('generate_bracket_round_1', { p_tournament_id: tournamentId });
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

export async function advanceRoundAction(tournamentId: string, completedRound: number): Promise<AdvanceResult> {
  const { supabase, error } = await authorize(tournamentId);
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
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ winner_id: winnerId, loser_id: loserId, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: err.message } : { ok: true };
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
  const { supabase, error } = await authorize(tournamentId);
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
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ wod_id: wodId || null })
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: err.message } : { ok: true };
}

/**
 * Double élimination : écrit le WOD de l'étape sur les matchs du tableau des
 * gagnants de ce tour qui n'en ont pas encore et ne sont pas joués, avant
 * « Décider ». La base décide alors chaque match sur son propre WOD, sans WOD
 * de tour qui s'appliquerait aussi aux perdants.
 */
export async function assignStageWodAction(tournamentId: string, round: number, wodId: string): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
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
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ wod_id: wodId || null })
    .eq('tournament_id', tournamentId).eq('round', round).eq('side', 'loser')
    .is('winner_id', null);
  return err ? { ok: false, error: tournamentRefusal(err.message, err.code) } : { ok: true };
}

export async function resetMatchAction(tournamentId: string, matchId: string): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update({ winner_id: null, loser_id: null, status: 'active', completed_at: null })
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: err.message } : { ok: true };
}

export async function regenerateBracketAction(tournamentId: string): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
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
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase
    .from('tournament_bracket_matches')
    .update(patch)
    .eq('id', matchId).eq('tournament_id', tournamentId);
  return err ? { ok: false, error: err.message } : { ok: true };
}
