import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';
import { MAIL_FROM } from '@/lib/site-url';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

async function sendReminderEmail(
  to: string, boxName: string, amountCents: number | null, replyTo: string | null,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = MAIL_FROM;
  const amount = amountCents ? `${(amountCents / 100).toFixed(2)} €` : null;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 24px">
    <tr><td>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">Ton abonnement est impayé</h1>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 24px">
        ${amount ? `Le prélèvement de ${esc(amount)} pour ton abonnement ${esc(boxName)} a échoué.` : `Le prélèvement de ton abonnement ${esc(boxName)} a échoué.`}
        Mets ton moyen de paiement à jour pour éviter la suspension de tes réservations.
      </p>
      <p style="font-size:12px;color:#777;margin:28px 0 0">Relance envoyée par ${esc(boxName)} via AthleX.</p>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to, subject: 'Ton abonnement est impayé', html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    console.error('dunning resend error', res.status, await res.text());
    return false;
  }
  return true;
}

/**
 * Actions d'impayé du back-office box (staff uniquement).
 *  - action='remind' : relance manuelle par email (en plus des relances
 *    automatiques J0/J3/J7 de la fonction planifiée `dunning-cron`).
 *  - action='retry'  : nouvelle tentative de paiement immédiate sur la
 *    dernière facture ouverte de l'abonnement (Stripe encaisse, le webhook
 *    `invoice.paid` réactive les droits).
 * Body: { box_member_id: string, action: 'remind' | 'retry' }
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { box_member_id, action } = await req.json();
    if (!box_member_id || (action !== 'remind' && action !== 'retry')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: memberRaw } = await supabase
      .from('box_members')
      .select('id, box_id, member_id, stripe_subscription_id, subscription_status, amount_cents')
      .eq('id', box_member_id)
      .maybeSingle();

    const member = memberRaw as {
      id: string; box_id: string; member_id: string;
      stripe_subscription_id: string | null;
      subscription_status: string | null;
      amount_cents: number | null;
    } | null;

    if (!member) {
      return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
    }
    if (!(await isBoxStaff(supabase, user.id, member.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }
    if (member.subscription_status !== 'past_due') {
      return NextResponse.json({ error: 'Cet abonnement n\'est pas en impayé.' }, { status: 409 });
    }

    const { data: box } = await supabase
      .from('boxes')
      .select('name, stripe_account_id, contact_email')
      .eq('id', member.box_id)
      .single();
    const b = box as {
      name: string; stripe_account_id: string | null; contact_email: string | null;
    } | null;

    if (action === 'remind') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', member.member_id)
        .maybeSingle();
      const email = (profile as { email: string | null } | null)?.email;
      if (!email) {
        return NextResponse.json({ error: 'Ce membre n\'a pas d\'email.' }, { status: 409 });
      }

      const sent = await sendReminderEmail(
        email, b?.name ?? 'ta box', member.amount_cents, b?.contact_email ?? null,
      );
      if (!sent) {
        return NextResponse.json({ error: 'Envoi de la relance impossible.' }, { status: 502 });
      }

      await supabase.from('box_members')
        .update({ dunning_last_reminder_at: new Date().toISOString() })
        .eq('id', member.id);

      return NextResponse.json({ ok: true, reminded: true });
    }

    // action === 'retry'
    if (!member.stripe_subscription_id) {
      return NextResponse.json({ error: 'Ce membre n\'a pas d\'abonnement Stripe.' }, { status: 409 });
    }
    if (!b?.stripe_account_id) {
      return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
    }
    const stripeAccount = b.stripe_account_id;

    const invoices = await stripe.invoices.list(
      { subscription: member.stripe_subscription_id, status: 'open', limit: 1 },
      { stripeAccount },
    );
    const invoice = invoices.data[0];
    if (!invoice?.id) {
      return NextResponse.json({ error: 'Aucune facture impayée à encaisser.' }, { status: 409 });
    }

    // Stripe met la facture à `paid` (CB) ou la laisse `open` le temps du
    // règlement SEPA ; dans les deux cas le webhook fait foi pour les droits.
    const paid = await stripe.invoices.pay(invoice.id, {}, { stripeAccount });

    return NextResponse.json({ ok: true, invoice_status: paid.status });
  } catch (err: any) {
    console.error('dunning error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
