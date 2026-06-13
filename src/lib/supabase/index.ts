// Re-export for convenience
export { supabase } from './client'
// getCurrentUser/getCurrentClinicId removed — use @/lib/auth/session instead
// supabaseAdmin is deprecated — use repositories instead
// import { supabaseAdmin } from './admin'
// All admin.ts functions now delegate to Drizzle repositories
export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'then') return undefined
    return () => {
      console.warn(`supabaseAdmin.${String(prop)} is deprecated — use Drizzle repositories instead`)
      return Promise.resolve(null)
    }
  }
}) as any
export type { Database, Json, ChannelType, AppointmentStatus, ConversationStatus, MessageDirection, UserRole } from './database.types'