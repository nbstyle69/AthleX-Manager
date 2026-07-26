import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

// Commission plateforme AthleX pour les abonnements de salle (0 % : la box encaisse tout).
const MEMBERSHIP_FEE_PERCENT = Number(process.env.MEMBERSHIP_FEE_PERCENT ?? '0');

/**
 * Prorata calendaire : ancre la facturation au 1er du mois suivant (00:00 UTC).
 * Combiné à proration_behavior='create_prorations', Stripe facture au checkout
 * uniquement les jours restants du mois en cours, puis le plein tarif chaque 1er.
 */
function firstOfNextMonthUnix(now: Date = new Date()): number {
  const anchor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  return Math.floor(anchor.getTime() / 1000);
}

/**
 * Crée une session Stripe Checkout pour l'abonnement à une salle (formule),
 * en charge directe sur le compte connecté de la box (Stripe Connect).
 * Toujours en mode 'subscription' (abonnement mensuel).
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const { plan_id, buyer_email } = await req.json();

    if (!plan_id || !buyer_email) {
      return NextResponse.json({ error: 'plan_id and buyer_email required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('id, box_id, name, description, price_cents, currency, is_active, stripe_product_id, stripe_price_id, plan_type, credits, validity_days, commitment_months')
      .eq('id', plan_id)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const p = plan as unknown as {
      id: string; box_id: string; name: string; description: string | null;
      price_cents: number; currency: string; is_active: boolean;
      stripe_product_id: string | null; stripe_price_id: string | null;
      plan_type: 'subscription' | 'drop_in' | 'pack' | null;
      credits: number | null; validity_days: number | null;
      commitment_months: number | null;
    };
    const planType = p.plan_type ?? 'subscription';

    if (!p.is_active) {
      return NextResponse.json({ error: 'Cette formule n\'est plus disponible.' }, { status: 400 });
    }
    if (p.price_cents <= 0) {
      return NextResponse.json({ error: 'Cette formule est gratuite — rapproche-toi de ta box.' }, { status: 400 });
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
    const feeAmount = Math.round((p.price_cents * MEMBERSHIP_FEE_PERCENT) / 100);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://the-hub-rho.vercel.app';
    const successBase = b.slug ? `/box/${b.slug}` : '/landing';

    // ── Offres à paiement unique : Drop-in (1 séance) & Carnet (N séances) ──
    if (planType === 'drop_in' || planType === 'pack') {
      const credits = planType === 'drop_in' ? (p.credits ?? 1) : (p.credits ?? 0);
      const validityDays = p.validity_days ?? (planType === 'drop_in' ? 14 : 365);
      if (credits <= 0) {
        return NextResponse.json({ error: 'Offre mal configurée (nombre de séances).' }, { status: 400 });
      }

      const oneTimeSession = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: buyer_email,
          line_items: [
            {
              price_data: {
                currency: p.currency || 'eur',
                unit_amount: p.price_cents,
                product_data: {
                  name: `${b.name} — ${p.name}`,
                  ...(p.description ? { description: p.description } : {}),
                },
              },
              quantity: 1,
            },
          ],
          ...(feeAmount > 0
            ? { payment_intent_data: { application_fee_amount: feeAmount } }
            : {}),
          success_url: `${baseUrl}${successBase}?purchase=success`,
          cancel_url: `${baseUrl}${successBase}?purchase=cancel`,
          metadata: {
            kind: 'credit',
            plan_type: planType,
            plan_id: p.id,
            box_id: p.box_id,
            buyer_email,
            credits: String(credits),
            validity_days: String(validityDays),
            amount_cents: String(p.price_cents),
            platform_fee_cents: String(feeAmount),
          },
        },
        { stripeAccount },
      );

      return NextResponse.json({ url: oneTimeSession.url });
    }

    // Produit / prix créés SUR le compte connecté (réutilisés ensuite).
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

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: buyer_email,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          // Prorata calendaire : 1re facture = jours restants du mois en cours,
          // puis plein tarif ancré au 1er de chaque mois.
          billing_cycle_anchor: firstOfNextMonthUnix(),
          proration_behavior: 'create_prorations',
          ...(MEMBERSHIP_FEE_PERCENT > 0
            ? { application_fee_percent: MEMBERSHIP_FEE_PERCENT }
            : {}),
          metadata: { plan_id: p.id, box_id: p.box_id, buyer_email },
        },
        success_url: `${baseUrl}${successBase}?subscription=success`,
        cancel_url: `${baseUrl}${successBase}?subscription=cancel`,
        metadata: {
          kind: 'membership',
          plan_id: p.id,
          box_id: p.box_id,
          buyer_email,
          amount_cents: String(p.price_cents),
          platform_fee_cents: String(feeAmount),
          commitment_months: String(p.commitment_months ?? 0),
        },
      },
      { stripeAccount },
    );

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-membership-checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
