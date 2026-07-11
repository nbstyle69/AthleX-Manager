import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
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

          const userId = await resolveUserId(buyerEmail);
          if (!userId) {
            console.warn(`Membership purchase without matching profile: ${buyerEmail}`);
            break;
          }

          const patch = {
            plan_id: planId,
            subscription_status: 'active',
            status: 'active',
            stripe_subscription_id: (session.subscription as string) ?? null,
            stripe_checkout_session_id: session.id,
            amount_cents: amountCents,
            platform_fee_cents: feeCents,
          };

          const { data: existing } = await (supabase.from as any)('box_members')
            .select('id')
            .eq('box_id', boxId)
            .eq('member_id', userId)
            .maybeSingle();

          if (existing?.id) {
            await (supabase.from as any)('box_members').update(patch).eq('id', existing.id);
          } else {
            await (supabase.from as any)('box_members').insert({
              box_id: boxId, member_id: userId, role: 'member', ...patch,
            });
          }

          console.log(`Membership plan ${planId} activated for user ${userId} on box ${boxId}`);
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

        await (supabase.from as any)('program_members')
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

        console.log(`Program ${programId} activated for user ${userId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await (supabase.from as any)('program_members')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id);
        // Abonnement salle résilié → retire la formule (déclenche la sync des groupes).
        await (supabase.from as any)('box_members')
          .update({ subscription_status: 'cancelled', plan_id: null })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' ? 'active'
          : 'cancelled';
        await (supabase.from as any)('program_members')
          .update({ status })
          .eq('stripe_subscription_id', sub.id);
        // Statut d'abonnement salle : active / past_due (impayé) / cancelled.
        const memberStatus = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due'
          : 'cancelled';
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await (supabase.from as any)('box_members')
          .update({
            subscription_status: memberStatus,
            subscription_current_period_end: periodEnd,
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await (supabase.from as any)('program_members')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', charge.payment_intent as string);
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
