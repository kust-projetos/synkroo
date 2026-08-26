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
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/signup',
  '/pi-finance',
  '/api/health',
  '/api/health/db',
  '/api/internal/readiness',
  '/api/whatsapp/evolution',
  '/api/auth/providers',
  '/api/auth/csrf',
  '/api/auth/session',
  '/api/auth/signin',
  '/api/auth/error',
  '/api/auth/signup',
  '/api/financeiro/webhooks/asaas',
]);
const PUBLIC_PREFIXES = ['/api/auth/callback/'] as const;
const CUSTOM_AUTH_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/signup',
  '/api/auth/switch-clinic',
]);
const SIGNED_TRANSPORT = /^\/api\/(messages\/inbound|cron\/|agent\/)/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  if (exceedsBodyLimit(request)) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }
  const isNextAuthRoute = request.nextUrl.pathname.startsWith('/api/auth/') && !CUSTOM_AUTH_ROUTES.has(request.nextUrl.pathname);
  if (!isNextAuthRoute && shouldRejectCsrf(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const pathname = request.nextUrl.pathname;
  if (
    process.env.NODE_ENV === 'production' &&
    (pathname === '/signup' || pathname === '/api/auth/signup')
  ) {
    return new NextResponse(null, { status: 404 });
  }
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

  // The seed route validates SEED_SECRET itself; middleware must let E2E production setup reach that guard.
  const transportAuth = SIGNED_TRANSPORT.test(pathname) || pathname === '/api/seed';
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
