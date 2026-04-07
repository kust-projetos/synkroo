/**
 * Patient Registration via Conversation Service
 * Detects new patients from unknown phone numbers and registers them gradually
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface RegistrationState {
  conversation_id: string
  phone: string
  clinic_id: string
  stage: 'detecting' | 'requesting_name' | 'confirming_name' | 'requesting_email' | 'complete'
  extracted_name: string | null
  patient_id: string | null
  created_at: string
}

/**
 * Check if phone belongs to an existing patient
 */
export async function findPatientByPhone(
  phone: string,
  clinicId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .is('deleted_at', null)
      .limit(1)

    if (error) throw error

    return data && data.length > 0 ? (data[0] as any) : null
  } catch (error) {
    dbLogger.error('Error finding patient by phone', error)
    return null
  }
}

/**
 * Extract a potential name from a conversation message
 */
export function extractNameFromMessage(message: string): string | null {
  // Common patterns: "Meu nome é João", "Sou a Maria", "Me chamo Pedro"
  const patterns = [
    /(?:meu nome [ée]\s+|me chamo\s+|sou [oa]\s+|me chama de\s+)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
    /^(?:Oi|Olá|Bom dia|Boa tarde|Boa noite)[,.!]*\s+(?:eu sou|meu nome [ée]|me chamo)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
    /^(?:Oi|Olá|Bom dia|Boa tarde|Boa noite)[,.!]*\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      const name = match[1].trim()
      // Validate it looks like a name (at least 2 chars, no numbers)
      if (name.length >= 2 && !/\d/.test(name)) {
        return name
      }
    }
  }

  return null
}

/**
 * Create a minimal patient record (name + phone only, marked as incomplete)
 */
export async function createMinimalPatient(params: {
  clinicId: string
  name: string
  phone: string
  source?: string
}): Promise<{ id: string; name: string } | null> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await (supabase
      .from('patients') as any)
      .insert({
        clinic_id: params.clinicId,
        name: params.name,
        phone: params.phone,
        source: params.source || 'whatsapp',
        status: 'active',
        tags: ['Novo', 'Cadastro Incompleto'],
      })
      .select('id, name')
      .single()

    if (error) throw error

    dbLogger.info('Minimal patient created', {
      patientId: (data as any).id,
      phone: params.phone,
    })

    return data as any
  } catch (error) {
    dbLogger.error('Error creating minimal patient', error)
    return null
  }
}

/**
 * Update patient with additional info (email, full name, etc.)
 */
export async function updatePatientInfo(
  patientId: string,
  updates: {
    name?: string
    email?: string
    cpf?: string
    birth_date?: string
  }
): Promise<boolean> {
  const supabase = await createTypedClient()

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name) updateData.name = updates.name
    if (updates.email) updateData.email = updates.email
    if (updates.cpf) updateData.cpf = updates.cpf
    if (updates.birth_date) updateData.birth_date = updates.birth_date

    const { error } = await (supabase
      .from('patients') as any)
      .update(updateData)
      .eq('id', patientId)

    if (error) throw error

    return true
  } catch (error) {
    dbLogger.error('Error updating patient info', error)
    return false
  }
}

/**
 * Remove 'Cadastro Incompleto' tag when registration is complete
 */
export async function markRegistrationComplete(patientId: string): Promise<boolean> {
  const supabase = await createTypedClient()

  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('tags')
      .eq('id', patientId)
      .single()

    const currentTags: string[] = (patient as any)?.tags || []
    const newTags = currentTags.filter((t) => t !== 'Cadastro Incompleto')

    const { error } = await (supabase
      .from('patients') as any)
      .update({ tags: newTags, updated_at: new Date().toISOString() })
      .eq('id', patientId)

    if (error) throw error

    return true
  } catch (error) {
    dbLogger.error('Error marking registration complete', error)
    return false
  }
}

/**
 * Process a new conversation message to detect and register patients
 * Returns instructions for the agent about what to ask next
 */
export async function processRegistrationFlow(params: {
  phone: string
  clinicId: string
  message: string
  conversationId: string
}): Promise<{
  isNewPatient: boolean
  patientId: string | null
  patientName: string | null
  nextAction: 'none' | 'ask_name' | 'confirm_name' | 'ask_email' | 'registration_complete'
  suggestedReply?: string
}> {
  const { phone, clinicId, message, conversationId } = params

  // Check if patient exists
  const existing = await findPatientByPhone(phone, clinicId)
  if (existing) {
    return {
      isNewPatient: false,
      patientId: existing.id,
      patientName: existing.name,
      nextAction: 'none',
    }
  }

  // Try to extract name from message
  const extractedName = extractNameFromMessage(message)

  if (extractedName) {
    // Create minimal patient
    const patient = await createMinimalPatient({
      clinicId,
      name: extractedName,
      phone,
      source: 'whatsapp',
    })

    if (patient) {
      return {
        isNewPatient: true,
        patientId: patient.id,
        patientName: patient.name,
        nextAction: 'confirm_name',
        suggestedReply: `Prazer em conhecê-lo, ${extractedName}! Posso confirmar que seu nome está correto? E seria útil ter seu email para envio de informações. Deseja compartilhar?`,
      }
    }
  }

  // No name detected - ask for it
  return {
    isNewPatient: true,
    patientId: null,
    patientName: null,
    nextAction: 'ask_name',
    suggestedReply: 'Olá! Ainda não tenho seu cadastro. Para te atender melhor, poderia me informar seu nome?',
  }
}

/**
 * Extract email from a message
 */
export function extractEmail(message: string): string | null {
  const match = message.match(/[\w.-]+@[\w.-]+\.\w{2,}/)
  return match ? match[0] : null
}
