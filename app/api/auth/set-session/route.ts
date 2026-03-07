import { NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTS = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800';

export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json();

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: 'Tokens manquants' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', `sb-access-token=${access_token}; ${COOKIE_OPTS}`);
  response.headers.append('Set-Cookie', `sb-refresh-token=${refresh_token}; ${COOKIE_OPTS}`);
  return response;
}
