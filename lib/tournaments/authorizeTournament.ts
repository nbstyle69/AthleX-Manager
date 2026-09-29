import { createClient, getActiveBox } from '@/lib/supabase/server';

/**
 * Garde des actions serveur d'un tournoi : même contrôle que les actions du
 * tableau (`bracket/actions.ts`). Le tournoi doit appartenir à la BOX ACTIVE,
 * et l'appelant doit l'administrer (`is_box_admin`). Les écritures passent
 * ensuite par le client de l'appelant : la RLS et les fonctions de la base
 * (`is_tournament_manager`) refont leur propre contrôle.
 */
export async function authorizeTournament(tournamentId: string) {
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  if (!box) return { supabase, error: 'Aucune box active.' as const };

  const { data: t } = await supabase
    .from('tournaments').select('box_id').eq('id', tournamentId).eq('box_id', box.id).maybeSingle();
  if (!t) return { supabase, error: 'Tournoi introuvable.' as const };

  const { data: allowed } = await supabase.rpc('is_box_admin', { p_box_id: t.box_id });
  if (!allowed) return { supabase, error: 'Tu n’as pas les droits pour gérer ce tournoi.' as const };
  return { supabase, error: null };
}
