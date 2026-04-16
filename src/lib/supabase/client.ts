import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Lazy client - only initialized when actually needed
let _supabase: ReturnType<typeof createClient<Database>> | null = null

function getSupabase() {
  if (_supabase) return _supabase

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
 * Supabase client for browser/client-side usage.
 * In development without env vars, returns a no-op proxy that logs warnings
 * instead of crashing the app.
 */
export const supabase = isConfigured
  ? new Proxy({} as ReturnType<typeof createClient<Database>>, {
      get(_target, prop) {
        return (getSupabase() as any)[prop as keyof ReturnType<typeof createClient<Database>>]
      }
    })
  : new Proxy({} as ReturnType<typeof createClient<Database>>, {
      get(_target, prop) {
        if (prop === 'auth') {
          return new Proxy({}, {
            get(_t, method) {
              // onAuthStateChange returns a no-op subscription so AuthProvider doesn't crash
              if (method === 'onAuthStateChange') {
                return (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } })
              }
              if (method === 'getUser') {
                return async () => ({ data: { user: null }, error: null })
              }
              if (method === 'getSession') {
                return async () => ({ data: { session: null }, error: null })
              }
              return async () => {
                console.warn(`[supabase] auth.${String(method)}() called without config — skipping`)
                return { data: null, error: { message: 'Supabase not configured' } }
              }
            }
          })
        }
        return () => {
          console.warn(`[supabase] ${String(prop)}() called without config — skipping`)
          return Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
        }
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