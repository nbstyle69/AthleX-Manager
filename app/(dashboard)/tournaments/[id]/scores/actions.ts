'use server';

import { authorizeTournament } from '@/lib/tournaments/authorizeTournament';
import { divisionRefusal } from '@/lib/tournaments/divisions';

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
