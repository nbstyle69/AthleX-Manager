import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { stopSubscription, type StopMode } from '@/lib/stripe/stopSubscription';
import { MAIL_FROM } from '@/lib/site-url';

/**
 * Arrêt d'un abonnement de salle par le gérant (S2, option A : aucun
 * remboursement).
 *
 * Body: { box_member_id: string, mode: 'period_end' | 'now' }
 * - Stripe : `period_end` (fin de la période payée) ou `now` (immédiat) ;
 *   un abonnement en impayé n'accepte que `now`.
 * - Comptoir (pas d'abonnement Stripe) : seulement `now`.
 *
 * En base, exactement les écritures que ferait le webhook :
 * - `period_end` → subscription_cancel_at_period_end = true et
 *   commitment_end_date = NULL (comme l'approbation d'une résiliation) ;
 * - `now` → mêmes écritures que `customer.subscription.deleted` : statut
 *   d'abonnement `cancelled`, formule retirée, adhésion `inactive` (le
 *   déclencheur SQL libère alors ses réservations futures).
 *
 * Chaque arrêt écrit une ligne de journal dans
 * `box_member_subscription_actions` (clé serveur du Manager) et prévient le
 * membre par e-mail ; un e-mail non parti n'annule pas l'arrêt, la réponse
 * porte alors un avertissement.
 */

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

async function sendStopEmail(opts: {
  to: string;
  firstName: string;
  boxName: string;
  planName: string;
  mode: StopMode;
  periodEnd: string | null;
  replyTo: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { to, firstName, boxName, planName, mode, periodEnd, replyTo } = opts;

  const subject = mode === 'period_end'
    ? `Ton abonnement à ${boxName} prendra fin le ${periodEnd ? fullDate(periodEnd) : 'la fin de la période payée'}`
    : `Ton abonnement à ${boxName} est arrêté`;
  const bodyText = mode === 'period_end'
    ? `Bonjour ${firstName}, ${boxName} a mis fin à ton abonnement ${planName}. Tu gardes l'accès aux cours jusqu'au ${periodEnd ? fullDate(periodEnd) : 'terme de la période payée'} inclus ; aucun prélèvement ne sera fait ensuite. Pour toute question, réponds simplement à cet e-mail : il arrive directement à ${boxName}.`
    : `Bonjour ${firstName}, ${boxName} a arrêté ton abonnement ${planName} aujourd'hui. Tes réservations à venir ont été annulées et aucun prélèvement ne sera plus fait. Pour toute question, réponds à cet e-mail : il arrive directement à ${boxName}.`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 24px">
    <tr><td>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">${esc(subject)}</h1>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 24px">${esc(bodyText)}</p>
      <p style="font-size:12px;color:#777;margin:28px 0 0">Message envoyé par ${esc(boxName)} via AthleX.</p>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MAIL_FROM, to, subject, html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    // Jamais l'adresse du membre ni le corps dans les journaux.
    console.error('stop-subscription resend error', res.status);
    return false;
  }
  return true;
}

const EMAIL_WARNING =
  "L'abonnement est bien arrêté, mais l'e-mail au membre n'est pas parti : préviens-le directement.";

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { box_member_id, mode } = await req.json();
    if (!box_member_id || (mode !== 'period_end' && mode !== 'now')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: memberRaw } = await supabase
      .from('box_members')
      .select('id, box_id, member_id, plan_id, status, stripe_subscription_id, subscription_status, subscription_cancel_at_period_end, subscription_current_period_end')
      .eq('id', box_member_id)
      .maybeSingle();
    const member = memberRaw as {
      id: string; box_id: string; member_id: string; plan_id: string | null;
      status: string | null;
      stripe_subscription_id: string | null;
      subscription_status: string | null;
      subscription_cancel_at_period_end: boolean | null;
      subscription_current_period_end: string | null;
    } | null;

    if (!member) {
      return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
    }
    if (!(await isBoxOwnerAdmin(supabase, user.id, member.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const hasStripeSub = !!member.stripe_subscription_id;

    // État demandé déjà atteint : on ne refait rien (idempotence côté Manager).
    if (member.subscription_status === 'cancelled') {
      return NextResponse.json({ ok: true, already: true });
    }
    if (mode === 'period_end' && member.subscription_cancel_at_period_end) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (!hasStripeSub && mode === 'period_end') {
      return NextResponse.json(
        { error: 'Ce membre paie au comptoir : il n\'y a pas de période Stripe, seul l\'arrêt immédiat est possible.' },
        { status: 409 },
      );
    }
    if (member.subscription_status === 'past_due' && mode === 'period_end') {
      return NextResponse.json(
        { error: 'Cet abonnement est en impayé : seul l\'arrêt immédiat est possible.' },
        { status: 409 },
      );
    }

    // Le nom de la formule sert à l'e-mail : lu avant que `now` la retire.
    const [{ data: boxRaw }, { data: planRaw }, { data: profileRaw }] = await Promise.all([
      supabase.from('boxes').select('name, stripe_account_id, contact_email').eq('id', member.box_id).single(),
      member.plan_id
        ? supabase.from('membership_plans').select('name').eq('id', member.plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('profiles').select('email, username, full_name').eq('id', member.member_id).maybeSingle(),
    ]);
    const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;
    const plan = planRaw as { name: string } | null;
    const profile = profileRaw as { email: string | null; username: string | null; full_name: string | null } | null;

    if (hasStripeSub) {
      if (!box?.stripe_account_id) {
        return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
      }
      await stopSubscription({
        stripeAccount: box.stripe_account_id,
        subscriptionId: member.stripe_subscription_id!,
        mode,
        idempotencyKey: `stop:${member.id}:${member.stripe_subscription_id}:${mode}`,
      });
    }

    // Écritures en base : exactement celles du webhook correspondant.
    if (mode === 'period_end') {
      await supabase.from('box_members')
        .update({ subscription_cancel_at_period_end: true, commitment_end_date: null })
        .eq('id', member.id);
    } else {
      await supabase.from('box_members')
        .update({
          subscription_status: 'cancelled', plan_id: null,
          subscription_cancel_at_period_end: false,
          commitment_end_date: null, subscription_paused: false,
          pause_started_at: null, pause_resumes_at: null,
        })
        .eq('id', member.id);
      // Fin réelle → plus membre actif ; un membre banni n'est pas touché.
      await supabase.from('box_members')
        .update({ status: 'inactive' })
        .eq('id', member.id)
        .eq('status', 'active');
    }

    // Journal (clé serveur du Manager) : une ligne par arrêt, remboursement à 0.
    const { data: journalRaw, error: journalError } = await supabase
      .from('box_member_subscription_actions')
      .insert({
        box_id: member.box_id,
        box_member_id: member.id,
        member_id: member.member_id,
        action: 'stop',
        mode,
        stripe_subscription_id: member.stripe_subscription_id,
        refund_cents: 0,
        actor_id: user.id,
      })
      .select('id')
      .maybeSingle();
    if (journalError) {
      console.error('stop-subscription journal insert failed:', journalError.message);
    }
    const journalId = (journalRaw as { id: string } | null)?.id ?? null;

    // E-mail au membre : son échec n'annule pas l'arrêt.
    let warning: string | null = null;
    const email = profile?.email ?? null;
    if (!email) {
      warning = EMAIL_WARNING;
    } else {
      const firstName = profile?.full_name?.trim().split(/\s+/)[0] || profile?.username || 'toi';
      let sent = false;
      try {
        sent = await sendStopEmail({
          to: email,
          firstName,
          boxName: box?.name ?? 'ta box',
          planName: plan?.name ?? 'de salle',
          mode,
          periodEnd: member.subscription_current_period_end,
          replyTo: box?.contact_email ?? null,
        });
      } catch {
        sent = false;
      }
      if (sent && journalId) {
        await supabase.from('box_member_subscription_actions')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', journalId);
      }
      if (!sent) warning = EMAIL_WARNING;
    }

    return NextResponse.json({ ok: true, mode, ...(warning ? { warning } : {}) });
  } catch (err: any) {
    console.error('stop-subscription error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
