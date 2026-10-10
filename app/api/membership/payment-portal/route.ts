import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/auth/requestUser';
import { SITE_URL } from '@/lib/site-url';
import { modeOf } from '@/lib/membership/planChange';
import { connectAccount, getConnectStripe, loadMember, planChangeError, portalConfiguration } from '@/lib/membership/server';

/**
 * Ouvre le portail Stripe du membre (cookie du site ou Bearer de l'app) sur
 * le compte connecté de sa box, pour mettre à jour son moyen de paiement.
 * Réservé à un abonnement payé en ligne. Retour vers /compte.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const service = createServiceClient();
    const m = await loadMember(service, user.id);
    if (!m || modeOf(m) !== 'online') {
      return NextResponse.json(
        { error: "Ton abonnement n'est pas payé en ligne : vois ton moyen de paiement avec ta box.", code: 'NO_ONLINE_SUBSCRIPTION' },
        { status: 409 },
      );
    }
    const box = await connectAccount(service, m.box_id);
    if (!box?.stripe_account_id) return planChangeError('PLAN_CHANGE_PAYMENTS_DISABLED');

    const stripe = getConnectStripe();
    const stripeAccount = box.stripe_account_id;
    const sub: any = await stripe.subscriptions.retrieve(m.stripe_subscription_id!, {}, { stripeAccount });
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customer) return NextResponse.json({ error: 'Abonnement Stripe invalide.' }, { status: 500 });

    const configuration = await portalConfiguration(service, stripe, box.id, stripeAccount);
    const session = await stripe.billingPortal.sessions.create(
      { customer, configuration, return_url: `${SITE_URL}/compte` },
      { stripeAccount },
    );
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('membership/payment-portal error:', err?.message ?? err);
    return NextResponse.json({ error: "Le portail de paiement n'a pas pu s'ouvrir." }, { status: 500 });
  }
}
