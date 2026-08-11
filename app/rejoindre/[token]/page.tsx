import Link from 'next/link';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import JoinInvitationClient, { type InvitationPeek } from './JoinInvitationClient';
import { getServerUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REFUS: Record<string, string> = {
  token_absent: 'Ce lien est incomplet.',
  invitation_introuvable: 'Ce lien d’invitation n’existe pas.',
  invitation_revoquee: 'Cette invitation a été annulée par la box.',
  invitation_deja_utilisee: 'Cette invitation a déjà été utilisée.',
  invitation_expiree: 'Cette invitation a expiré.',
};

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
        <div className="w-full max-w-sm bg-[#111111] rounded-2xl border border-white/8 p-8 text-center">
          <h1 className="text-lg font-bold text-white">Invitation indisponible</h1>
          <p className="text-sm text-gray-400 mt-2">
            {REFUS[reason] ?? 'Ce lien d’invitation n’est plus valide.'}
          </p>
          <p className="text-xs text-gray-500 mt-4">
            Demande un nouveau lien à ta box, ou trouve-la dans l’annuaire.
          </p>
          <Link href="/box" className="inline-block mt-5 text-sm text-white font-semibold hover:underline">
            Voir les box →
          </Link>
        </div>
      </div>
    );
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
