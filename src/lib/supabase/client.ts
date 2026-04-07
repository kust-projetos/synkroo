import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Lazy client - only initialized when actually needed
let _supabase: ReturnType<typeof createClient<Database>> | null = null

function getSupabase() {
  if (_supabase) return _supabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return _supabase
}

/**
 * Supabase client for browser/client-side usage
 * Uses anon key with RLS policies for security
 */
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_target, prop) {
    return (getSupabase() as any)[prop as keyof ReturnType<typeof createClient<Database>>]
  }
})

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * Get the current user's clinic_id from their profile
 */
export async function getCurrentClinicId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data: profile, error } = await (supabase as any)
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (error) return null
  return profile?.clinic_id || null
}