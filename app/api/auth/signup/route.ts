import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = `Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${IS_PROD ? '; Secure' : ''}`;

async function resolveUsername(service: ReturnType<typeof createServiceClient>, requested: string) {
  const base = requested.trim();
  const { data: existing } = await service
    .from('profiles').select('id').ilike('username', base).maybeSingle();
  if (!existing) return base;
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}${Math.floor(100 + Math.random() * 9900)}`;
    const { data: clash } = await service
      .from('profiles').select('id').ilike('username', candidate).maybeSingle();
    if (!clash) return candidate;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { email, password, username, gender } = await request.json();

  const cleanEmail = (email ?? '').trim();
  const cleanUsername = (username ?? '').trim();
  if (!cleanEmail || !password || !cleanUsername) {
    return NextResponse.json({ ok: false, error: 'Tous les champs sont requis.' }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 });
  }
  if (gender && gender !== 'male' && gender !== 'female') {
    return NextResponse.json({ ok: false, error: 'Genre invalide.' }, { status: 400 });
  }

  const service = createServiceClient();

  const finalUsername = await resolveUsername(service, cleanUsername);
  if (!finalUsername) {
    return NextResponse.json({ ok: false, error: 'Impossible de générer un pseudo libre. Réessaie avec un autre pseudo.' }, { status: 409 });
  }

  // Create the auth user via anon signUp so Supabase can send the confirmation email.
  const anon = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.auth.signUp({ email: cleanEmail, password });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  const user = data.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Compte non créé.' }, { status: 400 });
  }

  // Insert the profile with the service client (bypasses RLS; works even before email confirmation).
  const referral_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error: profileError } = await service.from('profiles').insert({
    id: user.id,
    email: cleanEmail,
    username: finalUsername,
    level: 'inter',
    role: 'member',
    gender: gender || null,
    elo: 1000,
    total_matches: 0,
    wins: 0,
    losses: 0,
    referral_code,
  });
  if (profileError) {
    if (profileError.code === '23505' || /duplicate key/i.test(profileError.message)) {
      return NextResponse.json({ ok: false, error: 'Ce pseudo ou cet e-mail est déjà utilisé.' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: `Profil: ${profileError.message}` }, { status: 500 });
  }

  // Welcome badge (best-effort).
  await service.from('athlete_badges')
    .insert({ athlete_id: user.id, badge_key: 'level_scaled' })
    .then(undefined, () => {});

  const pseudoChanged = finalUsername !== cleanUsername;

  // If email confirmation is disabled, signUp returns a session -> log the user in.
  if (data.session) {
    const response = NextResponse.json({ ok: true, needsConfirmation: false, finalUsername, pseudoChanged });
    response.headers.append('Set-Cookie', `sb-access-token=${data.session.access_token}; ${COOKIE_OPTS}`);
    response.headers.append('Set-Cookie', `sb-refresh-token=${data.session.refresh_token}; ${COOKIE_OPTS}`);
    return response;
  }

  return NextResponse.json({ ok: true, needsConfirmation: true, finalUsername, pseudoChanged });
}
