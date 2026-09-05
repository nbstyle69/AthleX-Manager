import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, getAccessToken } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site-url';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = `Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${IS_PROD ? '; Secure' : ''}`;

/** Messages des refus renvoyés par les RPC du lot 1. */
const REFUS: Record<string, string> = {
  token_absent: 'Lien d’invitation incomplet.',
  invitation_introuvable: 'Ce lien d’invitation n’existe pas.',
  invitation_revoquee: 'Cette invitation a été annulée par la box.',
  invitation_deja_utilisee: 'Cette invitation a déjà été utilisée.',
  invitation_expiree: 'Cette invitation a expiré.',
  email_non_correspondant: 'Cette invitation est nominative : elle ne peut être utilisée qu’avec l’adresse invitée.',
  membre_exclu: 'Ton accès à cette box a été suspendu. Rapproche-toi de la box.',
};

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

/**
 * Acceptation d'une invitation nominative.
 *
 * Deux chemins, une seule autorité : les RPC du lot 1. Cette route ne décide
 * jamais d'un rattachement — elle crée le compte puis laisse le SQL trancher
 * (jeton valide ? e-mail correspondant ? box lue dans l'invitation).
 *
 * L'e-mail du compte n'est JAMAIS celui du corps de la requête : il est relu
 * dans l'invitation via `peek_box_invitation`. Sans ça, n'importe qui pourrait
 * poster un lien valide avec sa propre adresse.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  const mode = body?.mode === 'existing' ? 'existing' : 'signup';

  if (!token) {
    return NextResponse.json({ ok: false, error: REFUS.token_absent }, { status: 400 });
  }

  const service = createServiceClient();

  // ── Chemin « déjà connecté » : la consommation part de la session, la route
  // ne nomme personne. Si le compte ne porte pas l'adresse invitée, la RPC
  // refuse.
  if (mode === 'existing') {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, { status: 401 });
    }
    const asUser = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data, error } = await asUser.rpc('consume_box_invitation', { p_token: token });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const result = data as { ok: boolean; reason?: string };
    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: REFUS[result?.reason ?? ''] ?? 'Invitation refusée.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── Chemin « création de compte » ─────────────────────────────────────────
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const gender = body?.gender === 'male' || body?.gender === 'female' ? body.gender : null;

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Pseudo et mot de passe sont requis.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 });
  }

  // L'adresse vient de l'invitation, pas du navigateur.
  const { data: peekData, error: peekError } = await service.rpc('peek_box_invitation', { p_token: token });
  if (peekError) {
    return NextResponse.json({ ok: false, error: peekError.message }, { status: 400 });
  }
  const peek = peekData as { ok: boolean; reason?: string; email?: string };
  if (!peek?.ok || !peek.email) {
    return NextResponse.json(
      { ok: false, error: REFUS[peek?.reason ?? ''] ?? 'Invitation refusée.' },
      { status: 400 },
    );
  }
  const email = peek.email;

  const finalUsername = await resolveUsername(service, username);
  if (!finalUsername) {
    return NextResponse.json(
      { ok: false, error: 'Impossible de générer un pseudo libre. Réessaie avec un autre pseudo.' },
      { status: 409 },
    );
  }

  const anon = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password,
    options: {
      data: { username: finalUsername, level: 'inter', gender },
      emailRedirectTo: `${SITE_URL}/email-confirme`,
    },
  });
  if (signUpError) {
    const emailTaken = /already registered|already been registered|user already exists/i.test(signUpError.message);
    return NextResponse.json(
      {
        ok: false,
        error: emailTaken
          ? 'Un compte existe déjà avec cet e-mail. Connecte-toi, puis rouvre ce lien pour rejoindre la box.'
          : signUpError.message,
      },
      { status: emailTaken ? 409 : 400 },
    );
  }
  const user = signUpData.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Compte non créé.' }, { status: 400 });
  }

  // Filet idempotent : le trigger handle_new_user pose déjà le profil, cet
  // upsert ne fait rien s'il existe. Il doit précéder la consommation, qui
  // compare l'e-mail du profil à celui de l'invitation.
  const referral_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error: profileError } = await service.from('profiles').upsert({
    id: user.id,
    email,
    username: finalUsername,
    level: 'inter',
    role: 'member',
    gender,
    elo: 1000,
    total_matches: 0,
    wins: 0,
    losses: 0,
    referral_code,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (profileError) {
    return NextResponse.json({ ok: false, error: `Profil: ${profileError.message}` }, { status: 500 });
  }

  // Rattachement. La variante service_role est utilisée parce que le compte
  // vient d'être créé : selon la configuration de confirmation d'e-mail,
  // `signUp` peut ne renvoyer aucune session. Les gardes restent celles du
  // lot 1 — c'est la même fonction interne.
  const { data: consumeData, error: consumeError } = await service.rpc('consume_box_invitation_for', {
    p_token: token,
    p_user_id: user.id,
  });
  if (consumeError) {
    return NextResponse.json({ ok: false, error: consumeError.message }, { status: 500 });
  }
  const consumed = consumeData as { ok: boolean; reason?: string };
  if (!consumed?.ok) {
    // Le compte existe, mais le rattachement a échoué : on le dit plutôt que de
    // laisser croire à une adhésion.
    return NextResponse.json(
      {
        ok: false,
        error: `${REFUS[consumed?.reason ?? ''] ?? 'Invitation refusée.'} Ton compte AthleX a bien été créé.`,
      },
      { status: 400 },
    );
  }

  const { data: created } = await service
    .from('profiles').select('username').eq('id', user.id).maybeSingle();
  const storedUsername = (created as { username: string } | null)?.username ?? finalUsername;

  const response = NextResponse.json({
    ok: true,
    finalUsername: storedUsername,
    pseudoChanged: storedUsername !== username,
    needsConfirmation: !signUpData.session,
  });
  if (signUpData.session) {
    response.headers.append('Set-Cookie', `sb-access-token=${signUpData.session.access_token}; ${COOKIE_OPTS}`);
    response.headers.append('Set-Cookie', `sb-refresh-token=${signUpData.session.refresh_token}; ${COOKIE_OPTS}`);
  }
  return response;
}
