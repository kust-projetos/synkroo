/**
 * @deprecated Supabase browser client — replaced by Drizzle.
 */
import { getDb } from '@/lib/db/client';

export function createClient() {
  return {} as any;
}

/** @deprecated Compatibility export. Use getDb() from @/lib/db/client. */
export const supabase = createClient();
