import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isConfirmType,
  recoveryErrorFrom,
  safeNext,
  type RecoveryError,
} from '@/lib/auth/recovery';

/**
 * Atterrissage des liens d'e-mail Supabase, vérifiés côté serveur.
 *
 * Le lien porte un `token_hash` et son `type` : `verifyOtp` ouvre la session
 * ici, dans les cookies de la réponse, puis renvoie vers `next`. Rien ne
 * dépend du navigateur d'origine, donc un lien ouvert depuis un webmail ou un
 * téléphone fonctionne — c'est ce que le flux PKCE ne pouvait pas faire, son
 * `code_verifier` ne vivant que dans l'onglet qui a demandé le lien.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_MAX_AGE = 28800;

function failure(request: NextRequest, next: string, error: RecoveryError) {
  const url = new URL(next, request.url);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const here = new URL(request.url);
  const params = here.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  // L'origine acceptée est celle qui sert la route : le domaine public en
  // production, l'URL de preview quand le lien est testé sur une preview.
  const next = safeNext(params.get('next'), here.origin);

  if (!tokenHash || !isConfirmType(type)) {
    return failure(request, next, 'incomplete');
  }

  const store = await cookies();
  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (key: string) => store.get(key)?.value,
      set: (key: string, value: string, options: CookieOptions) => {
        response.cookies.set({ name: key, value, ...options });
      },
      remove: (key: string, options: CookieOptions) => {
        response.cookies.set({ name: key, value: '', ...options });
      },
    },
  });

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data?.session) {
    return failure(request, next, recoveryErrorFrom(error?.message));
  }

  // Le back-office porte une seconde session, la sienne : `sb-access-token` est
  // ce que lisent le middleware et les lectures serveur. Sans elle, la page de
  // mot de passe serait renvoyée vers /login juste après une vérification
  // réussie.
  for (const [name, value] of [
    ['sb-access-token', data.session.access_token],
    ['sb-refresh-token', data.session.refresh_token],
  ] as const) {
    response.cookies.set({
      name,
      value,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: SESSION_MAX_AGE,
    });
  }

  return response;
}
