/**
 * @deprecated Supabase typed client — replaced by Drizzle.
 */
import { getDb } from '@/lib/db/client';

export type TypedSupabaseClient = any;

export function createTypedClient(): TypedSupabaseClient {
  return {} as any;
}
