import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * État Stripe Connect d'une box, lu par les deux surfaces qui en dépendent :
 * le bloc « Paiements » de Réglages (qui l'active) et la page Formules (dont
 * les codes promo n'existent que si le compte est en place).
 */
export interface BoxConnectStatus {
  stripeAccountId: string | null;
  onboardingComplete: boolean;
}

export async function readBoxConnectStatus(
  supabase: SupabaseClient,
  boxId: string,
): Promise<BoxConnectStatus> {
  const { data } = await supabase
    .from('boxes')
    .select('stripe_account_id, stripe_onboarding_complete')
    .eq('id', boxId)
    .maybeSingle();

  return {
    stripeAccountId: (data?.stripe_account_id as string | null) ?? null,
    onboardingComplete: Boolean(data?.stripe_onboarding_complete),
  };
}
