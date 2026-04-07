import { NextResponse } from 'next/server'
import { getUserProfile, getUser } from '@/lib/supabase/server'

/**
 * GET /api/auth/session
 * Get current session and user profile
 */
export async function GET() {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        profile: null,
      })
    }

    const profile = await getUserProfile()

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile,
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}