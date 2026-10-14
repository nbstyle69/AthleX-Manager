import { cashPaymentError } from '@/lib/comptoir/counter';

/** Ce qu'on encaisse : l'adhésion d'un membre, ou une invitation « encaissement box ». */
export type CashTarget =
  | { kind: 'member'; boxMemberId: string }
  | { kind: 'invitation'; invitationId: string };

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Enregistre l'encaissement par la RPC de la base, qui lit le prix, calcule la
 * période et journalise (le montant n'est jamais envoyé). Rend la fin d'accès
 * renvoyée par la base — seule autorité — ou une erreur lisible.
 */
export async function recordCashPayment(
  supabase: RpcClient, target: CashTarget, months: number,
): Promise<{ ok: true; accessUntil: string | null } | { ok: false; error: string }> {
  const { data, error } = target.kind === 'member'
    ? await supabase.rpc('record_member_cash_payment', { p_box_member_id: target.boxMemberId, p_months: months })
    : await supabase.rpc('mark_box_invitation_paid', { p_invitation_id: target.invitationId, p_months: months });
  if (error) return { ok: false, error: cashPaymentError(error.message) };
  return { ok: true, accessUntil: (data as { access_until?: string | null } | null)?.access_until ?? null };
}
