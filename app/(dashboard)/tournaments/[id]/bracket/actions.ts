'use server';

import { createClient } from '@/lib/supabase/server';

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
  const { data: t } = await supabase
    .from('tournaments').select('box_id').eq('id', tournamentId).single();
  if (!t) return { supabase, error: 'Tournoi introuvable.' as const };
  const { data: allowed } = await supabase.rpc('is_box_admin', { p_box_id: t.box_id });
  if (!allowed) return { supabase, error: 'Non autorisé : réservé à l’owner/coach de la box.' as const };
  return { supabase, error: null };
}

export async function generateRound1Action(tournamentId: string): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase.rpc('generate_bracket_round_1', { p_tournament_id: tournamentId });
  return err ? { ok: false, error: err.message } : { ok: true };
}

export async function advanceRoundAction(tournamentId: string, completedRound: number): Promise<AdvanceResult> {
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { data, error: err } = await supabase.rpc('advance_bracket_round', {
    p_tournament_id: tournamentId, p_completed_round: completedRound,
  });
  if (err) return { ok: false, error: err.message };
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

export async function applyDecisionsAction(
  tournamentId: string,
  decisions: { matchId: string; winnerId: string; loserId: string | null }[],
): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const nowIso = new Date().toISOString();
  for (const d of decisions) {
    const { error: err } = await supabase
      .from('tournament_bracket_matches')
      .update({ winner_id: d.winnerId, loser_id: d.loserId, status: 'completed', completed_at: nowIso })
      .eq('id', d.matchId).eq('tournament_id', tournamentId);
    if (err) return { ok: false, error: err.message };
  }
  return { ok: true };
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
  const { error: delErr } = await supabase
    .from('tournament_bracket_matches').delete().eq('tournament_id', tournamentId);
  if (delErr) return { ok: false, error: delErr.message };
  const { error: genErr } = await supabase.rpc('generate_bracket_round_1', { p_tournament_id: tournamentId });
  return genErr ? { ok: false, error: genErr.message } : { ok: true };
}

export async function createGrandFinalAction(
  tournamentId: string, wbChampionId: string, lbChampionId: string,
): Promise<Result> {
  const { supabase, error } = await authorize(tournamentId);
  if (error) return { ok: false, error };
  const { error: err } = await supabase.from('tournament_bracket_matches').insert({
    tournament_id: tournamentId, round: 99, match_number: 1, side: 'grand_final',
    participant1_id: wbChampionId, participant2_id: lbChampionId, status: 'pending',
  });
  return err ? { ok: false, error: err.message } : { ok: true };
}

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
