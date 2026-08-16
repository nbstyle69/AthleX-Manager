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
    const { plan_id, buyer_email, invitation_token } = await req.json();

    const supabase = createServiceClient();

    // Tunnel PUBLIC : aucune auth exigée. Mais l'e-mail du body n'attribue plus
    // rien — soit l'acheteur est connecté (on impose son e-mail de session et on
    // pose user_id), soit Stripe collecte et vérifie l'e-mail au paiement.
    const sessionUser = await getServerUser();
    let identity = buyerIdentity(sessionUser, buyer_email);

    // Invitation nominative (lot 4) : le compte vient d'être créé côté serveur,
    // le navigateur n'a donc pas forcément de session. L'identité et la formule
    // ne se prennent alors PAS dans le body — elles se relisent à partir du
    // jeton, seule chose que la page publique détienne.
    let invitationId: string | null = null;
    let planIdToUse: string | null = typeof plan_id === 'string' ? plan_id : null;

    if (typeof invitation_token === 'string' && invitation_token.trim() !== '') {
      const { data: resolved, error: resolveErr } = await supabase.rpc(
        'resolve_box_invitation_for_checkout',
        { p_token: invitation_token.trim() },
      );
      const inv = resolved as {
        ok: boolean; reason?: string; id?: string; plan_id?: string; email?: string;
      } | null;

      if (resolveErr || !inv?.ok || !inv.id || !inv.plan_id || !inv.email) {
        return NextResponse.json(
          { error: 'Cette invitation n\'est plus payable.', reason: inv?.reason ?? resolveErr?.message },
          { status: 409 },
        );
      }

      invitationId = inv.id;
      planIdToUse = inv.plan_id;

      const { data: invitedProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', inv.email)
        .maybeSingle();

      identity = {
        userId: (invitedProfile as { id?: string } | null)?.id ?? null,
        customerEmail: inv.email,
        submittedEmail: identity.submittedEmail,
      };
    }

    if (!planIdToUse) {
      return NextResponse.json({ error: 'plan_id required' }, { status: 400 });
    }

    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('id, box_id, name, description, price_cents, currency, is_active, stripe_product_id, stripe_price_id, plan_type, credits, validity_days, commitment_months')
      .eq('id', planIdToUse)
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
        payment_method_types: subscriptionPaymentMethods(p.currency || 'eur'),
        ...customerEmailField(identity),
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          // Prorata calendaire : 1re facture = jours restants du mois en cours,
          // puis plein tarif ancré au 1er de chaque mois.
          billing_cycle_anchor: firstOfNextMonthUnix(),
          proration_behavior: 'create_prorations',
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
        metadata: {
          kind: 'membership',
          plan_id: p.id,
          box_id: p.box_id,
          ...identityMetadata(identity),
          ...(invitationId ? { invitation_id: invitationId } : {}),
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
