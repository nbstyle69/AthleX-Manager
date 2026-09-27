import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { customerEmailField, identityMetadata } from '@/lib/buyerIdentity';
import { SITE_URL } from '@/lib/site-url';
import { loadMembershipContext, billingPlanFor } from '@/lib/membershipCheckout';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

// Commission plateforme AthleX pour les abonnements de salle (0 % : la box encaisse tout).
const MEMBERSHIP_FEE_PERCENT = Number(process.env.MEMBERSHIP_FEE_PERCENT ?? '0');

/**
 * Moyens de paiement d'un abonnement mensuel.
 * Le prélèvement SEPA (mandat collecté par Stripe au checkout) est la norme
 * en zone euro pour une adhésion récurrente : on l'ouvre dès que la formule
 * est libellée en EUR. Les achats à l'unité (Drop-in / Carnet) restent en
 * carte : le SEPA met 2 à 5 jours à se dénouer, incompatible avec un accès
 * immédiat à la séance.
 */
function subscriptionPaymentMethods(currency: string): ('card' | 'sepa_debit')[] {
  return currency.toLowerCase() === 'eur' ? ['card', 'sepa_debit'] : ['card'];
}

/**
 * Crée une session Stripe Checkout pour l'abonnement à une salle (formule),
 * en charge directe sur le compte connecté de la box (Stripe Connect).
 *
 * Abonnement (lot 3) : le membre choisit son jour de prélèvement (1 à 10).
 * - Sans échéance : Checkout en mode abonnement, prorata aujourd'hui jusqu'au
 *   jour choisi (ancre), puis plein tarif ce jour-là chaque mois.
 * - Avec une échéance future (invitation d'un adhérent qui migre) : Checkout en
 *   mode `setup` (carte ou mandat SEPA, rien aujourd'hui) ; le webhook crée
 *   ensuite l'abonnement en essai jusqu'à l'échéance. Checkout ne sait pas
 *   combiner essai et ancre.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const body = await req.json();
    const loaded = await loadMembershipContext(body);
    if (!loaded.ok) return loaded.response;
    const { ctx } = loaded;
    const { supabase, identity, invitationId, plan: p, planType, box: b } = ctx;

    const stripeAccount = b.stripe_account_id;
    const feeAmount = Math.round((p.price_cents * MEMBERSHIP_FEE_PERCENT) / 100);
    const baseUrl = SITE_URL;
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
          ...customerEmailField(identity),
          allow_promotion_codes: true,
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
            ...identityMetadata(identity),
            ...(invitationId ? { invitation_id: invitationId } : {}),
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

    // Jour de prélèvement et premier prélèvement : même calcul que l'aperçu.
    const billing = billingPlanFor(ctx, body.billing_day);
    if (!billing.ok) return billing.response;
    const { plan: bp, billingDay } = billing;

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

    const commonMetadata = {
      plan_id: p.id,
      box_id: p.box_id,
      ...identityMetadata(identity),
      ...(invitationId ? { invitation_id: invitationId } : {}),
      amount_cents: String(p.price_cents),
      platform_fee_cents: String(feeAmount),
      commitment_months: String(p.commitment_months ?? 0),
      billing_day: String(billingDay),
    };

    // ── Échéance future : on enregistre le moyen de paiement, rien aujourd'hui ──
    if (bp.kind === 'deferred') {
      const setupSession = await stripe.checkout.sessions.create(
        {
          mode: 'setup',
          payment_method_types: subscriptionPaymentMethods(p.currency || 'eur'),
          currency: p.currency || 'eur',
          customer_creation: 'always',
          ...customerEmailField(identity),
          expires_at: bp.expiresAt,
          success_url: `${baseUrl}${successBase}?subscription=success`,
          cancel_url: `${baseUrl}${successBase}?subscription=cancel`,
          // Tout ce qu'il faut au webhook pour créer l'abonnement tel qu'affiché.
          metadata: {
            kind: 'membership_deferred',
            ...commonMetadata,
            price_id: priceId,
            due_date: bp.dueDate,
            trial_end: String(bp.trialEnd),
            ...(bp.anchor ? { billing_cycle_anchor: String(bp.anchor) } : {}),
            merged_prorata_cents: String(bp.mergedProrataCents),
            currency: p.currency || 'eur',
          },
        } as any,
        { stripeAccount },
      );
      return NextResponse.json({ url: setupSession.url });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: subscriptionPaymentMethods(p.currency || 'eur'),
        ...customerEmailField(identity),
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        expires_at: bp.expiresAt,
        subscription_data: {
          // Prorata jusqu'au jour choisi, puis plein tarif ce jour-là chaque
          // mois. Sans ancre (jour choisi = aujourd'hui) : plein tarif tout de suite.
          ...(bp.anchor ? { billing_cycle_anchor: bp.anchor, proration_behavior: 'create_prorations' as const } : {}),
          ...(MEMBERSHIP_FEE_PERCENT > 0
            ? { application_fee_percent: MEMBERSHIP_FEE_PERCENT }
            : {}),
          metadata: {
            plan_id: p.id, box_id: p.box_id, ...identityMetadata(identity),
            ...(invitationId ? { invitation_id: invitationId } : {}),
          },
        },
        success_url: `${baseUrl}${successBase}?subscription=success`,
        cancel_url: `${baseUrl}${successBase}?subscription=cancel`,
        metadata: { kind: 'membership', ...commonMetadata },
      },
      { stripeAccount },
    );

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-membership-checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
