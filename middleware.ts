import { NextResponse, type NextRequest } from 'next/server';

function isTokenValid(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    // base64url → base64
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      part.length + (4 - (part.length % 4)) % 4, '='
    );
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') || pathname.startsWith('/test-login')) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('sb-access-token')?.value;
  const tokenOk = accessToken ? isTokenValid(accessToken) : false;

  if (!tokenOk) {
    // Clear stale cookies to prevent redirect loop
    if (pathname === '/login') {
      const res = NextResponse.next();
      if (accessToken) {
        res.cookies.delete('sb-access-token');
        res.cookies.delete('sb-refresh-token');
      }
      return res;
    }
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete('sb-access-token');
    res.cookies.delete('sb-refresh-token');
    return res;
  }

  // Valid token — redirect away from login
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
