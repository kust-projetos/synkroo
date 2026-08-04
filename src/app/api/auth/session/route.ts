import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/lib/auth/session'

/**
 * GET /api/auth/session
 * Return the active Auth.js session and its database-backed profile.
 * Revoked, inactive, stale, and unavailable profiles fail closed.
 */
export async function GET() {
  try {
    const profile = await requireActiveProfile()

    return NextResponse.json({
      authenticated: true,
      user: {
        id: profile.id,
        email: profile.email,
      },
      profile,
    })
  } catch {
    return NextResponse.json(
      { authenticated: false, user: null, profile: null },
      { status: 401 },
    )
  }
}
