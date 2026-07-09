import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

/**
 * Rafraîchit l'état du compte Connect de la box (charges_enabled)
 * et persiste stripe_onboarding_complete.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { box_id } = await req.json();
    if (!box_id) {
      return NextResponse.json({ error: 'box_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: box } = await supabase
      .from('boxes')
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('id', box_id)
      .single();

    const b = box as unknown as {
      id: string; stripe_account_id: string | null; stripe_onboarding_complete: boolean | null;
    } | null;

    if (!b?.stripe_account_id) {
      return NextResponse.json({ connected: false, onboarding_complete: false });
    }

    const account = await stripe.accounts.retrieve(b.stripe_account_id);
    const complete = Boolean(account.charges_enabled && account.details_submitted);

    if (complete !== Boolean(b.stripe_onboarding_complete)) {
      await supabase
        .from('boxes')
        .update({ stripe_onboarding_complete: complete })
        .eq('id', b.id);
    }

    return NextResponse.json({
      connected: true,
      onboarding_complete: complete,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err: any) {
    console.error('connect/status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
