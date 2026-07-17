import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware for authentication — validates Auth.js JWT.
 * Edge-compatible: uses next-auth/jwt getToken instead of auth().
 *
 * NOTA sobre OpenNext/Workers:
 *   process.env é populado por populateProcessEnv() a cada request,
 *   NÃO em module-init. Portanto, qualquer leitura de env var DEVE
 *   ser feita dentro da função middleware, não no module scope.
 */
export async function middleware(request: NextRequest) {
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

  // Public paths that don't require authentication
  const publicPaths: string[] = [
    '/login',
    '/signup',
    '/pi-finance',
    '/api/auth',
    '/api/health',
    '/api/webhook',
    '/api/whatsapp',
    '/api/instagram',
    '/api/messages',
    '/api/agent',
    '/api/cron',
  ];
  if (process.env.NODE_ENV === 'development') {
    publicPaths.push('/api/seed');
  }

  const isPublicPath =
    pathname === '/' ||
    publicPaths.some((path) => pathname.startsWith(path));

  // If no session and trying to access protected route
  if (!token && !isPublicPath) {
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
