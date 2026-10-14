import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { isBillingDay, commitmentEndIso, type BillingPlanDeferred } from '@/lib/membershipBilling';
import { logStripeError, releaseSchedule } from '@/lib/membership/server';
import { must } from '@/lib/stripe/must';

const ROUTE = 'stripe-connect-webhook';

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

// Lien facture → abonnement : `invoice.subscription` a été retiré en
// 2025-03-31.basil au profit de `invoice.parent.subscription_details.subscription`.
// La charge utile suit la version de la destination webhook : on lit les deux.
function invoiceSubscriptionId(inv: any): string | null {
  return inv?.parent?.subscription_details?.subscription ?? inv?.subscription ?? null;
}

// Jour de prélèvement (lot 3) posé par le checkout ; hors de 1 à 10 : ignoré.
function metadataBillingDay(metadata: Record<string, string> | null | undefined): number | null {
  const day = Number(metadata?.billing_day);
  return isBillingDay(day) ? day : null;
}

const MEMBERSHIP_FEE_PERCENT = Number(process.env.MEMBERSHIP_FEE_PERCENT ?? '0');

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
    logStripeError(ROUTE, 'signature', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const supabase = createServiceClient();

  async function resolveUserId(email: string | null | undefined): Promise<string | null> {
    if (!email) return null;
    const { data } = must(await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle(), 'profiles.select_by_email');
    return (data as { id?: string } | null)?.id ?? null;
  }

  /**
   * Lot 7A-bis — à qui appartient l'achat.
   * `metadata.user_id` (acheteur connecté) fait foi ; sinon l'e-mail **vérifié
   * par Stripe au paiement**. Le `submitted_email` du formulaire public ne sert
   * plus qu'à journaliser un écart : il n'attribue rien.
   */
  async function resolveBuyer(session: Stripe.Checkout.Session): Promise<{
    userId: string | null;
    email: string | null;
  }> {
    const verifiedEmail =
      session.customer_details?.email ?? session.customer_email ?? null;
    const submitted = session.metadata?.submitted_email ?? null;
    if (submitted && verifiedEmail && submitted.toLowerCase() !== verifiedEmail.toLowerCase()) {
      console.warn('Buyer email mismatch on checkout session — attributing to the verified email.');
    }

    const metaUserId = session.metadata?.user_id ?? null;
    if (metaUserId) {
      // La metadata est posée serveur depuis la session : on confirme quand même
      // que le profil existe avant d'écrire.
      const { data } = must(await supabase
        .from('profiles')
        .select('id')
        .eq('id', metaUserId)
        .maybeSingle(), 'profiles.select_by_id');
      if ((data as { id?: string } | null)?.id) {
        return { userId: metaUserId, email: verifiedEmail };
      }
      console.warn('Checkout session carries an unknown user_id — falling back to the Stripe email.');
    }

    return { userId: await resolveUserId(verifiedEmail), email: verifiedEmail };
  }

  /**
   * Lot 4 — l'invitation nominative se ferme au PAIEMENT, jamais au retour
   * navigateur. La RPC est réservée au service_role et revérifie que le compte
   * porte bien l'adresse invitée : un identifiant venu d'une metadata ne suffit
   * pas à rattacher quelqu'un. Un refus métier (`ok: false`) n'annule pas
   * l'activation — le membre a payé, il entre ; l'invitation restée ouverte se
   * voit dans l'écran de gestion. Une panne (`error`) jette : 500, Stripe
   * rejoue, et l'écriture box_members qui précède est idempotente.
   */
  async function closeInvitation(invitationId: string | undefined, userId: string | null) {
    if (!invitationId || !userId) return;
    const { data } = must(await supabase.rpc('accept_box_invitation_after_payment', {
      p_invitation_id: invitationId,
      p_user_id: userId,
    }), 'rpc.accept_box_invitation_after_payment');
    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok) {
      console.error(`Invitation not closed after payment: ${result?.reason ?? 'unknown'}`);
    }
  }

  /**
   * Paiement encaissé pour un e-mail sans compte : l'achat est déposé en attente
   * et réclamé automatiquement à la création du profil (trigger
   * trg_profiles_claim_pending_entitlements). Avant, il était simplement perdu.
   */
  async function parkPendingEntitlement(
    kind: 'membership' | 'credit' | 'program',
    email: string | null,
    sessionId: string,
    payload: Record<string, unknown>,
    // Vraies colonnes de pending_entitlements (jamais dans payload).
    columns: { billing_day?: number | null } = {},
  ): Promise<void> {
    if (!email) {
      console.error(`Cannot park ${kind} purchase: no verified email on the Stripe session.`);
      return;
    }
    const { error } = await supabase.from('pending_entitlements').insert({
      email: email.toLowerCase(),
      kind,
      payload,
      stripe_checkout_session_id: sessionId,
      ...columns,
    });
    // Rejeu du même événement : la contrainte unique sur la session tient.
    if (error?.code === '23505') {
      console.log(`Pending ${kind} already parked — skipping duplicate.`);
      return;
    }
    must({ error }, 'pending_entitlements.insert');
    console.log(`Pending ${kind} parked — will be claimed at signup.`);
  }

  /**
   * Écriture de l'adhésion (payée, ou moyen de paiement enregistré pour une
   * échéance future) : box_members si le compte existe, sinon
   * pending_entitlements. Ferme ensuite l'invitation. Jette si une
   * requête échoue (500, Stripe rejoue).
   */
  async function activateMembership(
    session: Stripe.Checkout.Session,
    m: {
      boxId: string; planId: string; userId: string | null; buyerEmail: string | null;
      billingDay: number | null; subscriptionId: string | null; periodEnd: string | null;
      paymentMethodType: string | null; amountCents: number | null; feeCents: number | null;
      commitmentEnd: string | null;
    },
  ): Promise<void> {
    const patch = {
      plan_id: m.planId,
      subscription_status: 'active',
      status: 'active',
      payment_method_type: m.paymentMethodType,
      past_due_since: null,
      dunning_attempts: 0,
      last_payment_error: null,
      dunning_reminders_sent: 0,
      stripe_subscription_id: m.subscriptionId,
      stripe_checkout_session_id: session.id,
      subscription_current_period_end: m.periodEnd,
      amount_cents: m.amountCents,
      platform_fee_cents: m.feeCents,
      commitment_end_date: m.commitmentEnd,
      subscription_paused: false,
      ...(m.billingDay ? { billing_day: m.billingDay } : {}),
    };

    if (!m.userId) {
      await parkPendingEntitlement('membership', m.buyerEmail, session.id, {
        box_id: m.boxId,
        plan_id: m.planId,
        stripe_subscription_id: m.subscriptionId,
        subscription_current_period_end: m.periodEnd,
        amount_cents: m.amountCents,
        platform_fee_cents: m.feeCents,
        commitment_end_date: m.commitmentEnd,
        payment_method_type: m.paymentMethodType,
      }, m.billingDay ? { billing_day: m.billingDay } : {});
      return;
    }

    const { data: existing } = must(await supabase.from('box_members')
      .select('id')
      .eq('box_id', m.boxId)
      .eq('member_id', m.userId)
      .maybeSingle(), 'box_members.select_membership');

    must(existing?.id
      ? await supabase.from('box_members').update(patch).eq('id', existing.id)
      : await supabase.from('box_members').insert({
          box_id: m.boxId, member_id: m.userId, role: 'member', ...patch,
        }), 'box_members.write_membership');

    await closeInvitation(session.metadata?.invitation_id, m.userId);

    console.log('Membership activated');
  }

  /**
   * Lot 3, échéance future : crée l'abonnement d'un adhérent qui migre, tel
   * que l'aperçu l'a montré (dates et prorata posés dans la metadata par la
   * route de checkout).
   *
   * Idempotent : un abonnement déjà créé pour cette session est retrouvé chez
   * Stripe (metadata `checkout_session_id`) et réutilisé, et chaque création
   * porte une clé d'idempotence liée à la session. Tout échec Stripe est
   * journalisé et renvoie 500 : Stripe réessaie.
   */
  async function createDeferredMembership(
    session: Stripe.Checkout.Session,
    account: string | null,
  ): Promise<NextResponse | null> {
    const md = session.metadata ?? {};
    const planId = md.plan_id;
    const boxId = md.box_id;
    const priceId = md.price_id;
    const trialEnd = Number(md.trial_end);
    const anchor = md.billing_cycle_anchor ? Number(md.billing_cycle_anchor) : null;
    const merged = Number(md.merged_prorata_cents ?? 0) || 0;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    const setupIntentId = typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id ?? null;
    if (!planId || !boxId || !priceId || !trialEnd || !customerId || !setupIntentId || !account) {
      console.error('membership_deferred: metadata, client, SetupIntent ou compte manquant — rien créé.');
      return null;
    }
    const opts = { stripeAccount: account };

    let subscription: any;
    let paymentMethodType: string | null = null;
    try {
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] }, opts) as any;
      const pm = setupIntent.payment_method;
      const pmId: string | null = typeof pm === 'string' ? pm : pm?.id ?? null;
      paymentMethodType = typeof pm === 'string' ? null : pm?.type ?? null;
      if (!pmId) throw new Error(`SetupIntent ${setupIntentId} sans moyen de paiement`);

      // Sans client passé au Checkout, la doc Stripe demande d'associer le
      // moyen de paiement au client ; on ne le fait que s'il ne l'est pas déjà.
      const pmCustomer = typeof pm === 'string' ? null : (typeof pm?.customer === 'string' ? pm.customer : pm?.customer?.id ?? null);
      if (pmCustomer !== customerId) {
        await stripe.paymentMethods.attach(pmId, { customer: customerId }, opts);
      }

      // Moyen de paiement enregistré par défaut, sur le client et sur l'abonnement.
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } }, opts);

      const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 }, opts);
      subscription = existing.data.find((sub: any) => sub.metadata?.checkout_session_id === session.id);

      if (!subscription) {
        subscription = await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: priceId }],
            default_payment_method: pmId,
            trial_end: trialEnd,
            ...(anchor ? { billing_cycle_anchor: anchor, proration_behavior: 'create_prorations' as const } : {}),
            ...(MEMBERSHIP_FEE_PERCENT > 0 ? { application_fee_percent: MEMBERSHIP_FEE_PERCENT } : {}),
            metadata: {
              plan_id: planId, box_id: boxId, checkout_session_id: session.id,
              ...(md.user_id ? { user_id: md.user_id } : {}),
              ...(md.invitation_id ? { invitation_id: md.invitation_id } : {}),
            },
          },
          { ...opts, idempotencyKey: `membership-deferred-sub-${session.id}` },
        );
      }

      // Fusion (échéance à moins de 7 jours du jour choisi) : le prorata
      // rejoint la facture de fin d'essai, en un seul prélèvement.
      if (merged > 0) {
        const pending = await stripe.invoiceItems.list({ customer: customerId, pending: true, limit: 100 } as any, opts);
        const already = pending.data.some((it: any) => it.metadata?.checkout_session_id === session.id);
        if (!already) {
          await stripe.invoiceItems.create(
            {
              customer: customerId,
              subscription: subscription.id,
              amount: merged,
              currency: md.currency || 'eur',
              description: 'Prorata depuis ta prochaine échéance',
              metadata: { checkout_session_id: session.id },
            } as any,
            { ...opts, idempotencyKey: `membership-deferred-item-${session.id}` },
          );
        }
      }
    } catch (e: any) {
      logStripeError(ROUTE, 'membership_deferred.create_subscription', e);
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

    const { userId, email: buyerEmail } = await resolveBuyer(session);
    const commitmentMonths = Number(md.commitment_months ?? 0) || 0;
    await activateMembership(session, {
      boxId, planId, userId, buyerEmail,
      billingDay: metadataBillingDay(md),
      subscriptionId: subscription.id,
      periodEnd: subscriptionPeriodEnd(subscription) ?? new Date(trialEnd * 1000).toISOString(),
      paymentMethodType,
      amountCents: Number(md.amount_cents ?? 0) || null,
      feeCents: Number(md.platform_fee_cents ?? 0) || null,
      // Engagement : depuis l'échéance, premier mois réellement payé chez AthleX.
      commitmentEnd: md.due_date
        ? commitmentEndIso({ kind: 'deferred', dueDate: md.due_date } as BillingPlanDeferred, commitmentMonths, new Date())
        : null,
    });
    return null;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Abonnement de salle (formule) ───────────────────────────────
        if (session.metadata?.kind === 'membership') {
          const planId = session.metadata.plan_id;
          const boxId = session.metadata.box_id;
          const amountCents = Number(session.metadata.amount_cents ?? 0) || null;
          const feeCents = Number(session.metadata.platform_fee_cents ?? 0) || null;
          if (!planId || !boxId) break;

          const commitmentMonths = Number(session.metadata.commitment_months ?? 0) || 0;
          const { userId, email: buyerEmail } = await resolveBuyer(session);

          // Fige la fin d'engagement à la souscription (NULL = sans engagement).
          const commitmentEnd = commitmentMonths > 0
            ? (() => { const d = new Date(); d.setMonth(d.getMonth() + commitmentMonths); return d.toISOString(); })()
            : null;

          // Moyen de paiement retenu (carte vs prélèvement SEPA) : affiché
          // dans le back-office et utile au diagnostic d'un impayé.
          let paymentMethodType: string | null = null;
          let periodEnd: string | null = null;
          const membershipSubId = (session.subscription as string) ?? null;
          if (membershipSubId && event.account) {
            try {
              const sub = await stripe.subscriptions.retrieve(
                membershipSubId,
                { expand: ['default_payment_method'] },
                { stripeAccount: event.account },
              ) as any;
              paymentMethodType = sub.default_payment_method?.type ?? null;
              periodEnd = subscriptionPeriodEnd(sub);
            } catch (e: any) {
              logStripeError(ROUTE, 'membership.payment_method_lookup', e);
            }
          }

          await activateMembership(session, {
            boxId, planId, userId, buyerEmail,
            billingDay: metadataBillingDay(session.metadata),
            subscriptionId: membershipSubId,
            periodEnd, paymentMethodType, amountCents, feeCents, commitmentEnd,
          });
          break;
        }

        // ── Abonnement de salle avec échéance future (lot 3) ─────────────
        // Checkout en mode `setup` : moyen de paiement enregistré, rien payé.
        // L'abonnement se crée ici, en essai jusqu'à l'échéance.
        if (session.metadata?.kind === 'membership_deferred') {
          const failed = await createDeferredMembership(session, event.account ?? null);
          if (failed) return failed;
          break;
        }

        // ── Achat unique de crédits : Drop-in / Carnet ─────────────────
        if (session.metadata?.kind === 'credit') {
          const planId = session.metadata.plan_id ?? null;
          const boxId = session.metadata.box_id;
          const credits = Number(session.metadata.credits ?? 0);
          const validityDays = Number(session.metadata.validity_days ?? 0);
          if (!boxId || credits <= 0 || validityDays <= 0) break;

          const { userId, email: buyerEmail } = await resolveBuyer(session);
          if (!userId) {
            await parkPendingEntitlement('credit', buyerEmail, session.id, {
              box_id: boxId,
              plan_id: planId,
              credits,
              validity_days: validityDays,
              stripe_payment_intent: (session.payment_intent as string) ?? null,
            });
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
          // Idempotence : Stripe peut ré-émettre le même événement. Une
          // contrainte unique sur stripe_checkout_session_id garantit un
          // seul crédit par paiement ; le rejeu (23505) est déjà traité.
          if (creditErr?.code === '23505') {
            console.log('Credit already processed — skipping duplicate.');
            break;
          }
          must({ error: creditErr }, 'member_class_credits.insert');

          await closeInvitation(session.metadata.invitation_id, userId);

          console.log(`Credit pack (${credits} séances) activated`);
          break;
        }

        // ── Abonnement d'une box à une programmation (marketplace box→box) ─
        if (session.metadata?.kind === 'box_programming') {
          const programmingId = session.metadata.programming_id;
          const subscriberBoxId = session.metadata.subscriber_box_id;
          const createdBy = session.metadata.created_by ?? null;
          if (!programmingId || !subscriberBoxId) break;

          // Ancre = lundi SUIVANT (Europe/Paris), comme le DEFAULT de la colonne
          // et subscribe_free_programming : la semaine 1 est celle que le cron
          // du dimanche 18h pose en premier. `date_trunc('week', now() at time
          // zone 'Europe/Paris')::date + 7`, recalculé ici car l'upsert réécrit
          // la ligne d'un réabonnement.
          const nowParis = new Date(
            new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }),
          );
          const isoDow = nowParis.getDay() === 0 ? 7 : nowParis.getDay();
          const monday = new Date(nowParis);
          monday.setDate(nowParis.getDate() - isoDow + 1 + 7);
          const weekAnchor = [
            monday.getFullYear(),
            String(monday.getMonth() + 1).padStart(2, '0'),
            String(monday.getDate()).padStart(2, '0'),
          ].join('-');

          const { error: subErr } = await supabase
            .from('box_programming_subscriptions')
            .upsert(
              {
                programming_id: programmingId,
                subscriber_box_id: subscriberBoxId,
                status: 'active',
                week_anchor: weekAnchor,
                created_by: createdBy,
                stripe_customer_id: (session.customer as string) ?? null,
                stripe_subscription_id: (session.subscription as string) ?? null,
              },
              { onConflict: 'programming_id,subscriber_box_id' },
            );
          must({ error: subErr }, 'box_programming_subscriptions.upsert');
          console.log('Box programming activated');
          break;
        }

        if (session.metadata?.kind !== 'program') break;

        const programId = session.metadata.program_id;
        const amountCents = Number(session.metadata.amount_cents ?? 0) || null;
        const feeCents = Number(session.metadata.platform_fee_cents ?? 0) || null;
        if (!programId) break;

        const { userId, email: buyerEmail } = await resolveBuyer(session);
        if (!userId) {
          // L'acheteur n'a pas (encore) de compte : l'achat attend son inscription.
          await parkPendingEntitlement('program', buyerEmail, session.id, {
            program_id: programId,
            amount_cents: amountCents,
            platform_fee_cents: feeCents,
            stripe_subscription_id: (session.subscription as string) ?? null,
            stripe_payment_intent: (session.payment_intent as string) ?? null,
          });
          break;
        }

        // Point d'entrée unique de program_members : l'écriture directe est
        // fermée en base (Lot 0-bis). Ici c'est la porte `stripe`, réservée au
        // backend et adossée à une référence de paiement — la signature de
        // l'évènement a déjà été vérifiée plus haut.
        // `program_members.start_date` est toujours NULL à la création (owner
        // ou Stripe) : le lundi est choisi par l'athlète via
        // `set_program_start_date`. Un achat Stripe réactive un accès annulé
        // (upsert sur (program_id, user_id) → status 'active', provenance 'stripe').
        const { error: programWriteErr } = await supabase.rpc('join_program', {
          p_program_id: programId,
          p_source: 'stripe',
          p_user_id: userId,
          p_amount_cents: amountCents,
          p_platform_fee_cents: feeCents,
          p_stripe_checkout_session_id: session.id,
          p_stripe_subscription_id: (session.subscription as string) ?? null,
          p_stripe_payment_intent: (session.payment_intent as string) ?? null,
        });
        must({ error: programWriteErr }, 'rpc.join_program');

        console.log('Program activated');
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        must(await supabase.from('program_members')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id), 'program_members.update_cancelled');
        // Abonnement programmation box→box résilié → `unsubscribe_programming`
        // (backend) passe le statut à canceled et retire les cartes reçues à
        // partir du lundi suivant si le gérant l'a demandé (remove_future_on_cancel).
        const { data: progSubs } = must(await supabase.from('box_programming_subscriptions')
          .select('id')
          .eq('stripe_subscription_id', sub.id), 'box_programming_subscriptions.select');
        // Toutes les lignes sont tentées avant de jeter : un échec ne laisse
        // pas les suivantes non traitées à chaque rejeu (la RPC est idempotente).
        const unsubErrors: unknown[] = [];
        for (const row of (progSubs ?? []) as { id: string }[]) {
          const { error: unsubErr } = await supabase.rpc('unsubscribe_programming', {
            p_subscription_id: row.id, p_remove_future: null,
          });
          if (unsubErr) unsubErrors.push(unsubErr);
        }
        if (unsubErrors.length) {
          must({ error: unsubErrors[0] }, `rpc.unsubscribe_programming (${unsubErrors.length} en échec)`);
        }
        must(await supabase.from('box_programming_subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id), 'box_programming_subscriptions.update_canceled');
        // Abonnement salle résilié → retire la formule (déclenche la sync des groupes).
        must(await supabase.from('box_members')
          .update({
            subscription_status: 'cancelled', plan_id: null,
            subscription_cancel_at_period_end: false,
            commitment_end_date: null, subscription_paused: false,
            pause_started_at: null, pause_resumes_at: null,
          })
          .eq('stripe_subscription_id', sub.id), 'box_members.update_cancelled');
        // Fin réelle de l'abonnement → l'adhérent n'est plus membre actif : il perd
        // l'accès gardé par status='active' (créneaux, réservation, WOD de box).
        // On ne touche pas un membre 'banned' (déjà sans accès, décision de l'owner).
        must(await supabase.from('box_members')
          .update({ status: 'inactive' })
          .eq('stripe_subscription_id', sub.id)
          .eq('status', 'active'), 'box_members.update_inactive');
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
        must(await supabase.from('program_members')
          .update({ status })
          .eq('stripe_subscription_id', sub.id), 'program_members.update_status');
        // Programmation box→box : active / past_due / canceled + fin de période.
        must(await supabase.from('box_programming_subscriptions')
          .update({
            status: sub.status === 'active' || sub.status === 'trialing' ? 'active'
              : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due'
              : 'canceled',
            current_period_end: subscriptionPeriodEnd(sub),
          })
          .eq('stripe_subscription_id', sub.id), 'box_programming_subscriptions.update_status');
        // Statut d'abonnement salle : active / past_due (impayé) / cancelled.
        const memberStatus = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due'
          : 'cancelled';
        const periodEnd = subscriptionPeriodEnd(sub);

        // Sync du plan après un changement de formule : on retrouve la formule
        // via le prix Stripe courant (ou la metadata plan_id) et on met à jour box_members.
        const planPatch: { plan_id?: string; amount_cents?: number } = {};
        const item = sub.items?.data?.[0];
        // La formule d'un changement programmé arrive par la metadata de la
        // phase, recopiée sur l'abonnement à la bascule (ou sur l'item).
        const metaPlanId = (sub.metadata?.plan_id ?? item?.metadata?.plan_id) as string | undefined;
        const currentPriceId = item?.price?.id as string | undefined;
        if (metaPlanId) {
          planPatch.plan_id = metaPlanId;
          // Le prix réellement prélevé : sans lui, l'ancien montant restait affiché.
          const unit = item?.price?.unit_amount;
          if (typeof unit === 'number') planPatch.amount_cents = unit * (item?.quantity ?? 1);
        } else if (currentPriceId) {
          const { data: matchedPlan } = must(await supabase.from('membership_plans')
            .select('id, price_cents')
            .eq('stripe_price_id', currentPriceId)
            .maybeSingle(), 'membership_plans.select_by_price');
          if (matchedPlan?.id) {
            planPatch.plan_id = matchedPlan.id;
            planPatch.amount_cents = matchedPlan.price_cents;
          }
        }

        must(await supabase.from('box_members')
          .update({
            subscription_status: memberStatus,
            // Sortie d'impayé : on efface l'ancre de suspension et le compteur
            // de relances pour rétablir l'accès immédiatement.
            ...(memberStatus === 'active'
              ? {
                  past_due_since: null,
                  dunning_attempts: 0,
                  last_payment_error: null,
                  dunning_reminders_sent: 0,
                  dunning_last_reminder_at: null,
                }
              : {}),
            subscription_current_period_end: periodEnd,
            // Fin programmée : à la fin de la période, ou à une date (`cancel_at`).
            subscription_cancel_at_period_end: !!sub.cancel_at_period_end || sub.cancel_at != null,
            ...(memberStatus !== 'cancelled' ? planPatch : {}),
          })
          .eq('stripe_subscription_id', sub.id), 'box_members.update_subscription');
        // Bascule d'un changement programmé : la formule écrite est celle qui
        // était attendue, il n'y a plus rien de programmé. Conditionnel :
        // un autre changement programmé entre-temps n'est pas effacé.
        if (memberStatus !== 'cancelled' && planPatch.plan_id) {
          const { data: bascule } = must(await supabase.from('box_members')
            .update({ scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null })
            .eq('stripe_subscription_id', sub.id)
            .eq('scheduled_plan_id', planPatch.plan_id)
            .select('id'), 'box_members.update_bascule');
          // L'échéancier a fait son œuvre : relâché tout de suite, pour qu'il ne
          // reste pas attaché un mois (idempotent ; déjà relâché ou absent : rien).
          const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id;
          if ((bascule ?? []).length > 0 && scheduleId && event.account) {
            try {
              await releaseSchedule(stripe, scheduleId, 'bascule', event.account);
            } catch (err: any) {
              logStripeError(ROUTE, 'schedule_release_after_switch', err);
            }
          }
        }
        // Ancre l'impayé si l'événement d'abonnement arrive avant
        // invoice.payment_failed. `.is(null)` garantit l'idempotence : la date
        // du premier échec n'est jamais repoussée par une nouvelle tentative.
        if (memberStatus === 'past_due') {
          must(await supabase.from('box_members')
            .update({ past_due_since: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id)
            .is('past_due_since', null), 'box_members.update_past_due_since');
        }
        break;
      }

      // ── Impayés (dunning) sur les abonnements de salle ───────────────
      // Stripe gère les nouvelles tentatives (Smart Retries) ; on garde ici
      // les conséquences métier : depuis quand l'abonnement est impayé, le
      // nombre de tentatives et le motif. `past_due_since` est la source du
      // délai de grâce et de la suspension des réservations (trigger SQL
      // membership_access_blocked), donc on ne l'écrase pas à chaque échec.
      case 'invoice.payment_failed':
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as any;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId) {
          console.warn(`${event.type} ${event.id}: invoice ${invoice.id} has no subscription — nothing updated.`);
          break;
        }

        const { data: member } = must(await supabase
          .from('box_members')
          .select('id, past_due_since, dunning_attempts')
          .eq('stripe_subscription_id', subId)
          .maybeSingle(), 'box_members.select_dunning');
        const m = member as { id: string; past_due_since: string | null; dunning_attempts: number | null } | null;
        if (!m) break;

        // La facture ne porte pas de `last_payment_error` (il est sur le
        // PaymentIntent) : seul l'échec de finalisation est lisible ici.
        const reason: string | null =
          (invoice.last_finalization_error?.message as string | undefined) ?? null;

        must(await supabase
          .from('box_members')
          .update({
            subscription_status: 'past_due',
            past_due_since: m.past_due_since ?? new Date().toISOString(),
            dunning_attempts: (m.dunning_attempts ?? 0) + 1,
            last_payment_error: reason,
          })
          .eq('id', m.id), 'box_members.update_dunning');
        console.log('Membership past_due recorded');
        break;
      }

      // Régularisation : l'accès est rétabli dès que past_due_since repasse à
      // NULL (le blocage est dérivé, aucun cron de réactivation nécessaire).
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId) {
          console.warn(`${event.type} ${event.id}: invoice ${invoice.id} has no subscription — nothing updated.`);
          break;
        }

        must(await supabase
          .from('box_members')
          .update({
            subscription_status: 'active',
            past_due_since: null,
            dunning_attempts: 0,
            last_payment_error: null,
            dunning_reminders_sent: 0,
            dunning_last_reminder_at: null,
          })
          .eq('stripe_subscription_id', subId), 'box_members.update_dunning_reset');
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          const paymentIntent = charge.payment_intent as string;
          must(await supabase.from('program_members')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', paymentIntent), 'program_members.update_refunded');
          // Achat unique de crédits (Drop-in / Carnet) remboursé : on révoque
          // l'accès pour que les séances prépayées ne soient plus réservables.
          must(await supabase.from('member_class_credits')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', paymentIntent), 'member_class_credits.update_refunded');
        }
        break;
      }

      // ── Changement de formule programmé : l'échéancier n'existe plus ─────
      // Relâché (annulation par le membre, ou fin), annulé ou terminé : plus
      // rien n'est programmé. Conditionnel sur l'identifiant de l'échéancier :
      // idempotent, et sans effet si aucune ligne ne le porte.
      case 'subscription_schedule.released':
      case 'subscription_schedule.canceled':
      case 'subscription_schedule.completed': {
        const schedule = event.data.object as { id: string };
        must(await supabase.from('box_members')
          .update({ scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null })
          .eq('stripe_schedule_id', schedule.id), 'box_members.update_schedule_cleared');
        break;
      }

      default:
        console.log(`Unhandled connect event: ${event.type}`);
    }
  } catch (err: any) {
    // 500 : Stripe rejoue l'événement. Le message reste dans le journal, nettoyé.
    logStripeError(ROUTE, event.type, err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
