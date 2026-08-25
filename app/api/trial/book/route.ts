import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientIp, takeToken } from '@/lib/trialRateLimit';
import { MAIL_FROM, SITE_URL } from '@/lib/site-url';

interface BookOk {
  ok: true;
  prospect_id: string;
  reservation_id: string;
  plan: { id: string; name: string };
  slot: {
    schedule_id: string;
    title: string;
    scheduled_date: string;
    start_time: string;
    end_time: string | null;
  };
}
interface BookRefused {
  ok: false;
  reason: string;
}

/**
 * Réservation d'une séance d'essai par un visiteur sans compte.
 *
 * Cette route ne décide rien : elle transmet à `book_trial_slot()`, qui
 * vérifie la box, le créneau, l'offre Essai, la gratuité, le doublon, les
 * plafonds par e-mail et la capacité — sous le même verrou que le trigger — et
 * qui relit le statut réellement écrit. Une écriture publique ne se fait pas
 * avec la clé de service : on garde la clé publique, donc les gardes de la RPC
 * sont les seules gardes, et elles sont mesurées.
 *
 * Ce que la route ajoute, et que la base ne peut pas voir : le plafond par
 * adresse IP (`x-forwarded-for`).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  // 3 réservations par heure et par IP : une famille sur le même Wi-Fi passe,
  // une rafale non.
  const verdict = takeToken('trial-book', ip, 3, 60 * 60 * 1000);
  if (!verdict.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'trop_de_tentatives' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const boxId = str(body?.box_id);
  const scheduleId = str(body?.schedule_id);
  const firstName = str(body?.first_name);
  const lastName = str(body?.last_name);
  const email = str(body?.email);
  const phone = str(body?.phone);

  if (!boxId || !scheduleId) {
    return NextResponse.json({ ok: false, reason: 'creneau_introuvable' }, { status: 400 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { data, error } = await supabase.rpc('book_trial_slot', {
    p_box_id: boxId,
    p_schedule_id: scheduleId,
    p_first_name: firstName,
    p_last_name: lastName || null,
    p_email: email,
    p_phone: phone || null,
  });

  // La cause technique reste au serveur : le visiteur lit un refus nommé, pas
  // un message de base de données.
  if (error) {
    console.error('book_trial_slot', error.message);
    return NextResponse.json({ ok: false, reason: 'reservation_impossible' }, { status: 502 });
  }

  const result = data as BookOk | BookRefused | null;
  if (!result?.ok) {
    return NextResponse.json(result ?? { ok: false, reason: 'reservation_impossible' });
  }

  const { data: boxRow } = await supabase
    .from('boxes')
    .select('name, slug, address, city, contact_email')
    .eq('id', boxId)
    .eq('is_active', true)
    .maybeSingle();

  const mail = await sendConfirmation({
    to: email,
    firstName,
    box: boxRow ?? null,
    slot: result.slot,
    planName: result.plan.name,
  });

  // Le mail est un plus, pas la réservation. Son échec est dit, il n'annule
  // rien — la place est prise, et le prospect est dans le pipeline.
  return NextResponse.json({ ...result, email_sent: mail.sent, email_error: mail.error });
}

interface BoxLite {
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  contact_email: string | null;
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

async function sendConfirmation(args: {
  to: string;
  firstName: string;
  box: BoxLite | null;
  slot: BookOk['slot'];
  planName: string;
}): Promise<{ sent: boolean; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY absente' };

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const boxName = args.box?.name ?? 'ta box';
  const when = `${frDate(args.slot.scheduled_date)} à ${args.slot.start_time.slice(0, 5)}`;
  const place = [args.box?.address, args.box?.city].filter(Boolean).join(', ');
  const boxLink = args.box?.slug ? `${SITE_URL}/box/${args.box.slug}` : SITE_URL;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 24px">
    <tr><td>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">Ta séance d'essai chez ${esc(boxName)} est réservée</h1>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 8px">Salut ${esc(args.firstName)},</p>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 16px">
        Ta place est prise pour <strong style="color:#fff">${esc(args.slot.title)}</strong>, ${esc(when)}.
      </p>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 8px">Offre : <strong style="color:#fff">${esc(args.planName)}</strong> — gratuite.</p>
      ${place ? `<p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 16px">Adresse : ${esc(place)}</p>` : ''}
      <p style="margin:0 0 24px"><a href="${boxLink}" style="display:inline-block;background:#fff;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 22px;border-radius:12px">Voir ${esc(boxName)}</a></p>
      <p style="font-size:12px;color:#777;margin:0">Un empêchement ? Réponds à ce message, la box te répondra directement.</p>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MAIL_FROM,
      ...(args.box?.contact_email ? { reply_to: args.box.contact_email } : {}),
      to: args.to,
      subject: `Séance d'essai réservée — ${boxName}`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { sent: false, error: `Resend ${res.status} — ${detail.slice(0, 200)}` };
  }
  return { sent: true, error: null };
}
