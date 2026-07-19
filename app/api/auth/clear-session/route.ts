import { NextResponse } from 'next/server';

const EXPIRE = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', `sb-access-token=; ${EXPIRE}`);
  response.headers.append('Set-Cookie', `sb-refresh-token=; ${EXPIRE}`);
  return response;
}
