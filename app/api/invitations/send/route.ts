import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { SITE_URL, MAIL_FROM } from '@/lib/site-url';

/**
 * Envoi du lien d'invitation par e-mail, au nom de la box.
 *
 * Le jeton n'existe qu'en mémoire chez l'appelant (il n'est stocké que haché),
 * il est donc transmis dans le corps — mais on ne fait confiance à rien
 * d'autre : l'adresse du destinataire et le nom de la box sont relus en base à
 * partir de l'invitation, jamais pris dans la requête. Sans ça, la route
 * deviendrait un relais d'envoi vers n'importe quelle adresse.
 *
 * La trace de délivrance n'est pas écrite ici : elle passe par la RPC
 * `mark_box_invitation_sent`, appelée par le client avec SON jeton, ce qui la
 * garde soumise à `is_box_admin`.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const invitationId = typeof body?.invitation_id === 'string' ? body.invitation_id : '';
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!invitationId || !token) {
    return NextResponse.json({ error: 'Invitation ou lien manquant.' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: invitation } = await service
    .from('box_invitations')
    .select('id, box_id, email, first_name, status, expires_at, plan_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation introuvable.' }, { status: 404 });
  }

  if (!(await isBoxOwnerAdmin(service, user.id, invitation.box_id))) {
    return NextResponse.json({ error: 'Cette invitation n’est pas la vôtre.' }, { status: 403 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json(
      { error: 'Cette invitation n’est plus en attente.' },
      { status: 409 },
    );
  }

  const [{ data: box }, { data: plan }] = await Promise.all([
    service.from('boxes').select('name, contact_email').eq('id', invitation.box_id).maybeSingle(),
    invitation.plan_id
      ? service.from('membership_plans').select('name, price_cents').eq('id', invitation.plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { sent: false, error: 'RESEND_API_KEY absente — utilise le QR code ou le lien.' },
      { status: 200 },
    );
  }

  const origin = SITE_URL;
  const link = `${origin}/rejoindre/${encodeURIComponent(token)}`;
  const boxName = box?.name ?? 'ta box';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hello = invitation.first_name ? `Salut ${esc(invitation.first_name)},` : 'Salut,';
  const planLine = plan
    ? `<p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 8px">Formule : <strong style="color:#fff">${esc(plan.name)}</strong>${plan.price_cents ? ` — ${(plan.price_cents / 100).toFixed(2)} €` : ''}</p>`
    : '';

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 24px">
    <tr><td>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">${esc(boxName)} t'invite à rejoindre AthleX</h1>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 8px">${hello}</p>
      ${planLine}
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 24px">
        Ton inscription est déjà préparée : tu n'as qu'à choisir un pseudo et un mot de passe.
      </p>
      <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#fff;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 22px;border-radius:12px">Créer mon compte</a></p>
      <p style="font-size:12px;color:#777;margin:0">Ce lien est personnel et expire le ${new Date(invitation.expires_at).toLocaleDateString('fr-FR')}.</p>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MAIL_FROM,
      // L'invitation part au nom de la box : une réponse doit lui arriver,
      // pas à une boîte technique que personne ne relève.
      ...(box?.contact_email ? { reply_to: box.contact_email } : {}),
      to: invitation.email,
      subject: `${boxName} t'invite à rejoindre AthleX`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { sent: false, error: `Resend ${res.status} — ${detail.slice(0, 200)}` },
      { status: 200 },
    );
  }

  return NextResponse.json({ sent: true, to: invitation.email });
}
