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
  // Le pseudo/niveau/genre partent en MÉTADONNÉE : le trigger serveur
  // handle_new_user (Phase 0-A) crée le profil à partir de ces champs.
  const { data, error } = await anon.auth.signUp({
    email: cleanEmail,
    password,
    options: { data: { username: finalUsername, level: 'inter', gender: gender || null } },
  });
  if (error) {
    // Seul conflit encore possible ici : l'e-mail. L'unicité du pseudo est
    // arbitrée par la pré-résolution puis par le suffixe du trigger.
    const emailTaken = /already registered|already been registered|user already exists/i.test(error.message);
    return NextResponse.json(
      { ok: false, error: emailTaken ? 'Un compte existe déjà avec cet e-mail. Connecte-toi.' : error.message },
      { status: emailTaken ? 409 : 400 },
    );
  }
  const user = data.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Compte non créé.' }, { status: 400 });
  }

  // Le profil est créé serveur par le trigger. Filet idempotent avec le client
  // service (bypass RLS, fonctionne avant confirmation d'e-mail) : no-op si la
  // ligne existe déjà — plus de 23505 sur l'id.
  const referral_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error: profileError } = await service.from('profiles').upsert({
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
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (profileError) {
    return NextResponse.json({ ok: false, error: `Profil: ${profileError.message}` }, { status: 500 });
  }

  // Welcome badge (best-effort).
  await service.from('athlete_badges')
    .insert({ athlete_id: user.id, badge_key: 'level_scaled' })
    .then(undefined, () => {});

  // Le pseudo posé en base fait foi : sur une course entre deux inscriptions,
  // c'est le trigger qui tranche en suffixant.
  const { data: created } = await service
    .from('profiles').select('username').eq('id', user.id).maybeSingle();
  const storedUsername = created?.username ?? finalUsername;
  const pseudoChanged = storedUsername !== cleanUsername;

  // If email confirmation is disabled, signUp returns a session -> log the user in.
  if (data.session) {
    const response = NextResponse.json({ ok: true, needsConfirmation: false, finalUsername: storedUsername, pseudoChanged });
    response.headers.append('Set-Cookie', `sb-access-token=${data.session.access_token}; ${COOKIE_OPTS}`);
    response.headers.append('Set-Cookie', `sb-refresh-token=${data.session.refresh_token}; ${COOKIE_OPTS}`);
    return response;
  }

  return NextResponse.json({ ok: true, needsConfirmation: true, finalUsername: storedUsername, pseudoChanged });
}
