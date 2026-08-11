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

  if (pathname.startsWith('/api/') || pathname.startsWith('/landing') || pathname.startsWith('/signup') || pathname.startsWith('/reset-password') || pathname.startsWith('/update-password') || pathname.startsWith('/rejoindre/') || pathname.startsWith('/classement') || pathname.startsWith('/privacy') || pathname === '/box' || pathname.startsWith('/box/') || pathname.startsWith('/pricing') || pathname.startsWith('/.well-known')) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('sb-access-token')?.value;
  const tokenOk = accessToken ? isTokenValid(accessToken) : false;

  // Always allow /login (and its athlete/box sub-routes) to render — never
  // redirect from them in middleware (prevents loop when token looks valid
  // locally but is revoked on Supabase)
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    const res = NextResponse.next();
    if (!tokenOk && accessToken) {
      res.cookies.delete('sb-access-token');
      res.cookies.delete('sb-refresh-token');
    }
    return res;
  }

  if (!tokenOk) {
    // Unauthenticated visitors landing on the root see the public landing page,
    // not the owner login. Everything else stays gated behind /login.
    const target = pathname === '/' ? '/landing' : '/login';
    const res = NextResponse.redirect(new URL(target, request.url));
    res.cookies.delete('sb-access-token');
    res.cookies.delete('sb-refresh-token');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)'],
};
