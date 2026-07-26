import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

// `current_period_end` was moved from the subscription object to the
// subscription items in Stripe's newer API versions. Read both so the renewal
// date resolves whatever version the event was serialized with.
function subscriptionPeriodEnd(sub: any): string | null {
  const epoch = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

/**
 * Webhook dédié aux comptes connectés (Stripe Connect).
 * Gère l'achat de programmes (charge directe sur le compte de la box) :
 * confirmation de paiement → activation de l'inscription (program_members).
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret =
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET!;
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Connect webhook signature verification failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createServiceClient();

  async function resolveUserId(email: string | null | undefined): Promise<string | null> {
    if (!email) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Abonnement de salle (formule) ───────────────────────────────
        if (session.metadata?.kind === 'membership') {
          const planId = session.metadata.plan_id;
          const boxId = session.metadata.box_id;
          const buyerEmail = session.metadata.buyer_email ?? session.customer_email ?? null;
          const amountCents = Number(session.metadata.amount_cents ?? 0) || null;
          const feeCents = Number(session.metadata.platform_fee_cents ?? 0) || null;
          if (!planId || !boxId) break;

          const commitmentMonths = Number(session.metadata.commitment_months ?? 0) || 0;

          const userId = await resolveUserId(buyerEmail);
          if (!userId) {
            console.warn(`Membership purchase without matching profile: ${buyerEmail}`);
            break;
          }

          // Fige la fin d'engagement à la souscription (NULL = sans engagement).
          const commitmentEnd = commitmentMonths > 0
            ? (() => { const d = new Date(); d.setMonth(d.getMonth() + commitmentMonths); return d.toISOString(); })()
            : null;

          const patch = {
            plan_id: planId,
            subscription_status: 'active',
            status: 'active',
            stripe_subscription_id: (session.subscription as string) ?? null,
            stripe_checkout_session_id: session.id,
            amount_cents: amountCents,
            platform_fee_cents: feeCents,
            commitment_end_date: commitmentEnd,
            subscription_paused: false,
          };

          const { data: existing } = await supabase.from('box_members')
            .select('id')
            .eq('box_id', boxId)
            .eq('member_id', userId)
            .maybeSingle();

          const { error: writeErr } = existing?.id
            ? await supabase.from('box_members').update(patch).eq('id', existing.id)
            : await supabase.from('box_members').insert({
                box_id: boxId, member_id: userId, role: 'member', ...patch,
              });
          if (writeErr) {
            console.error(`Membership box_members write failed for user ${userId} on box ${boxId}:`, writeErr.message);
            return NextResponse.json({ error: writeErr.message }, { status: 500 });
          }

          console.log(`Membership plan ${planId} activated for user ${userId} on box ${boxId}`);
          break;
        }

        // ── Achat unique de crédits : Drop-in / Carnet ─────────────────
        if (session.metadata?.kind === 'credit') {
          const planId = session.metadata.plan_id ?? null;
          const boxId = session.metadata.box_id;
          const buyerEmail = session.metadata.buyer_email ?? session.customer_email ?? null;
          const credits = Number(session.metadata.credits ?? 0);
          const validityDays = Number(session.metadata.validity_days ?? 0);
          if (!boxId || credits <= 0 || validityDays <= 0) break;

          const userId = await resolveUserId(buyerEmail);
          if (!userId) {
            console.warn(`Credit purchase without matching profile: ${buyerEmail}`);
            break;
          }

          const expiresAt = new Date(Date.now() + validityDays * 86400_000).toISOString();
          const { error: creditErr } = await supabase.from('member_class_credits')
            .insert({
              box_id: boxId,
              member_id: userId,
              plan_id: planId,
              credits_total: credits,
              credits_used: 0,
              expires_at: expiresAt,
              status: 'active',
              stripe_checkout_session_id: session.id,
              stripe_payment_intent: (session.payment_intent as string) ?? null,
            });
          if (creditErr) {
            // Idempotence : Stripe peut ré-émettre le même événement. Une
            // contrainte unique sur stripe_checkout_session_id garantit un
            // seul crédit par paiement ; le rejeu (23505) est déjà traité.
            if (creditErr.code === '23505') {
              console.log(`Credit for session ${session.id} already processed — skipping duplicate.`);
              break;
            }
            console.error(`member_class_credits insert failed for user ${userId} on box ${boxId}:`, creditErr.message);
            return NextResponse.json({ error: creditErr.message }, { status: 500 });
          }

          console.log(`Credit pack (${credits} séances) activated for user ${userId} on box ${boxId}`);
          break;
        }

        if (session.metadata?.kind !== 'program') break;

        const programId = session.metadata.program_id;
        const buyerEmail = session.metadata.buyer_email ?? session.customer_email ?? null;
        const amountCents = Number(session.metadata.amount_cents ?? 0) || null;
        const feeCents = Number(session.metadata.platform_fee_cents ?? 0) || null;
        if (!programId) break;

        const userId = await resolveUserId(buyerEmail);
        if (!userId) {
          // L'acheteur n'a pas (encore) de compte app : on garde une trace pending
          // par email pour réconciliation ultérieure côté app.
          console.warn(`Program purchase without matching profile: ${buyerEmail}`);
          break;
        }

        const { error: programWriteErr } = await supabase.from('program_members')
          .upsert(
            {
              program_id: programId,
              user_id: userId,
              start_date: new Date().toISOString().split('T')[0],
              amount_cents: amountCents,
              platform_fee_cents: feeCents,
              status: 'active',
              stripe_checkout_session_id: session.id,
              stripe_subscription_id: (session.subscription as string) ?? null,
              stripe_payment_intent: (session.payment_intent as string) ?? null,
            },
            { onConflict: 'program_id,user_id' },
          );
        if (programWriteErr) {
          console.error(`Program program_members write failed for user ${userId} on program ${programId}:`, programWriteErr.message);
          return NextResponse.json({ error: programWriteErr.message }, { status: 500 });
        }

        console.log(`Program ${programId} activated for user ${userId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from('program_members')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id);
        // Abonnement salle résilié → retire la formule (déclenche la sync des groupes).
        await supabase.from('box_members')
          .update({
            subscription_status: 'cancelled', plan_id: null,
            subscription_cancel_at_period_end: false,
            commitment_end_date: null, subscription_paused: false,
            pause_started_at: null, pause_resumes_at: null,
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      // `created` is emitted right after checkout with the first period end,
      // which `checkout.session.completed` doesn't carry — handle it like an
      // update so the renewal date is populated immediately, not only on renewal.
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' ? 'active'
          : 'cancelled';
        await supabase.from('program_members')
          .update({ status })
          .eq('stripe_subscription_id', sub.id);
        // Statut d'abonnement salle : active / past_due (impayé) / cancelled.
        const memberStatus = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due'
          : 'cancelled';
        const periodEnd = subscriptionPeriodEnd(sub);

        // Sync du plan après un changement de formule : on retrouve la formule
        // via le prix Stripe courant (ou la metadata plan_id) et on met à jour box_members.
        const planPatch: { plan_id?: string; amount_cents?: number } = {};
        const metaPlanId = sub.metadata?.plan_id as string | undefined;
        const currentPriceId = sub.items?.data?.[0]?.price?.id as string | undefined;
        if (metaPlanId) {
          planPatch.plan_id = metaPlanId;
        } else if (currentPriceId) {
          const { data: matchedPlan } = await supabase.from('membership_plans')
            .select('id, price_cents')
            .eq('stripe_price_id', currentPriceId)
            .maybeSingle();
          if (matchedPlan?.id) {
            planPatch.plan_id = matchedPlan.id;
            planPatch.amount_cents = matchedPlan.price_cents;
          }
        }

        const { error: subUpdErr } = await supabase.from('box_members')
          .update({
            subscription_status: memberStatus,
            subscription_current_period_end: periodEnd,
            subscription_cancel_at_period_end: !!sub.cancel_at_period_end,
            ...(memberStatus !== 'cancelled' ? planPatch : {}),
          })
          .eq('stripe_subscription_id', sub.id);
        if (subUpdErr) {
          console.error(`box_members subscription update failed for ${sub.id}:`, subUpdErr.message);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          const paymentIntent = charge.payment_intent as string;
          await supabase.from('program_members')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', paymentIntent);
          // Achat unique de crédits (Drop-in / Carnet) remboursé : on révoque
          // l'accès pour que les séances prépayées ne soient plus réservables.
          await supabase.from('member_class_credits')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', paymentIntent);
        }
        break;
      }

      default:
        console.log(`Unhandled connect event: ${event.type}`);
    }
  } catch (err: any) {
    console.error('Connect webhook processing error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
