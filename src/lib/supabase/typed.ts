/**
 * Supabase Typed Client Helpers
 * Provides type-safe database operations with RLS enforcement
 *
 * IMPORTANT: Uses SSR client (anon key + cookies) — NOT service role.
 * This ensures Row-Level Security policies are enforced at the database level.
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from './database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Typed Supabase client that respects RLS
 * Uses anon key + user cookies for row-level security
 */
export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Create a typed Supabase client with RLS enforcement
 * Use this instead of `createServerClient() as any`
 *
 * This returns a client scoped to the authenticated user's session,
 * so Row-Level Security policies are enforced at the database level.
 */
export async function createTypedClient(): Promise<TypedSupabaseClient> {
  return createClient()
}

/**
 * Convenience function for services
 * Returns a pre-typed RLS-aware client
 */
export async function getTypedClient(): Promise<TypedSupabaseClient> {
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
