import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: NextRequest) {
  try {
    const {
      email, password, box_name, mode,
      box_address, box_website, box_contact_email,
      box_phone, box_google_maps, box_founded_at,
    } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }
    if (!box_name?.trim()) {
      return NextResponse.json({ error: 'Nom de la box requis' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let userId: string;

    if (mode === 'login') {
      // ── Login existing user ──
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message ?? 'Identifiants incorrects' }, { status: 401 });
      }
      userId = authData.user.id;

      // Check if already has a box
      const { data: existingBoxes } = await supabase
        .from('boxes')
        .select('id')
        .eq('owner_id', userId);
      if (existingBoxes && existingBoxes.length > 0) {
        return NextResponse.json({
          box_id: existingBoxes[0].id,
          already_exists: true,
        });
      }
    } else {
      // ── Sign up new user ──
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: box_name.trim() },
      });

      if (signUpError || !signUpData?.user) {
        const msg = signUpError?.message ?? 'Erreur création compte';
        const alreadyExists = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists');

        if (alreadyExists) {
          // Auto-fallback: try login with provided credentials
          const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (loginErr || !loginData.user) {
            return NextResponse.json({
              error: 'Ce compte existe déjà mais le mot de passe est incorrect. Utilisez "Se connecter" avec le bon mot de passe.',
            }, { status: 409 });
          }
          userId = loginData.user.id;

          // Check if already has a box
          const { data: existingBoxes } = await supabase
            .from('boxes')
            .select('id')
            .eq('owner_id', userId);
          if (existingBoxes && existingBoxes.length > 0) {
            return NextResponse.json({
              box_id: existingBoxes[0].id,
              already_exists: true,
            });
          }
        } else {
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      } else {
        userId = signUpData.user.id;

        // Wait briefly for any auth trigger to create profile
        await new Promise(r => setTimeout(r, 500));

        // Ensure profile exists (trigger may or may not have created it)
        const username = email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6);
        const { error: profileErr } = await supabase.from('profiles').upsert({
          id: userId,
          email,
          username,
          full_name: box_name.trim(),
          role: 'box_owner',
        }, { onConflict: 'id' });

        if (profileErr) {
          console.error('Profile upsert error:', profileErr);
        }
      }

      // Verify profile exists before proceeding
      let profileReady = false;
      for (let i = 0; i < 5; i++) {
        const { data: check } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (check) { profileReady = true; break; }
        await new Promise(r => setTimeout(r, 300));
      }
      if (!profileReady) {
        return NextResponse.json({ error: 'Erreur création profil. Réessayez.' }, { status: 500 });
      }
    }

    // ── Generate unique invite code ──
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data } = await supabase.from('boxes').select('id').eq('invite_code', inviteCode).maybeSingle();
      if (!data) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // ── Coordonnées (priorité au lien Google Maps, sinon géocodage adresse) ──
    const trimmedAddress = box_address?.trim() || null;
    const trimmedMaps = box_google_maps?.trim() || null;
    const coordsFromUrl = parseLatLngFromGoogleMapsUrl(trimmedMaps);
    let geo: Awaited<ReturnType<typeof geocodeAddress>> = null;
    if (!coordsFromUrl && trimmedAddress) {
      geo = await geocodeAddress(trimmedAddress);
    }
    const latitude = coordsFromUrl?.latitude ?? geo?.latitude ?? null;
    const longitude = coordsFromUrl?.longitude ?? geo?.longitude ?? null;

    // ── Create box ──
    const { data: box, error: boxError } = await supabase.from('boxes').insert({
      owner_id: userId,
      name: box_name.trim(),
      invite_code: inviteCode,
      is_active: true,
      address: trimmedAddress,
      website_url: box_website?.trim() || null,
      contact_email: box_contact_email?.trim() || null,
      phone: box_phone?.trim() || null,
      google_maps_url: trimmedMaps,
      founded_at: box_founded_at || null,
      latitude,
      longitude,
      city: geo?.city ?? null,
      postal_code: geo?.postal_code ?? null,
      country: geo?.country ?? null,
    } as any).select().single();

    if (boxError || !box) {
      return NextResponse.json({ error: boxError?.message ?? 'Erreur création box' }, { status: 500 });
    }

    // Update profile role
    await supabase.from('profiles').update({ role: 'box_owner' }).eq('id', userId);

    // ── Early adopter check ──
    let isEarlyAdopter = false;
    try {
      const { data: countData } = await (supabase.rpc as any)('get_total_box_count');
      isEarlyAdopter = (Number(countData) || 0) <= 5;
    } catch (_) { /* ignore */ }

    const trialDays = isEarlyAdopter ? 60 : 30;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    // ── Create trial subscription ──
    await (supabase.from as any)('box_subscriptions').insert({
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
  } catch (err: any) {
    console.error('create-box error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
