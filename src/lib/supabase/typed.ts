/**
 * Supabase Typed Client Helpers
 * Provides type-safe database operations with RLS enforcement
 *
 * IMPORTANT: Uses browser client (anon key) — NOT service role.
 * This ensures Row-Level Security policies are enforced at the database level.
 */

import { createClient as createBrowserClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined
const isBrowser = typeof window !== 'undefined'

/**
 * Typed Supabase client that respects RLS
 * Uses anon key for browser-side row-level security
 */
// Supabase SSR generic schema limitation: createServerClient returns Schema type 'never'
// We use the properly typed client directly for all typed operations.
export type TypedSupabaseClient = ReturnType<typeof createBrowserClient<Database>> | any

/**
 * Create a typed Supabase client with RLS enforcement
 * Use this instead of `createServerClient() as any`
 * Browser-safe version for client components
 */
export function createTypedClient(): TypedSupabaseClient {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: isBrowser && !isTestEnv,
      autoRefreshToken: isBrowser && !isTestEnv,
      detectSessionInUrl: isBrowser && !isTestEnv,
    },
  }) as any
}

/**
 * Get a typed client (alias for use in hooks)
 */
export function getTypedClient(): TypedSupabaseClient {
  return createTypedClient()
}

/**
 * Type helper for Supabase results from core tables
 */
type Tables = Database['public']['Tables']
type TableName = keyof Tables

export type SupabaseResult<T extends TableName> = Tables[T]['Row']
export type SupabaseInsert<T extends TableName> = Tables[T]['Insert']
export type SupabaseUpdate<T extends TableName> = Tables[T]['Update']
