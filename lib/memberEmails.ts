import { SupabaseClient } from '@supabase/supabase-js';

/**
 * E-mails des membres d'une box, indexés par `member_id`.
 *
 * `profiles.email` n'est plus lisible par `authenticated` (Phase 3) : une
 * colonne refusée fait échouer TOUTE la requête PostgREST, y compris l'embed
 * `profile:profiles(username, email)`. La RPC `get_box_member_emails` ne les
 * rend qu'aux admins de la box.
 */
export async function getMemberEmails(
  supabase: SupabaseClient,
  boxId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc('get_box_member_emails', { p_box_id: boxId });
  const rows = (data ?? []) as { member_id: string; email: string }[];
  return new Map(rows.map((r) => [r.member_id, r.email]));
}
