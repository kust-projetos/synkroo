import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger, whatsappLogger } from '@/lib/logger'

/**
 * Confirmation Response Handler
 * Handles automatic appointment confirmation from patient WhatsApp responses
 */

// Confirmation keywords in Portuguese
const CONFIRMATION_KEYWORDS = [
  'sim', 'confirmo', 'confirmar', 'confirmada', 'confirmado',
  'vou', 'vou ir', 'pode confirmar', 'confirmar presença',
  'ok', 'certo', 'combinado', 'combinada',
  'yes', 'confirm', // English fallbacks
]

const CANCELLATION_KEYWORDS = [
  'não', 'nao', 'cancelar', 'cancelado', 'cancelada',
  'desmarcar', 'desmarquei', 'não vou', 'nao vou',
  'impossível', 'impossivel', 'não posso', 'nao posso',
  'no', 'cancel',
]

interface AppointmentMatch {
  appointmentId: string
  scheduledAt: Date
  patientName: string
  clinicId: string
  status: string
}

/**
 * Detect if message is a confirmation or cancellation
 */
export function detectConfirmationIntent(message: string): {
  isConfirmation: boolean
  isCancellation: boolean
  confidence: number
} {
  const lowerMessage = message.toLowerCase().trim()

  // Check for confirmation keywords
  for (const keyword of CONFIRMATION_KEYWORDS) {
    if (lowerMessage === keyword || lowerMessage.includes(keyword)) {
      // Higher confidence for exact matches
      const confidence = lowerMessage === keyword ? 0.95 : 0.8
      return { isConfirmation: true, isCancellation: false, confidence }
    }
  }

  // Check for cancellation keywords
  for (const keyword of CANCELLATION_KEYWORDS) {
    if (lowerMessage === keyword || lowerMessage.includes(keyword)) {
      const confidence = lowerMessage === keyword ? 0.95 : 0.8
      return { isConfirmation: false, isCancellation: true, confidence }
    }
  }

  return { isConfirmation: false, isCancellation: false, confidence: 0 }
}

/**
 * Find pending appointment for a patient phone number
 */
export async function findPendingAppointment(
  clinicId: string,
  patientPhone: string
): Promise<AppointmentMatch | null> {
  const supabase = await createTypedClient()

  // Normalize phone number
  let normalizedPhone = patientPhone.replace(/\D/g, '')
  if (normalizedPhone.startsWith('55')) {
    normalizedPhone = normalizedPhone.substring(2)
  }

  // Find patient by phone
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, phone')
    .eq('clinic_id', clinicId)

  // Match patient by phone (flexible matching)
  const patient = (patients || []).find((p: any) => {
    const patientPhone = p.phone?.replace(/\D/g, '').replace(/^55/, '')
    return patientPhone === normalizedPhone ||
           normalizedPhone.includes(patientPhone) ||
           patientPhone.includes(normalizedPhone)
  })

  if (!patient) {
    return null
  }

  // Find upcoming appointment for this patient
  const now = new Date()
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status, clinic_id')
    .eq('patient_id', patient.id)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (!appointments || appointments.length === 0) {
    return null
  }

  const apt = appointments[0]

  return {
    appointmentId: apt.id,
    scheduledAt: new Date(apt.scheduled_at),
    patientName: patient.name,
    clinicId: apt.clinic_id,
    status: apt.status,
  }
}

/**
 * Process confirmation response from patient
 */
export async function processConfirmationResponse(
  clinicId: string,
  patientPhone: string,
  message: string
): Promise<{
  processed: boolean
  action?: 'confirmed' | 'cancelled' | 'no_action'
  appointmentId?: string
  responseMessage?: string
}> {
  const intent = detectConfirmationIntent(message)

  if (!intent.isConfirmation && !intent.isCancellation) {
    return { processed: false, action: 'no_action' }
  }

  const appointment = await findPendingAppointment(clinicId, patientPhone)

  if (!appointment) {
    return { processed: false, action: 'no_action' }
  }

  const supabase = await createTypedClient()

  if (intent.isConfirmation) {
    // Confirm the appointment
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointment.appointmentId)

    if (error) {
      dbLogger.error('Error confirming appointment', error)
      return { processed: false, action: 'no_action' }
    }

    const dateStr = appointment.scheduledAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    const timeStr = appointment.scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    dbLogger.info(`Appointment ${appointment.appointmentId} confirmed via WhatsApp`, {
      patientName: appointment.patientName,
    })

    return {
      processed: true,
      action: 'confirmed',
      appointmentId: appointment.appointmentId,
      responseMessage: `✅ Confirmado, ${appointment.patientName}!

Sua consulta está confirmada:

📅 ${dateStr}
⏰ às ${timeStr}

Você receberá um lembrete no dia anterior. Até logo!`,
    }
  }

  if (intent.isCancellation) {
    // Cancel the appointment
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: 'Cancelado pelo paciente via WhatsApp',
      })
      .eq('id', appointment.appointmentId)

    if (error) {
      dbLogger.error('Error cancelling appointment', error)
      return { processed: false, action: 'no_action' }
    }

    dbLogger.info(`Appointment ${appointment.appointmentId} cancelled via WhatsApp`, {
      patientName: appointment.patientName,
    })

    return {
      processed: true,
      action: 'cancelled',
      appointmentId: appointment.appointmentId,
      responseMessage: `✅ Entendido, ${appointment.patientName}.

Sua consulta foi cancelada. Se quiser reagendar, é só me avisar!`,
    }
  }

  return { processed: false, action: 'no_action' }
}

/**
 * Process waitlist confirmation response
 */
export async function processWaitlistConfirmation(
  clinicId: string,
  patientPhone: string,
  message: string
): Promise<{
  processed: boolean
  scheduled?: boolean
  responseMessage?: string
}> {
  const supabase = await createTypedClient()
  const lowerMessage = message.toLowerCase().trim()

  // Check for "SIM" to confirm waitlist slot
  if (!CONFIRMATION_KEYWORDS.some(kw => lowerMessage.includes(kw))) {
    return { processed: false }
  }

  // Find notified waitlist entry for this patient
  let normalizedPhone = patientPhone.replace(/\D/g, '')
  if (normalizedPhone.startsWith('55')) {
    normalizedPhone = normalizedPhone.substring(2)
  }

  // Find patient
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name')
    .eq('clinic_id', clinicId)

  const patient = (patients || []).find((p: any) => {
    // Need to get phone from patients table
    return true // We'll match via waitlist
  })

  if (!patient) {
    return { processed: false }
  }

  // Find notified waitlist entry
  const { data: waitlistEntries } = await supabase
    .from('waitlist')
    .select(`
      id,
      patient_id,
      preferred_date,
      preferred_time_start,
      procedure_id,
      dentist_id,
      patients (name, phone)
    `)
    .eq('clinic_id', clinicId)
    .eq('status', 'notified')
    .order('notified_at', { ascending: false })
    .limit(1)

  if (!waitlistEntries || waitlistEntries.length === 0) {
    return { processed: false }
  }

  const entry = waitlistEntries[0] as any

  // Verify phone matches
  const entryPhone = entry.patients?.phone?.replace(/\D/g, '').replace(/^55/, '')
  if (entryPhone !== normalizedPhone && !normalizedPhone.includes(entryPhone)) {
    return { processed: false }
  }

  // Create appointment from waitlist
  const scheduledAt = new Date(`${entry.preferred_date}T${entry.preferred_time_start}:00`)

  const { data: appointment, error: aptError } = await supabase
    .from('appointments')
    .insert({
      clinic_id: clinicId,
      patient_id: entry.patient_id,
      dentist_id: entry.dentist_id,
      procedure_id: entry.procedure_id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: 30,
      status: 'confirmed',
      notes: 'Agendado via lista de espera',
    })
    .select()
    .single()

  if (aptError) {
    dbLogger.error('Error creating appointment from waitlist', aptError)
    return { processed: false }
  }

  // Update waitlist entry
  await supabase
    .from('waitlist')
    .update({
      status: 'scheduled',
      scheduled_appointment_id: appointment.id,
    })
    .eq('id', entry.id)

  const dateStr = scheduledAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  dbLogger.info(`Waitlist appointment created for ${entry.patients?.name}`)

  return {
    processed: true,
    scheduled: true,
    responseMessage: `✅ Perfeito, ${entry.patients?.name}!

Sua consulta está confirmada:

📅 ${dateStr}
⏰ às ${timeStr}

Te vejo lá! 🦷`,
  }
}