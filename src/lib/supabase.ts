import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Generic client type without strict schema - allows any table access
// Use this for backend services that need flexibility
export type GenericClient = SupabaseClient<any>

// Check if Supabase is configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Client-side Supabase client - lazily initialized
let _supabase: SupabaseClient<Database> | null = null

function getSupabaseClient() {
  if (_supabase) return _supabase

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase client environment variables')
  }

  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return _supabase
}

/**
 * Creates a no-op proxy that safely handles Supabase calls when env vars are missing.
 * Used in development to allow UI work without a configured backend.
 */
function createNoOpProxy<T extends object>(): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === 'auth') {
        return new Proxy({}, {
          get(_t, method) {
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
              console.warn(`[supabase] auth.${String(method)}() called without config`)
              return { data: null, error: { message: 'Supabase not configured' } }
            }
          }
        })
      }
      if (prop === 'from') {
        return (_table: string) => new Proxy({}, {
          get(_t, method) {
            // Chainable query builder methods
            const chainable = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'range', 'limit', 'order', 'single', 'maybeSingle']
            if (chainable.includes(method as string)) {
              return function(this: any) { return this || createNoOpProxy() }
            }
            // Terminal methods
            if (method === 'then' || method === 'catch') {
              return (resolve: any) => resolve({ data: [], error: null })
            }
            return async () => {
              console.warn(`[supabase] from().${String(method)}() called without config`)
              return { data: null, error: { message: 'Supabase not configured' } }
            }
          }
        })
      }
      if (prop === 'rpc') {
        return async () => {
          console.warn('[supabase] rpc() called without config')
          return { data: null, error: { message: 'Supabase not configured' } }
        }
      }
      return () => {
        console.warn(`[supabase] ${String(prop)}() called without config`)
        return Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
      }
    }
  })
}

// Client-side Supabase client with strict typing for frontend use
// In dev without env vars, returns a no-op proxy so the UI can render
export const supabase: SupabaseClient<Database> = isConfigured
  ? new Proxy({} as SupabaseClient<Database>, {
      get(_target, prop) {
        return (getSupabaseClient() as any)[prop as keyof SupabaseClient<Database>]
      }
    })
  : createNoOpProxy<SupabaseClient<Database>>()

// Server-side Supabase client with service role
// Uses generic typing to allow access to any table without strict schema validation
export const createServerClient = (): GenericClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Admin client for background jobs
export const createAdminClient = (): GenericClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export type SupabaseClientType = typeof supabase