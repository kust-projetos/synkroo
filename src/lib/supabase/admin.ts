import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables')
  }

  _supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _supabaseAdmin
}

/**
 * Supabase admin client for server-side usage
 * Uses service role key to bypass RLS for system operations
 * IMPORTANT: Only use in server-side code, never expose to client
 */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    // Fix for specific property access issues
    if (prop === 'client') return client
    return (client as any)[prop as keyof typeof client]
  }
})

/**
 * Get or create a conversation
 */
export async function getOrCreateConversation(
  clinicId: string,
  channel: 'whatsapp' | 'instagram' | 'web',
  externalId: string,
  patientPhone?: string
): Promise<string> {
  const { data, error } = await (supabaseAdmin as any).rpc('get_or_create_conversation', {
    p_clinic_id: clinicId,
    p_channel: channel,
    p_external_id: externalId,
    p_patient_phone: patientPhone || null,
  })

  if (error) throw error
  return data
}

/**
 * Store a message in a conversation
 */
export async function storeMessage(
  conversationId: string,
  direction: 'inbound' | 'outbound',
  content: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      direction,
      content,
      metadata: metadata as any,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/**
 * Get conversation context for AI
 */
export async function getConversationContext(
  conversationId: string,
  limit: number = 10
): Promise<Array<{ role: string; content: string; intent: string | null }>> {
  const { data, error } = await (supabaseAdmin as any).rpc('get_conversation_context', {
    p_conversation_id: conversationId,
    p_limit: limit,
  })

  if (error) throw error
  return data || []
}

/**
 * Get patient insights
 */
export async function getPatientInsights(patientId: string) {
  const { data, error } = await (supabaseAdmin as any).rpc('get_patient_insights', {
    p_patient_id: patientId,
  })

  if (error) throw error
  return data
}

/**
 * Get available time slots for scheduling
 */
export async function getAvailableSlots(
  clinicId: string,
  dentistId: string,
  date: string,
  durationMinutes: number = 30
): Promise<Array<{ start_time: string; end_time: string }>> {
  const { data, error } = await (supabaseAdmin as any).rpc('get_availability', {
    p_clinic_id: clinicId,
    p_dentist_id: dentistId,
    p_date: date,
    p_duration_minutes: durationMinutes,
  })

  if (error) throw error
  return data || []
}

/**
 * Get clinic configuration
 */
export async function getClinicConfig(clinicId: string) {
  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()

  if (error) throw error
  return data
}

/**
 * Search knowledge base for answers
 */
export async function searchKnowledgeBase(
  clinicId: string,
  query: string
): Promise<Array<{ question: string; answer: string; relevance: number }>> {
  // Using simple text search for now
  // Could be enhanced with vector similarity search
  const { data, error } = await supabaseAdmin
    .from('knowledge_base')
    .select('question, answer, keywords')
    .eq('clinic_id', clinicId)
    .or(`question.ilike.%${query}%,keywords.cs.{${query}}`)
    .limit(5)

  if (error) throw error
  return data?.map((item: { question: string; answer: string }) => ({
    question: item.question,
    answer: item.answer,
    relevance: 0.8, // Placeholder for now
  })) || []
}