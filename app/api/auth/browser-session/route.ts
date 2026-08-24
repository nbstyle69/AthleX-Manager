import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Rend à l'onglet la session que le middleware vient de valider, pour que le
 * client navigateur Supabase la reprenne (`setSession`).
 *
 * Le back-office porte deux sessions : celle du serveur (`sb-access-token`,
 * posée par `/api/auth/set-session`) et celle du navigateur (écrite par
 * `createBrowserClient`). Toutes les pages client lisent par la seconde. Quand
 * elle disparaît — rafraîchissement en échec, session révoquée ailleurs, cookie
 * effacé — le middleware laisse quand même entrer, et ces pages rendent des
 * listes vides sans erreur : « Aucune box active » sur une box qui existe.
 *
 * L'exposition est celle qui existe déjà : la session du navigateur est écrite
 * dans un cookie lisible par le JS de la page (c'est ainsi que `@supabase/ssr`
 * la conserve). On ne rend que la session de l'appelant, sur son origine.
 */
export async function GET() {
  const store = await cookies();
  const access_token = store.get('sb-access-token')?.value;
  const refresh_token = store.get('sb-refresh-token')?.value;

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { ok: false, error: 'Aucune session serveur' },
      { status: 401, headers: NO_STORE },
    );
  }

  return NextResponse.json({ ok: true, access_token, refresh_token }, { headers: NO_STORE });
}
