import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/refresh
 * Refresh the current session using refresh token
 */
export async function POST() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.refreshSession()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!data.session) {
      return NextResponse.json(
        { error: 'No session to refresh' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
      } : null,
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
