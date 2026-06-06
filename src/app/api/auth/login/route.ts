import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validations'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

/**
 * POST /api/auth/login
 * Sign in with email and password
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.auth,
      keyPrefix: 'auth-login',
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
            ...createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime, rateLimitPresets.auth.maxRequests),
          },
        }
      )
    }

    const rawBody = await request.json()
    const { email, password } = loginSchema.parse(rawBody)

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Get user profile with clinic info
    const { data: profile, error: profileError } = await (supabase as any)
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        phone,
        avatar_url,
        is_active,
        clinic_id,
        clinics (
          id,
          name,
          slug,
          phone,
          email,
          settings
        )
      `)
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      // User exists in auth but not in users table
      console.error('Profile error:', profileError)
      return NextResponse.json({
        user: data.user,
        session: data.session,
        profile: null,
        needsProfile: true,
      })
    }

    type UserProfile = {
      id: string
      email: string
      name: string
      role: string
      phone: string | null
      avatar_url: string | null
      is_active: boolean
      clinic_id: string
      clinics: {
        id: string
        name: string
        slug: string
        phone: string
        email: string
        settings: Record<string, unknown>
      } | null
    }

    const typedProfile = profile as UserProfile

    if (!typedProfile.is_active) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      profile: typedProfile,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}