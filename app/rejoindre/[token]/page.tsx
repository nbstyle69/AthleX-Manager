import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import JoinInvitationClient, { type InvitationPeek } from './JoinInvitationClient';
import InvitationUnavailable from './InvitationUnavailable';
import { getServerUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Page publique d'inscription par invitation.
 *
 * La lecture passe par `peek_box_invitation`, seule RPC du lot ouverte à
 * `anon` : elle ne renvoie que la box, la formule et le destinataire. On
 * l'appelle avec la clé anonyme, sans le jeton de session éventuel du
 * visiteur, pour que la page voie exactement ce que voit un inconnu.
 */
export default async function RejoindrePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { data, error } = await anon.rpc('peek_box_invitation', { p_token: token });
  const peek = (data ?? null) as InvitationPeek | null;

  if (error || !peek?.ok) {
    const reason = peek && 'reason' in peek ? (peek.reason as string) : '';
    return <InvitationUnavailable reason={reason} />;
  }

  // Un visiteur déjà connecté ne repasse pas par la création de compte : il lui
  // suffit d'accepter, à condition que son compte porte l'adresse invitée
  // (contrôle refait côté serveur par la RPC, celui-ci n'est qu'un affichage).
  const user = await getServerUser();
  const sessionEmail = (user?.email as string | undefined)?.toLowerCase() ?? null;

  return (
    <JoinInvitationClient
      token={token}
      invitation={peek}
      sessionEmail={sessionEmail}
    />
  );
}
