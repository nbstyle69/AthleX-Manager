import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { buyerIdentity, customerEmailField, identityMetadata } from '@/lib/buyerIdentity';
import { SITE_URL } from '@/lib/site-url';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

// Commission plateforme AthleX (%). Peut être surchargée via env.
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? '4');

/**
 * Crée une session Stripe Checkout pour l'achat d'un programme,
 * en charge directe sur le compte connecté de la box (Stripe Connect),
 * avec application_fee au bénéfice d'AthleX.
 *
 * fixed   → mode 'payment'      (paiement unique)
 * ongoing → mode 'subscription' (abonnement mensuel)
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { program_id, buyer_email } = await req.json();

    if (!program_id) {
      return NextResponse.json({ error: 'program_id required' }, { status: 400 });
    }

    // Tunnel PUBLIC : pas d'auth exigée, mais le buyer_email du body n'attribue
    // plus rien (voir lib/buyerIdentity).
    const sessionUser = await getServerUser();
    const identity = buyerIdentity(sessionUser, buyer_email);

    const supabase = createServiceClient();

    const { data: program, error: progErr } = await supabase
      .from('programs')
      .select('id, box_id, title, description, price_cents, currency, type, image_url, is_active, stripe_product_id, stripe_price_id')
      .eq('id', program_id)
      .single();

    if (progErr || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const p = program as unknown as {
      id: string; box_id: string; title: string; description: string | null;
      price_cents: number; currency: string; type: 'fixed' | 'ongoing';
      image_url: string | null; is_active: boolean;
      stripe_product_id: string | null; stripe_price_id: string | null;
    };

    if (!p.is_active) {
      return NextResponse.json({ error: 'Program not available' }, { status: 400 });
    }
    if (p.price_cents <= 0) {
      return NextResponse.json({ error: 'Ce programme est gratuit — rejoins-le directement dans l\'app.' }, { status: 400 });
    }

    const { data: box } = await supabase
      .from('boxes')
      .select('id, name, slug, stripe_account_id, stripe_onboarding_complete')
      .eq('id', p.box_id)
      .single();

    const b = box as unknown as {
      id: string; name: string; slug: string | null;
      stripe_account_id: string | null; stripe_onboarding_complete: boolean | null;
    } | null;

    if (!b?.stripe_account_id || !b.stripe_onboarding_complete) {
      return NextResponse.json(
        { error: 'Cette box n\'a pas encore activé les paiements.' },
        { status: 409 },
      );
    }

    const stripeAccount = b.stripe_account_id;
    const isSubscription = p.type === 'ongoing';
    const recurring = isSubscription ? { interval: 'month' as const } : undefined;

    // Produit / prix créés SUR le compte connecté (réutilisés ensuite).
    let priceId = p.stripe_price_id;
    if (!priceId) {
      const product = p.stripe_product_id
        ? { id: p.stripe_product_id }
        : await stripe.products.create(
            {
              name: p.title,
              description: p.description ?? undefined,
              images: p.image_url ? [p.image_url] : undefined,
              metadata: { program_id: p.id, box_id: p.box_id },
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
        .from('programs')
        .update({ stripe_product_id: product.id, stripe_price_id: priceId })
        .eq('id', p.id);
    }

    const feeAmount = Math.round((p.price_cents * PLATFORM_FEE_PERCENT) / 100);
    const baseUrl = SITE_URL;
    const successBase = b.slug ? `/box/${b.slug}` : '/landing';

    const session = await stripe.checkout.sessions.create(
      {
        mode: isSubscription ? 'subscription' : 'payment',
        payment_method_types: ['card'],
        ...customerEmailField(identity),
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        ...(isSubscription
          ? {
              subscription_data: {
                application_fee_percent: PLATFORM_FEE_PERCENT,
                metadata: { program_id: p.id, box_id: p.box_id, ...identityMetadata(identity) },
              },
            }
          : {
              payment_intent_data: {
                application_fee_amount: feeAmount,
                metadata: { program_id: p.id, box_id: p.box_id, ...identityMetadata(identity) },
              },
            }),
        success_url: `${baseUrl}${successBase}?purchase=success`,
        cancel_url: `${baseUrl}${successBase}?purchase=cancel`,
        metadata: {
          kind: 'program',
          program_id: p.id,
          box_id: p.box_id,
          ...identityMetadata(identity),
          amount_cents: String(p.price_cents),
          platform_fee_cents: String(feeAmount),
        },
      },
      { stripeAccount },
    );

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-program-checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
