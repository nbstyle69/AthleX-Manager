import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { SITE_URL } from '@/lib/site-url';
import { refuseClosedBox } from '@/lib/boxEntryGuard';
import {
  OFFER_RESERVED_MESSAGE, checkCheckoutInvitation, checkoutExpiresAt, type InvitationRow,
} from '@/lib/programmingInvitations';

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
    const { programming_id, subscriber_box_id, invitation_id } = await req.json();
    if (!programming_id || !subscriber_box_id) {
      return NextResponse.json(
        { error: 'programming_id et subscriber_box_id requis' },
        { status: 400 },
      );
    }

    // Autorisation : engager la box dans un abonnement payant est une décision
    // d'argent — gérant ou co-gérant, jamais le coach. On ne fait jamais
    // confiance au client.
    const authed = await createClient();
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const supabase = createServiceClient();

    if (!(await isBoxOwnerAdmin(supabase, user.id, subscriber_box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    // Offre + éditrice.
    const { data: prog, error: progErr } = await supabase
      .from('box_programming')
      .select('id, publisher_box_id, title, description, price_cents, currency, billing, is_published, visibility, stripe_product_id, stripe_price_id')
      .eq('id', programming_id)
      .single();
    if (progErr || !prog) {
      return NextResponse.json({ error: 'Programmation introuvable' }, { status: 404 });
    }
    const p = prog as unknown as {
      id: string; publisher_box_id: string; title: string; description: string | null;
      price_cents: number; currency: string; billing: 'free' | 'one_time' | 'monthly';
      is_published: boolean; visibility?: string | null;
      stripe_product_id: string | null; stripe_price_id: string | null;
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

    // Archivage (PR 2) : la box acheteuse comme l'éditrice doivent accepter des entrées.
    const refus = await refuseClosedBox(supabase, subscriber_box_id, 'achat')
      ?? await refuseClosedBox(supabase, p.publisher_box_id, 'achat');
    if (refus) return refus;

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

    // Invitation « au prix de l'offre » (#461) : relue côté serveur, jamais crue
    // du client. Une offre « sur invitation » sans invitation valable est refusée
    // AVANT tout paiement : la base refuserait sinon l'activation au webhook.
    let invitation: InvitationRow | null = null;
    if (invitation_id) {
      const { data: inv } = await supabase
        .from('box_programming_invitations')
        .select('id, programming_id, invited_box_id, pricing, status, expires_at')
        .eq('id', invitation_id)
        .maybeSingle();
      const invRefus = checkCheckoutInvitation(inv as InvitationRow | null, p.id, subscriber_box_id);
      if (invRefus) return NextResponse.json({ error: invRefus }, { status: 409 });
      invitation = inv as InvitationRow;
    }
    if (p.visibility === 'invitation' && !invitation) {
      return NextResponse.json({ error: OFFER_RESERVED_MESSAGE }, { status: 403 });
    }
    // La session expire au plus tard 5 min avant l'invitation (Stripe : 30 min à 24 h).
    let sessionExpiresAt: number | undefined;
    if (invitation) {
      const exp = checkoutExpiresAt(invitation.expires_at);
      if ('error' in exp) return NextResponse.json({ error: exp.error }, { status: 409 });
      sessionExpiresAt = exp.expiresAt;
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
    const baseUrl = SITE_URL;
    const meta = {
      kind: 'box_programming',
      programming_id: p.id,
      subscriber_box_id,
      publisher_box_id: p.publisher_box_id,
      created_by: user.id,
      amount_cents: String(p.price_cents),
      platform_fee_cents: String(feeAmount),
      ...(invitation ? { invitation_id: invitation.id } : {}),
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
        ...(sessionExpiresAt ? { expires_at: sessionExpiresAt } : {}),
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
