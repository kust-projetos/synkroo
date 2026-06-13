/**
 * @deprecated Supabase server client — replaced by Auth.js + Drizzle.
 *
 * Auth helpers moved to:
 *   - src/lib/auth/session.ts  (getUserProfile, requireAuth, requireRole, etc.)
 *   - src/lib/auth/auth.ts     (Auth.js configuration)
 *   - src/lib/auth/permissions.ts (role/permission helpers)
 */

/**
 * @deprecated Supabase client bridge — replaced by Drizzle.
 */
export { createClient } from '@/lib/supabase';
export { createServerClient } from '@/lib/supabase';

export {
  getCurrentUser as getUser,
  getUserProfile,
  isAuthenticated,
  requireAuth,
  requireRole,
  validateApiAuth,
  validateClinicAccess,
  hasRequiredRole,
} from '@/lib/auth/session';

export type { AuthResult, ServerUserProfile as UserProfile } from '@/lib/auth/session';
