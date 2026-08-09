import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireBoxOwner } from '@/lib/requireBoxOwner';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

/**
 * Crée (si besoin) le compte Stripe Connect Express de la box
 * et renvoie un lien d'onboarding hébergé par Stripe.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { box_id } = await req.json();

    const guard = await requireBoxOwner(box_id);
    if (!guard.ok) return guard.response;
    const supabase = guard.service;

    const { data: box, error: boxErr } = await supabase
      .from('boxes')
      .select('id, name, slug, owner_id, stripe_account_id')
      .eq('id', box_id)
      .single();

    if (boxErr || !box) {
      return NextResponse.json({ error: 'Box not found' }, { status: 404 });
    }

    const b = box as unknown as {
      id: string; name: string; slug: string | null;
      owner_id: string; stripe_account_id: string | null;
    };

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', b.owner_id)
      .single();

    let accountId = b.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: (profile as { email?: string } | null)?.email ?? undefined,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: b.name,
          product_description: `Programmes d'entraînement — ${b.name}`,
        },
        metadata: { box_id: b.id, supabase_owner_id: b.owner_id },
      });
      accountId = account.id;

      await supabase
        .from('boxes')
        .update({ stripe_account_id: accountId })
        .eq('id', b.id);
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://the-hub-rho.vercel.app';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/programs?connect=refresh`,
      return_url: `${baseUrl}/programs?connect=return`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error('connect/onboard error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
