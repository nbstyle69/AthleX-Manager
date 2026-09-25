import type { SupabaseClient } from '@supabase/supabase-js';
import { stopSubscription, type StopMode } from '@/lib/stripe/stopSubscription';
import { MAIL_FROM } from '@/lib/site-url';

/**
 * Cœur serveur de l'arrêt d'un abonnement de salle (S2), partagé par S4
 * (suppression d'une formule, bannissement) : appel Stripe idempotent,
 * écritures en base identiques à celles du webhook, ligne de journal
 * `box_member_subscription_actions`, e-mail au membre.
 *
 * Aucune donnée personnelle ni secret dans les journaux serveur.
 */

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Prénom affiché dans les e-mails : prénom du nom complet, sinon pseudo. */
export function memberFirstName(profile: { full_name?: string | null; username?: string | null } | null): string {
  return profile?.full_name?.trim().split(/\s+/)[0] || profile?.username || 'toi';
}

/**
 * Envoi Resend (modèle de `app/api/dunning`). Renvoie `false` sans lever si la
 * clé manque ou si Resend refuse : l'appelant décide de l'avertissement.
 */
export async function sendMemberEmail(opts: {
  to: string;
  subject: string;
  bodyText: string;
  boxName: string;
  replyTo: string | null;
  tag: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const { to, subject, bodyText, boxName, replyTo, tag } = opts;

  const paragraphs = bodyText
    .split('\n\n')
    .map(p => `<p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 16px">${esc(p)}</p>`)
    .join('');
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 24px">
    <tr><td>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">${esc(subject)}</h1>
      ${paragraphs}
      <p style="font-size:12px;color:#777;margin:28px 0 0">Message envoyé par ${esc(boxName)} via AthleX.</p>
    </td></tr>
  </table>
</body></html>`;

  try {
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
      console.error(`${tag} resend error`, res.status);
      return false;
    }
    return true;
  } catch {
    console.error(`${tag} resend unreachable`);
    return false;
  }
}

/** Textes validés en S2 (abonnement de salle). */
export function stopEmailContent(opts: {
  mode: StopMode; firstName: string; boxName: string; planName: string; periodEnd: string | null;
}) {
  const { mode, firstName, boxName, planName, periodEnd } = opts;
  const subject = mode === 'period_end'
    ? `Ton abonnement à ${boxName} prendra fin le ${periodEnd ? fullDate(periodEnd) : 'la fin de la période payée'}`
    : `Ton abonnement à ${boxName} est arrêté`;
  const bodyText = mode === 'period_end'
    ? `Bonjour ${firstName}, ${boxName} a mis fin à ton abonnement ${planName}. Tu gardes l'accès aux cours jusqu'au ${periodEnd ? fullDate(periodEnd) : 'terme de la période payée'} inclus ; aucun prélèvement ne sera fait ensuite. Pour toute question, réponds simplement à cet e-mail : il arrive directement à ${boxName}.`
    : `Bonjour ${firstName}, ${boxName} a arrêté ton abonnement ${planName} aujourd'hui. Tes réservations à venir ont été annulées et aucun prélèvement ne sera plus fait. Pour toute question, réponds à cet e-mail : il arrive directement à ${boxName}.`;
  return { subject, bodyText };
}

/** Textes des réponses à une demande de résiliation (S4). */
export function reviewEmailContent(opts: {
  action: 'approve' | 'reject'; firstName: string; boxName: string;
  planName: string | null; periodEnd: string | null; note: string | null;
}) {
  const { action, firstName, boxName, planName, periodEnd, note } = opts;
  const date = periodEnd ? `le ${fullDate(periodEnd)}` : 'à la fin de la période payée';
  if (action === 'approve') {
    return {
      subject: `Ta demande de résiliation est acceptée : ton abonnement à ${boxName} prendra fin ${date}`,
      bodyText: `Bonjour ${firstName}, ${boxName} a accepté ta demande de résiliation. Ton abonnement${planName ? ` ${planName}` : ''} prendra fin ${date} : tu gardes l'accès aux cours jusque-là, et aucun prélèvement ne sera fait ensuite. Ton engagement est levé.\n\nPour toute question, réponds à cet e-mail : il arrive directement à ${boxName}.`,
    };
  }
  return {
    subject: `${boxName} n'a pas pu accepter ta demande de résiliation`,
    bodyText: `Bonjour ${firstName}, ${boxName} n'a pas pu accepter ta demande de résiliation.${note ? `\n\nMotif : « ${note} »` : ''}\n\nTon abonnement et ton engagement continuent normalement. Pour en parler, réponds à cet e-mail : il arrive directement à ${boxName}.`,
  };
}

export const REVIEW_EMAIL_WARNING =
  "La réponse est enregistrée, mais l'e-mail au membre n'est pas parti : préviens-le directement.";

export const EMAIL_WARNING =
  "L'abonnement est bien arrêté, mais l'e-mail au membre n'est pas parti : préviens-le directement.";

export interface StopTarget {
  id: string;
  box_id: string;
  member_id: string;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
}

export interface StopBox {
  name: string;
  stripe_account_id: string | null;
  contact_email: string | null;
}

export interface StopProfile {
  email: string | null;
  username: string | null;
  full_name: string | null;
}

/** Clé d'idempotence Stripe d'un arrêt de salle (la même qu'en S2). */
export const stopKey = (boxMemberId: string, subscriptionId: string | null, mode: StopMode) =>
  `stop:${boxMemberId}:${subscriptionId}:${mode}`;

/**
 * Arrête l'abonnement d'un membre. Lève si Stripe refuse (rien n'est alors
 * écrit en base). Renvoie `emailed` : l'e-mail est-il parti ?
 */
export async function stopBoxMember(
  supabase: SupabaseClient,
  args: {
    member: StopTarget;
    box: StopBox | null;
    profile: StopProfile | null;
    planName: string | null;
    mode: StopMode;
    actorId: string;
  },
): Promise<{ emailed: boolean }> {
  const { member, box, profile, planName, mode, actorId } = args;

  if (member.stripe_subscription_id) {
    if (!box?.stripe_account_id) throw new Error('Compte de paiement de la box introuvable.');
    await stopSubscription({
      stripeAccount: box.stripe_account_id,
      subscriptionId: member.stripe_subscription_id,
      mode,
      idempotencyKey: stopKey(member.id, member.stripe_subscription_id, mode),
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
      actor_id: actorId,
    })
    .select('id')
    .maybeSingle();
  if (journalError) {
    console.error('stop-subscription journal insert failed:', journalError.message);
  }
  const journalId = (journalRaw as { id: string } | null)?.id ?? null;

  // E-mail au membre : son échec n'annule pas l'arrêt.
  const email = profile?.email ?? null;
  if (!email) return { emailed: false };
  const content = stopEmailContent({
    mode,
    firstName: memberFirstName(profile),
    boxName: box?.name ?? 'ta box',
    planName: planName ?? 'de salle',
    periodEnd: member.subscription_current_period_end,
  });
  const sent = await sendMemberEmail({
    to: email, ...content, boxName: box?.name ?? 'ta box', replyTo: box?.contact_email ?? null, tag: 'stop-subscription',
  });
  if (sent && journalId) {
    await supabase.from('box_member_subscription_actions')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', journalId);
  }
  return { emailed: sent };
}
