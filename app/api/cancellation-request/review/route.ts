import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { stopSubscription } from '@/lib/stripe/stopSubscription';
import { sendMembershipStoppedPush } from '@/lib/members/membershipPush';
import {
  REVIEW_EMAIL_WARNING, memberFirstName, reviewEmailContent, sendMemberEmail,
} from '@/lib/members/stopMembership';

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

const STRIPE_FAILED =
  "Stripe n'a pas accepté l'arrêt de l'abonnement. La demande reste en attente : tu peux réessayer.";
const STRIPE_UNDO_FAILED =
  "Stripe n'a pas accepté l'arrêt de l'abonnement, et la demande n'a pas pu être remise en attente. Contacte le support AthleX.";

/**
 * Le gérant de la box approuve ou refuse une demande de résiliation anticipée.
 * La décision est réservée en base avant tout appel (Stripe, e-mail, push) :
 * deux réponses simultanées n'en laissent passer qu'une.
 * Approuver → résilie l'abonnement à la fin de la période et lève l'engagement.
 * Dans les deux cas, le membre reçoit un e-mail (réponse vers la box). Pas de
 * ligne de journal : une approbation n'est pas un arrêt décidé par le gérant.
 * Body: { request_id: string, action: 'approve' | 'reject', note?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { request_id, action, note } = await req.json();
    if (!request_id || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: reqRaw } = await supabase
      .from('membership_cancellation_requests')
      .select('id, box_id, member_id, status')
      .eq('id', request_id)
      .maybeSingle();
    const request = reqRaw as {
      id: string; box_id: string; member_id: string; status: string;
    } | null;

    if (!request) {
      return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    }
    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });
    }
    if (!(await isBoxOwnerAdmin(supabase, user.id, request.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    // Réservation : la décision s'écrit d'abord, et seulement si la demande est
    // encore en attente. Une seconde réponse (co-gérant, double clic) ne trouve
    // plus de ligne : 409, ni Stripe, ni e-mail, ni push.
    const decision = action === 'approve' ? 'approved' : 'rejected';
    const reviewNote = (note as string | undefined)?.trim() || null;
    const { data: reserved, error: reserveError } = await supabase
      .from('membership_cancellation_requests')
      .update({
        status: decision,
        review_note: reviewNote,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (reserveError) throw new Error(reserveError.message);
    if (!reserved) {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });
    }

    const [{ data: memberRaw }, { data: boxRaw }, { data: profileRaw }] = await Promise.all([
      supabase
        .from('box_members')
        .select('id, plan_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end')
        .eq('box_id', request.box_id)
        .eq('member_id', request.member_id)
        .maybeSingle(),
      supabase.from('boxes').select('name, stripe_account_id, contact_email').eq('id', request.box_id).single(),
      supabase.from('profiles').select('email, username, full_name').eq('id', request.member_id).maybeSingle(),
    ]);
    const member = memberRaw as {
      id: string; plan_id: string | null; stripe_subscription_id: string | null;
      subscription_status: string | null; subscription_current_period_end: string | null;
      subscription_cancel_at_period_end: boolean | null;
    } | null;
    const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;
    const profile = profileRaw as { email: string | null; username: string | null; full_name: string | null } | null;

    // Arrêt effectif de cette approbation : un abonnement Stripe en cours, pas
    // déjà en fin programmée (sinon le membre a déjà eu son push).
    let stopped = false;
    if (action === 'approve') {
      if (member?.stripe_subscription_id && ACTIVE_STATUSES.includes(member.subscription_status ?? '')) {
        if (box?.stripe_account_id) {
          stopped = !member.subscription_cancel_at_period_end;
          // Clé tirée de la demande : une nouvelle tentative après échec rejoue le même arrêt.
          try {
            await stopSubscription({
              stripeAccount: box.stripe_account_id,
              subscriptionId: member.stripe_subscription_id,
              mode: 'period_end',
              idempotencyKey: `review:${request.id}`,
            });
          } catch (err: any) {
            // Ni message ni identifiant : type et code Stripe seulement.
            console.error('cancellation-request review stripe error', err?.type ?? 'unknown', err?.code ?? '', err?.statusCode ?? '');
            // La demande revient en attente (si elle porte encore cette décision)
            // pour que le gérant puisse réessayer ; aucun message au membre.
            const { error: undoError } = await supabase
              .from('membership_cancellation_requests')
              .update({ status: 'pending', review_note: null, reviewed_by: null, reviewed_at: null })
              .eq('id', request.id)
              .eq('status', decision);
            if (undoError) {
              console.error('cancellation-request review undo failed');
              return NextResponse.json({ error: STRIPE_UNDO_FAILED }, { status: 500 });
            }
            return NextResponse.json({ error: STRIPE_FAILED }, { status: 502 });
          }
        }
      }

      // Lève l'engagement pour que la résiliation ne soit plus bloquée.
      if (member?.id) {
        await supabase.from('box_members')
          .update({ commitment_end_date: null, subscription_cancel_at_period_end: true })
          .eq('id', member.id);
      }
    }

    // E-mail au membre : son échec n'annule pas la réponse.
    let sent = false;
    if (profile?.email) {
      const { data: planRaw } = member?.plan_id
        ? await supabase.from('membership_plans').select('name').eq('id', member.plan_id).maybeSingle()
        : { data: null };
      const boxName = box?.name ?? 'Ta box';
      sent = await sendMemberEmail({
        to: profile.email,
        ...reviewEmailContent({
          action, firstName: memberFirstName(profile), boxName,
          planName: (planRaw as { name: string } | null)?.name ?? null,
          periodEnd: member?.subscription_current_period_end ?? null,
          note: reviewNote,
        }),
        boxName,
        replyTo: box?.contact_email ?? null,
        tag: 'cancellation-review',
        idempotencyKey: `review:${request.id}`,
      });
    }

    // Push « fin programmée » (même envoi que stopBoxMember), après l'e-mail.
    // La réservation ne passe qu'une fois (statut `pending`) : pas de double envoi.
    if (stopped && member) {
      await sendMembershipStoppedPush({
        userId: request.member_id, boxId: request.box_id, mode: 'period_end',
        boxName: box?.name ?? 'Ta box', periodEnd: member.subscription_current_period_end,
      });
    }

    return NextResponse.json({ ok: true, ...(sent ? {} : { warning: REVIEW_EMAIL_WARNING }) });
  } catch (err: any) {
    console.error('cancellation-request review error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
