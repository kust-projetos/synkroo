import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware for authentication and session refresh
 * Runs on every request to protected routes
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public paths that don't require authentication
  const publicPaths = [
    '/login',
    '/signup',
    '/auth/callback',
    '/api/auth',
    '/api/health',
    '/api/webhook',
    '/api/whatsapp',
    '/api/instagram',
    '/api/messages',
    '/api/agent',
    '/api/cron', // Cron endpoints use CRON_SECRET for auth
  ]

  const pathname = request.nextUrl.pathname
  const isPublicPath = pathname === '/' || publicPaths.some(path =>
    pathname.startsWith(path)
  )

  // If no user and trying to access protected route
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // If user exists but no profile in users table, redirect to complete profile
  // This handles the case where auth user exists but profile wasn't created
  if (user && request.nextUrl.pathname !== '/complete-profile') {
    // Check if user has a profile
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile && !request.nextUrl.pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/complete-profile'
      return NextResponse.redirect(url)
    }
  }

  // If logged in and trying to access login page, redirect to dashboard
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}