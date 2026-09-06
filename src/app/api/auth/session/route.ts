import { NextResponse } from 'next/server'
import { getSession, requireActiveProfile } from '@/lib/auth/session'
import { listUserClinics } from '@/repositories/auth'

const SESSION_COOKIE_NAMES = new Set([
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
])

/**
 * Detecta cookie de sessão Auth.js no header Cookie da requisição.
 * Presença do cookie com sessão ilegível = token expirado/rejeitado.
 */
function hasSessionCookie(request?: Request): boolean {
  const cookieHeader = request?.headers.get('cookie')
  if (!cookieHeader) return false
  return cookieHeader.split(';').some((part) => {
    const name = part.split('=')[0]?.trim()
    return name !== undefined && SESSION_COOKIE_NAMES.has(name)
  })
}

/**
 * GET /api/auth/session
 * Return the active Auth.js session and its database-backed profile.
 * Revoked, inactive, stale, and unavailable profiles fail closed.
 *
 * Visitante sem sessão (session === null E sem cookie de sessão) recebe 200
 * com `{ authenticated: false, ... }` para que o NextAuth client e fetches
 * diretos não tratem como CLIENT_FETCH_ERROR nem disparem loop de redirect.
 * Sessão presente porém inválida (objeto não-nulo mesmo sem user.id, ou
 * cookie de sessão órfão de token expirado/rejeitado) continua 401.
 */
export async function GET(request: Request) {
  try {
    const profile = await requireActiveProfile()
    const availableClinics = await listUserClinics(profile.id)

    return NextResponse.json({
      authenticated: true,
      user: {
        id: profile.id,
        email: profile.email,
      },
      profile: { ...profile, available_clinics: availableClinics },
    })
  } catch {
    let session: Awaited<ReturnType<typeof getSession>> = null
    try {
      session = (await getSession()) ?? null
    } catch {
      session = null
    }
    if (session !== null || hasSessionCookie(request)) {
      return NextResponse.json(
        { authenticated: false, user: null, profile: null },
        { status: 401 },
      )
    }
    return NextResponse.json(
      { authenticated: false, user: null, profile: null },
      { status: 200 },
    )
  }
}
