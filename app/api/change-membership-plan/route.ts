import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Change de formule d'abonnement de salle pour l'utilisateur connecté.
 * - l'identité vient du cookie de session (sb-access-token) : un utilisateur ne peut
 *   changer que sa propre formule (aucune confiance dans un e-mail fourni par le client)
 * - retrouve l'abonnement Stripe actif du membre sur la box (déduite de la formule cible)
 * - remplace le prix de l'item d'abonnement par celui de la nouvelle formule
 * - prorata immédiat (Stripe crédite le temps non consommé et facture la nouvelle
 *   formule au prorata), en conservant l'ancrage au 1er du mois existant.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { new_plan_id } = await req.json();

    if (!new_plan_id) {
      return NextResponse.json(
        { error: 'new_plan_id required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Nouvelle formule cible.
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('id, box_id, name, description, price_cents, currency, is_active, stripe_product_id, stripe_price_id')
      .eq('id', new_plan_id)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Formule introuvable.' }, { status: 404 });
    }

    const p = plan as unknown as {
      id: string; box_id: string; name: string; description: string | null;
      price_cents: number; currency: string; is_active: boolean;
      stripe_product_id: string | null; stripe_price_id: string | null;
    };

    if (!p.is_active) {
      return NextResponse.json({ error: 'Cette formule n\'est plus disponible.' }, { status: 400 });
    }
    if (p.price_cents <= 0) {
      return NextResponse.json({ error: 'Cette formule est gratuite — rapproche-toi de ta box.' }, { status: 400 });
    }

    // Identité de l'appelant : issue de la session, jamais du body.
    const userId = user.id;

    // Abonnement actif du membre sur cette box.
    const { data: member } = await (supabase.from as any)('box_members')
      .select('id, plan_id, subscription_status, stripe_subscription_id')
      .eq('box_id', p.box_id)
      .eq('member_id', userId)
      .maybeSingle();

    const m = member as {
      id: string; plan_id: string | null; subscription_status: string | null;
      stripe_subscription_id: string | null;
    } | null;

    if (!m?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif trouvé pour ce membre sur cette box.' },
        { status: 404 },
      );
    }
    if (m.subscription_status && !ACTIVE_STATUSES.includes(m.subscription_status)) {
      return NextResponse.json(
        { error: 'Ton abonnement n\'est pas actif — réabonne-toi pour choisir une formule.' },
        { status: 409 },
      );
    }
    if (m.plan_id === p.id) {
      return NextResponse.json(
        { error: 'Tu es déjà sur cette formule.' },
        { status: 400 },
      );
    }

    // Compte connecté Stripe de la box.
    const { data: box } = await supabase
      .from('boxes')
      .select('id, name, stripe_account_id, stripe_onboarding_complete')
      .eq('id', p.box_id)
      .single();

    const b = box as unknown as {
      id: string; name: string;
      stripe_account_id: string | null; stripe_onboarding_complete: boolean | null;
    } | null;

    if (!b?.stripe_account_id || !b.stripe_onboarding_complete) {
      return NextResponse.json(
        { error: 'Cette box n\'a pas encore activé les paiements.' },
        { status: 409 },
      );
    }

    const stripeAccount = b.stripe_account_id;

    // Prix de la nouvelle formule sur le compte connecté (créé/réutilisé).
    let priceId = p.stripe_price_id;
    if (!priceId) {
      const product = p.stripe_product_id
        ? { id: p.stripe_product_id }
        : await stripe.products.create(
            {
              name: `${b.name} — ${p.name}`,
              description: p.description ?? undefined,
              metadata: { plan_id: p.id, box_id: p.box_id },
            },
            { stripeAccount },
          );

      const price = await stripe.prices.create(
        {
          product: product.id,
          currency: p.currency || 'eur',
          unit_amount: p.price_cents,
          recurring: { interval: 'month' },
        },
        { stripeAccount },
      );
      priceId = price.id;

      await supabase
        .from('membership_plans')
        .update({ stripe_product_id: product.id, stripe_price_id: priceId })
        .eq('id', p.id);
    }

    // Item d'abonnement courant à remplacer.
    const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, { stripeAccount });
    const itemId = sub.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: 'Abonnement Stripe invalide.' }, { status: 500 });
    }

    // Remplace le prix, prorata immédiat, ancrage 1er du mois conservé.
    await stripe.subscriptions.update(
      m.stripe_subscription_id,
      {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'always_invoice',
        metadata: {
          ...(sub.metadata ?? {}),
          plan_id: p.id,
          box_id: p.box_id,
        },
      },
      { stripeAccount },
    );

    // Synchronise immédiatement (le webhook confirmera aussi).
    await (supabase.from as any)('box_members')
      .update({ plan_id: p.id, amount_cents: p.price_cents })
      .eq('id', m.id);

    return NextResponse.json({ ok: true, plan_id: p.id, plan_name: p.name });
  } catch (err: any) {
    console.error('change-membership-plan error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
