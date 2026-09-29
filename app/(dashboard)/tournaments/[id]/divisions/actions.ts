'use server';

import { authorizeTournament } from '@/lib/tournaments/authorizeTournament';
import { divisionRefusal, endSeasonOutcome } from '@/lib/tournaments/divisions';
import { tournamentRefusal } from '@/lib/tournaments/refusals';

type Fail = { ok: false; error: string };

/** « Répartir par ELO » : la base place les athlètes (`affecter_divisions`, #357) et rend leur nombre. */
export async function affecterDivisionsAction(tournamentId: string): Promise<{ ok: true; placed: number } | Fail> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data, error: err } = await supabase.rpc('affecter_divisions', { p_tournament_id: tournamentId });
  if (err) return { ok: false, error: tournamentRefusal(err.message, err.code) };
  return { ok: true, placed: typeof data === 'number' ? data : 0 };
}

/**
 * « Rendre à l'automatique » : `placement = 'auto'`, sur une ligne d'une
 * division de CE tournoi seulement. La base respecte ce retour explicite.
 */
export async function setAutoPlacementAction(tournamentId: string, memberRowId: string): Promise<{ ok: true } | Fail> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data: divs } = await supabase.from('tournament_divisions').select('id').eq('tournament_id', tournamentId);
  const divisionIds = (divs ?? []).map((d: { id: string }) => d.id);
  if (divisionIds.length === 0) return { ok: false, error: 'Tournoi introuvable.' };
  const { data, error: err } = await supabase
    .from('tournament_division_members')
    .update({ placement: 'auto' })
    .eq('id', memberRowId).in('division_id', divisionIds)
    .select('id');
  if (err) return { ok: false, error: divisionRefusal(err.message, err.code) };
  // Zéro ligne : RLS qui filtre ou athlète d'un autre tournoi — pas un succès.
  if (!data || data.length === 0) return { ok: false, error: divisionRefusal(null, '42501') };
  return { ok: true };
}

/**
 * Fin de saison avec la saison attendue (athlex-app #349) : un second appel
 * (double clic, autre onglet) ne clôt pas une seconde saison.
 */
export async function endSeasonAction(
  tournamentId: string, expectedSeason: number,
): Promise<{ ok: true; closed: boolean; message: string } | Fail> {
  const { supabase, error } = await authorizeTournament(tournamentId);
  if (error) return { ok: false, error };
  const { data, error: err } = await supabase.rpc('end_season_and_advance', {
    p_tournament_id: tournamentId, p_saison_attendue: expectedSeason,
  });
  if (err) return { ok: false, error: tournamentRefusal(err.message, err.code) };
  return { ok: true, ...endSeasonOutcome(expectedSeason, Number(data)) };
}
