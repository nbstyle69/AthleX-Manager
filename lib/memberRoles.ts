/**
 * Choix de rôle proposés sur la page Membres.
 *
 * Règle produit (29/09/2026) : seul le gérant principal (`boxes.owner_id`)
 * donne ou retire le rôle co-gérant — un co-gérant nommé a accès à l'argent.
 * Un co-gérant garde la gestion des autres rôles (membre, coach). La garde
 * en base (athlex-app) refuse l'écriture ; l'écran ne propose pas ce que la
 * base refuserait.
 */
export type MemberRole = 'member' | 'coach' | 'owner';

export function roleChoices(isPrimaryOwner: boolean, memberRole: MemberRole): MemberRole[] {
  if (isPrimaryOwner) return ['member', 'coach', 'owner'];
  // Retirer le rôle à un co-gérant existant est aussi réservé au gérant principal.
  return memberRole === 'owner' ? [] : ['member', 'coach'];
}

export const CO_OWNER_RESERVED =
  'Seul le gérant principal de la box peut nommer ou retirer un co-gérant.';

/** Message d'un refus d'écriture du rôle ; le refus de la garde (42501) est nommé. */
export function roleErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === '42501') return CO_OWNER_RESERVED;
  return error.message || 'Le rôle n’a pas été modifié.';
}
