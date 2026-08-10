import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { exceedsBodyLimit, shouldRejectCsrf } from '@/lib/security/request-guards';

/**
 * Middleware for authentication — validates Auth.js JWT.
 * Edge-compatible: uses next-auth/jwt getToken instead of auth().
 *
 * NOTA sobre OpenNext/Workers:
 *   process.env é populado por populateProcessEnv() a cada request,
 *   NÃO em module-init. Portanto, qualquer leitura de env var DEVE
 *   ser feita dentro da função middleware, não no module scope.
 */
const PUBLIC_EXACT = new Set(['/','/login','/signup','/pi-finance','/api/health','/api/whatsapp/evolution']);
const PUBLIC_PREFIXES = ['/api/auth/', '/api/financeiro/webhooks/', '/api/whatsapp/evolution/'] as const;
const SIGNED_TRANSPORT = /^\/api\/(messages\/inbound|cron\/|agent\/)/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  if (exceedsBodyLimit(request)) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }
  const isNextAuthRoute = request.nextUrl.pathname.startsWith('/api/auth/');
  if (!isNextAuthRoute && shouldRejectCsrf(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const pathname = request.nextUrl.pathname;
  const AUTH_SECRET = process.env.AUTH_SECRET;

  // Dev bypass: skip auth when AUTH_SECRET is missing OR mock mode is active
  if (
    process.env.NODE_ENV === 'development' &&
    (!AUTH_SECRET || process.env.NEXT_PUBLIC_USE_MOCKS === 'true')
  ) {
    return NextResponse.next({ request });
  }

  // Decode and verify the session JWT from request cookies
  const token = await getToken({
    req: request,
    secret: AUTH_SECRET,
  });

  const transportAuth = SIGNED_TRANSPORT.test(pathname) ||
    (process.env.NODE_ENV === 'development' && pathname === '/api/seed');
  const routeIsPublic = isPublicPath(pathname) || transportAuth;

  // If no session and trying to access protected route
  if (!token && !routeIsPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // If logged in and trying to access login page, redirect to dashboard
  if (token && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
