import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/supabase/server';
import { clientIp, takeToken } from '@/lib/trialRateLimit';

/**
 * Création d'une box — trois intentions, chacune nommée par `mode`.
 *
 *   `check`            → l'e-mail a-t-il déjà un compte ? Rien n'est écrit.
 *   `signup` (défaut)  → compte NEUF + box. Un e-mail déjà connu est refusé
 *                        en 409 : la route ne se connecte plus à sa place.
 *   `existing_account` → box pour un compte connecté (cookie de session), sans
 *                        e-mail ni mot de passe dans le corps. C'est l'écran
 *                        « Créer ma box » de l'espace athlète, et le seul chemin
 *                        par lequel un athlète existant devient gérant.
 *
 * Pourquoi (issue #342). L'ancienne route, en `signup`, acceptait un e-mail
 * déjà connu : si le mot de passe était bon elle se connectait, constatait que
 * le compte n'avait pas de box, en créait une, et basculait le profil en
 * gérant. Un athlète est devenu gérant sans l'avoir demandé. La garde « ce
 * compte existe déjà » ne se déclenchait que sur mot de passe FAUX : elle
 * protégeait de l'usurpation, pas de ça.
 *
 * L'intention de `existing_account` n'est pas un drapeau qu'un appelant
 * pourrait poser : elle est portée par une session vérifiée côté serveur.
 */

const MSG_COMPTE_EXISTANT =
  'Un compte existe déjà avec cet e-mail. Connecte-toi, puis crée ta box depuis ton compte.';

// service_role client — used for ALL privileged DB writes. Never call
// signInWithPassword on it: doing so swaps its Authorization to the user's
// token, so subsequent writes run as `authenticated` and hit the RLS/trigger
// lock that reserves box/owner provisioning to the backend.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Extrait des coordonnées d'un lien Google Maps (le plus fiable : pin exact).
function parseLatLngFromGoogleMapsUrl(url: string | null | undefined): { latitude: number; longitude: number } | null {
  if (!url) return null;
  let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  m = url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  return null;
}

// Géocode une adresse via Nominatim (OpenStreetMap, gratuit, sans clé API).
async function geocodeAddress(address: string): Promise<{
  latitude: number; longitude: number; city: string | null;
  postal_code: string | null; country: string | null;
} | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=fr&limit=1&q=' +
      encodeURIComponent(address);
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'fr', 'User-Agent': 'AthleX/1.0 (box-geocoding)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    const vague = ['country', 'state', 'region', 'county', 'administrative'];
    if (hit.addresstype && vague.includes(hit.addresstype)) return null;
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    const a = hit.address ?? {};
    return {
      latitude: lat,
      longitude: lon,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
      postal_code: a.postcode ?? null,
      country: a.country ?? null,
    };
  } catch {
    return null;
  }
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

interface BoxFields {
  box_name: string;
  box_address?: string | null;
  box_website?: string | null;
  box_contact_email?: string | null;
  box_phone?: string | null;
  box_google_maps?: string | null;
  box_founded_at?: string | null;
}

/** L'e-mail a-t-il déjà un compte ? `profiles.email` suit `auth.users` (0 divergent / 187 en prod). */
async function emailHasAccount(supabase: Admin, email: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email.trim())
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Une box déjà possédée : on renvoie vers elle, on n'en crée pas une deuxième. */
async function ownedBoxId(supabase: Admin, userId: string): Promise<string | null> {
  const { data } = await supabase.from('boxes').select('id').eq('owner_id', userId).limit(1).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Crée la box, son code d'invitation, son essai, et bascule le profil en
 * gérant. Commun aux deux intentions qui créent : compte neuf, compte connecté.
 */
async function createBoxFor(supabase: Admin, userId: string, f: BoxFields) {
  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data } = await supabase.from('boxes').select('id').eq('invite_code', inviteCode).maybeSingle();
    if (!data) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  const trimmedAddress = f.box_address?.trim() || null;
  const trimmedMaps = f.box_google_maps?.trim() || null;
  const coordsFromUrl = parseLatLngFromGoogleMapsUrl(trimmedMaps);
  let geo: Awaited<ReturnType<typeof geocodeAddress>> = null;
  if (!coordsFromUrl && trimmedAddress) geo = await geocodeAddress(trimmedAddress);

  const { data: box, error: boxError } = await supabase.from('boxes').insert({
    owner_id: userId,
    name: f.box_name.trim(),
    invite_code: inviteCode,
    is_active: true,
    address: trimmedAddress,
    website_url: f.box_website?.trim() || null,
    contact_email: f.box_contact_email?.trim() || null,
    phone: f.box_phone?.trim() || null,
    google_maps_url: trimmedMaps,
    founded_at: f.box_founded_at || null,
    latitude: coordsFromUrl?.latitude ?? geo?.latitude ?? null,
    longitude: coordsFromUrl?.longitude ?? geo?.longitude ?? null,
    city: geo?.city ?? null,
    postal_code: geo?.postal_code ?? null,
    country: geo?.country ?? null,
  } as any).select().single();

  if (boxError || !box) {
    return NextResponse.json({ error: boxError?.message ?? 'Erreur création box' }, { status: 500 });
  }

  // Le rôle suit la box, jamais l'inverse : il n'est écrit qu'ici, après l'insert.
  await supabase.from('profiles').update({ role: 'box_owner' }).eq('id', userId);

  let isEarlyAdopter = false;
  try {
    const { data: countData } = await supabase.rpc('get_total_box_count');
    isEarlyAdopter = (Number(countData) || 0) <= 5;
  } catch (_) { /* ignore */ }

  const trialDays = isEarlyAdopter ? 30 : 14;
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('box_subscriptions').insert({
    box_id: box.id,
    plan_tier: 'trial',
    status: 'trialing',
    trial_ends_at: trialEndsAt,
    is_early_adopter: isEarlyAdopter,
  });

  return NextResponse.json({
    box_id: box.id,
    invite_code: inviteCode,
    is_early_adopter: isEarlyAdopter,
    trial_days: trialDays,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, mode } = body;
    const supabase = getSupabaseAdmin();

    // ── check : existence d'un compte, sans rien écrire ──────────────────────
    // L'existence se déduisait déjà du 409 de l'inscription ; ce mode la rend
    // lisible à la première étape, et le débit est borné par IP.
    if (mode === 'check') {
      const verdict = takeToken('create-box-check', clientIp(req.headers), 20, 10 * 60 * 1000);
      if (!verdict.allowed) {
        return NextResponse.json({ error: 'Trop de tentatives, réessaie dans quelques minutes.' },
          { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } });
      }
      if (typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'E-mail requis' }, { status: 400 });
      }
      return NextResponse.json({ exists: await emailHasAccount(supabase, email) });
    }

    // ── existing_account : un compte connecté crée sa box ────────────────────
    if (mode === 'existing_account') {
      const user = await getServerUser();
      if (!user) return NextResponse.json({ error: 'Connecte-toi pour créer ta box.' }, { status: 401 });
      if (!body.box_name?.trim()) return NextResponse.json({ error: 'Nom de la box requis' }, { status: 400 });

      const existing = await ownedBoxId(supabase, user.id);
      if (existing) return NextResponse.json({ box_id: existing, already_exists: true });
      return createBoxFor(supabase, user.id, body);
    }

    // ── login : ne crée plus rien ────────────────────────────────────────────
    // L'ancien mode connectait un compte existant puis lui créait une box. Le
    // seul chemin pour un compte existant est désormais l'écran « Créer ma
    // box » de l'espace athlète, session ouverte.
    if (mode === 'login') {
      return NextResponse.json({ error: MSG_COMPTE_EXISTANT, account_exists: true }, { status: 409 });
    }

    // ── signup : compte neuf + box ───────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }
    if (!body.box_name?.trim()) {
      return NextResponse.json({ error: 'Nom de la box requis' }, { status: 400 });
    }

    // Refus AVANT toute création : un e-mail connu ne passe plus par la
    // connexion. Le même contrôle qu'à la première étape du tunnel, refait
    // ici parce qu'un écran n'est pas une garde.
    if (await emailHasAccount(supabase, email)) {
      return NextResponse.json({ error: MSG_COMPTE_EXISTANT, account_exists: true }, { status: 409 });
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: body.box_name.trim() },
    });
    if (signUpError || !signUpData?.user) {
      const msg = signUpError?.message ?? 'Erreur création compte';
      // Compte auth sans profil (cas limite) : même refus, jamais de repli.
      const alreadyExists = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists');
      return NextResponse.json(
        { error: alreadyExists ? MSG_COMPTE_EXISTANT : msg, account_exists: alreadyExists || undefined },
        { status: alreadyExists ? 409 : 400 },
      );
    }
    const userId = signUpData.user.id;

    // Wait briefly for any auth trigger to create profile
    await new Promise(r => setTimeout(r, 500));

    // Ensure profile exists (trigger may or may not have created it)
    const username = email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6);
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      username,
      full_name: body.box_name.trim(),
      role: 'box_owner',
    }, { onConflict: 'id' });
    if (profileErr) console.error('Profile upsert error:', profileErr);

    let profileReady = false;
    for (let i = 0; i < 5; i++) {
      const { data: check } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (check) { profileReady = true; break; }
      await new Promise(r => setTimeout(r, 300));
    }
    if (!profileReady) {
      return NextResponse.json({ error: 'Erreur création profil. Réessayez.' }, { status: 500 });
    }

    return createBoxFor(supabase, userId, body);
  } catch (err: any) {
    console.error('create-box error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
