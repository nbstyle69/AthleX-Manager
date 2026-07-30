import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

// Commission plateforme AthleX (%). Peut être surchargée via env.
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? '4');

/**
 * Checkout Stripe Connect pour l'abonnement d'une box cliente à une
 * programmation payante publiée par une autre box (marketplace box → box).
 * Charge directe sur le compte connecté de la box éditrice + application_fee
 * au bénéfice d'AthleX. L'abonnement (box_programming_subscriptions) est activé
 * par le webhook Connect (kind='box_programming') à la confirmation du paiement.
 *
 * one_time → mode 'payment'      (paiement unique)
 * monthly  → mode 'subscription' (abonnement mensuel)
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { programming_id, subscriber_box_id } = await req.json();
    if (!programming_id || !subscriber_box_id) {
      return NextResponse.json(
        { error: 'programming_id et subscriber_box_id requis' },
        { status: 400 },
      );
    }

    // Autorisation : le user courant doit gérer la box cliente (owner direct ou
    // owner/coach membre actif). On ne fait jamais confiance au client.
    const authed = await createClient();
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const supabase = createServiceClient();

    const { data: ownedBox } = await supabase
      .from('boxes').select('id').eq('id', subscriber_box_id).eq('owner_id', user.id).maybeSingle();
    let manages = !!ownedBox;
    if (!manages) {
      const { data: membership } = await supabase
        .from('box_members')
        .select('id')
        .eq('box_id', subscriber_box_id)
        .eq('member_id', user.id)
        .in('role', ['owner', 'coach'])
        .maybeSingle();
      manages = !!membership;
    }
    if (!manages) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    // Offre + éditrice.
    const { data: prog, error: progErr } = await supabase
      .from('box_programming')
      .select('id, publisher_box_id, title, description, price_cents, currency, billing, is_published, stripe_product_id, stripe_price_id')
      .eq('id', programming_id)
      .single();
    if (progErr || !prog) {
      return NextResponse.json({ error: 'Programmation introuvable' }, { status: 404 });
    }
    const p = prog as unknown as {
      id: string; publisher_box_id: string; title: string; description: string | null;
      price_cents: number; currency: string; billing: 'free' | 'one_time' | 'monthly';
      is_published: boolean; stripe_product_id: string | null; stripe_price_id: string | null;
    };

    if (!p.is_published) {
      return NextResponse.json({ error: 'Cette programmation n\'est pas publiée.' }, { status: 400 });
    }
    if (p.billing === 'free' || p.price_cents <= 0) {
      return NextResponse.json(
        { error: 'Cette programmation est gratuite — abonne-toi directement.' },
        { status: 400 },
      );
    }
    if (p.publisher_box_id === subscriber_box_id) {
      return NextResponse.json({ error: 'Une box ne peut pas s\'abonner à sa propre offre.' }, { status: 400 });
    }

    // Déjà abonnée ?
    const { data: existingSub } = await supabase
      .from('box_programming_subscriptions')
      .select('id, status')
      .eq('programming_id', programming_id)
      .eq('subscriber_box_id', subscriber_box_id)
      .maybeSingle();
    if ((existingSub as { status?: string } | null)?.status === 'active') {
      return NextResponse.json({ error: 'Cette box est déjà abonnée.' }, { status: 409 });
    }

    // Compte connecté de la box éditrice.
    const { data: publisher } = await supabase
      .from('boxes')
      .select('id, name, stripe_account_id, stripe_onboarding_complete')
      .eq('id', p.publisher_box_id)
      .single();
    const pub = publisher as unknown as {
      id: string; name: string;
      stripe_account_id: string | null; stripe_onboarding_complete: boolean | null;
    } | null;
    if (!pub?.stripe_account_id || !pub.stripe_onboarding_complete) {
      return NextResponse.json(
        { error: 'La box éditrice n\'a pas encore activé les paiements.' },
        { status: 409 },
      );
    }

    const stripeAccount = pub.stripe_account_id;
    const isSubscription = p.billing === 'monthly';
    const recurring = isSubscription ? { interval: 'month' as const } : undefined;

    // Produit / prix créés (et réutilisés) sur le compte connecté de l'éditrice.
    let priceId = p.stripe_price_id;
    if (!priceId) {
      const product = p.stripe_product_id
        ? { id: p.stripe_product_id }
        : await stripe.products.create(
            {
              name: p.title,
              description: p.description ?? undefined,
              metadata: { programming_id: p.id, publisher_box_id: p.publisher_box_id },
            },
            { stripeAccount },
          );
      const price = await stripe.prices.create(
        {
          product: product.id,
          currency: p.currency || 'eur',
          unit_amount: p.price_cents,
          ...(recurring ? { recurring } : {}),
        },
        { stripeAccount },
      );
      priceId = price.id;
      await supabase
        .from('box_programming')
        .update({ stripe_product_id: product.id, stripe_price_id: priceId })
        .eq('id', p.id);
    }

    const feeAmount = Math.round((p.price_cents * PLATFORM_FEE_PERCENT) / 100);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://the-hub-rho.vercel.app';
    const meta = {
      kind: 'box_programming',
      programming_id: p.id,
      subscriber_box_id,
      publisher_box_id: p.publisher_box_id,
      created_by: user.id,
      amount_cents: String(p.price_cents),
      platform_fee_cents: String(feeAmount),
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: isSubscription ? 'subscription' : 'payment',
        payment_method_types: ['card'],
        customer_email: (await authed.auth.getUser()).data.user?.email ?? undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        ...(isSubscription
          ? {
              subscription_data: {
                application_fee_percent: PLATFORM_FEE_PERCENT,
                metadata: meta,
              },
            }
          : {
              payment_intent_data: {
                application_fee_amount: feeAmount,
                metadata: meta,
              },
            }),
        success_url: `${baseUrl}/programming?purchase=success`,
        cancel_url: `${baseUrl}/programming?purchase=cancel`,
        metadata: meta,
      },
      { stripeAccount },
    );

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-programming-checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
