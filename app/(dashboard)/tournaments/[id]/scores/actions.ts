'use server';

import { authorizeTournament } from '@/lib/tournaments/authorizeTournament';
import { divisionRefusal } from '@/lib/tournaments/divisions';
import { SCORE_NOT_UPDATED, tournamentRefusal } from '@/lib/tournaments/refusals';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Écritures de l'écran Scores : score de CE tournoi, de la box active, par un
 * administrateur. Un refus de la base ou zéro ligne modifiée est un échec, dit
 * en français : l'écran n'affiche alors aucun changement.
 */
async function writeScore(tournamentId: string, scoreId: string, patch: Record<string, unknown>): Promise<Result> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data, error: err } = await supabase
    .from('tournament_scores')
    .update(patch)
    .eq('id', scoreId).eq('tournament_id', tournamentId)
    .select('id');
  if (err) return { ok: false, error: tournamentRefusal(err.message, err.code) };
  if (!data || data.length === 0) return { ok: false, error: SCORE_NOT_UPDATED };
  return { ok: true };
}

export async function setScoreStatusAction(tournamentId: string, scoreId: string, status: 'validated' | 'rejected'): Promise<Result> {
  return writeScore(tournamentId, scoreId, status === 'validated' ? { status, validated_at: new Date().toISOString() } : { status });
}

export async function setScoreValueAction(tournamentId: string, scoreId: string, scoreValue: string): Promise<Result> {
  return writeScore(tournamentId, scoreId, { score_value: scoreValue });
}

export async function setAdminMessageAction(tournamentId: string, scoreId: string, message: string | null): Promise<Result> {
  return writeScore(tournamentId, scoreId, { admin_message: message });
}

/**
 * « Division de ce score » (athlex-app #350) : corrige `tournament_scores.division_id`,
 * colonne réservée au staff. La division doit être une division de CE
 * tournoi, et le score un score de CE tournoi.
 */
export async function setScoreDivisionAction(
  tournamentId: string, scoreId: string, divisionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data: div } = await supabase
    .from('tournament_divisions').select('id').eq('id', divisionId).eq('tournament_id', tournamentId).maybeSingle();
  if (!div) return { ok: false, error: 'Cette division n’appartient pas à ce tournoi.' };
  const { data, error: err } = await supabase
    .from('tournament_scores')
    .update({ division_id: divisionId })
    .eq('id', scoreId).eq('tournament_id', tournamentId)
    .select('id');
  if (err) return { ok: false, error: divisionRefusal(err.message, err.code) };
  if (!data || data.length === 0) return { ok: false, error: divisionRefusal(null, '42501') };
  return { ok: true };
}
