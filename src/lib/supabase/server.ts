import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

/**
 * Create Supabase client for Server Components
 * Uses cookies for session management
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Get the current session on the server
 */
export async function getSession() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Error getting session:', error)
    return null
  }

  return session
}

/**
 * Get the current user on the server
 */
export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('Error getting user:', error)
    return null
  }

  return user
}

/**
 * Get the current user's profile with clinic info
 */
export async function getUserProfile() {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile, error } = await supabase
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
    .eq('id', user.id)
    .single() as { data: Record<string, any> | null; error: any }

  if (error) {
    console.error('Error getting user profile:', error)
    return null
  }

  return profile as Record<string, any>
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const user = await getUser()
  return !!user
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Require specific role
 */
export async function requireRole(roles: string[]) {
  const profile = await getUserProfile()
  if (!profile || !roles.includes(profile.role)) {
    throw new Error('Forbidden')
  }
  return profile
}

/**
 * API Authentication Response
 * Returns standardized auth error response
 */
export interface AuthResult {
  success: boolean
  error?: { message: string; status: number }
  user?: { id: string; email: string }
  profile?: {
    id: string
    email: string
    name: string
    role: string
    clinic_id: string
    is_active: boolean
    clinics?: {
      id: string
      name: string
      slug: string
      phone: string | null
      email: string | null
      settings: Record<string, unknown> | null
    } | null
  }
}

/**
 * Validate API authentication
 * Use in API routes to check auth and get user profile
 */
export async function validateApiAuth(): Promise<AuthResult> {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: { message: 'Unauthorized', status: 401 },
      }
    }

    const profile = await getUserProfile()
    if (!profile) {
      return {
        success: false,
        error: { message: 'User profile not found', status: 403 },
      }
    }

    if (!profile.is_active) {
      return {
        success: false,
        error: { message: 'User account is inactive', status: 403 },
      }
    }

    return {
      success: true,
      user: { id: user.id, email: user.email || '' },
      profile: profile as any,
    }
  } catch (error) {
    return {
      success: false,
      error: { message: 'Authentication error', status: 500 },
    }
  }
}

/**
 * Validate that user belongs to the specified clinic
 */
export async function validateClinicAccess(
  clinicId: string
): Promise<AuthResult> {
  const authResult = await validateApiAuth()

  if (!authResult.success) {
    return authResult
  }

  if (authResult.profile!.clinic_id !== clinicId) {
    return {
      success: false,
      error: { message: 'Access denied to this clinic', status: 403 },
    }
  }

  return authResult
}

/**
 * Check if user has required role for action
 */
export function hasRequiredRole(
  profile: { role: string },
  allowedRoles: string[]
): boolean {
  return allowedRoles.includes(profile.role)
}