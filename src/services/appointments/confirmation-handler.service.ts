import { eq, and, gte, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients, appointments, waitlist } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

/**
 * Confirmation Response Handler
 * Handles automatic appointment confirmation from patient WhatsApp responses
 * Migrated from Supabase to Drizzle ORM
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
 * Normalize phone number for matching
 */
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '')
  if (normalized.startsWith('55')) {
    normalized = normalized.substring(2)
  }
  return normalized
}

/**
 * Find pending appointment for a patient phone number
 */
export async function findPendingAppointment(
  clinicId: string,
  patientPhone: string
): Promise<AppointmentMatch | null> {
  const db = getDb()

  // Normalize phone number
  const normalizedPhone = normalizePhone(patientPhone)

  // Find patients by clinic
  const patientRows = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients)
    .where(eq(patients.clinicId, clinicId))

  // Match patient by phone (flexible matching)
  const patient = patientRows.find(p => {
    const patientPhoneNorm = normalizePhone(p.phone || '')
    return patientPhoneNorm === normalizedPhone ||
           normalizedPhone.includes(patientPhoneNorm) ||
           patientPhoneNorm.includes(normalizedPhone)
  })

  if (!patient) {
    return null
  }

  // Find upcoming appointment for this patient
  const now = new Date()
  const appointmentRows = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      clinicId: appointments.clinicId,
    })
    .from(appointments)
    .where(and(
      eq(appointments.patientId, patient.id),
      gte(appointments.scheduledAt, now)
    ))

  // Filter to pending status and get earliest
  const pendingAppointments = appointmentRows.filter(a =>
    a.status === 'scheduled' || a.status === 'confirmed'
  )

  if (pendingAppointments.length === 0) {
    return null
  }

  // Sort by scheduledAt ascending and get first
  pendingAppointments.sort((a, b) =>
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )

  const apt = pendingAppointments[0]

  return {
    appointmentId: apt.id,
    scheduledAt: new Date(apt.scheduledAt),
    patientName: patient.name,
    clinicId: apt.clinicId,
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

  const db = getDb()

  if (intent.isConfirmation) {
    // Confirm the appointment
    await db
      .update(appointments)
      .set({ status: 'confirmed' as any })
      .where(eq(appointments.id, appointment.appointmentId))

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
    await db
      .update(appointments)
      .set({
        status: 'cancelled' as any,
        notes: 'Cancelado pelo paciente via WhatsApp',
      } as any)
      .where(eq(appointments.id, appointment.appointmentId))

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
  const db = getDb()
  const lowerMessage = message.toLowerCase().trim()

  // Check for confirmation keyword
  if (!CONFIRMATION_KEYWORDS.some(kw => lowerMessage.includes(kw))) {
    return { processed: false }
  }

  // Normalize phone
  const normalizedPhone = normalizePhone(patientPhone)

  // Find patient by phone
  const patientRows = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients)
    .where(eq(patients.clinicId, clinicId))

  const patient = patientRows.find(p => {
    const patientPhoneNorm = normalizePhone(p.phone || '')
    return patientPhoneNorm === normalizedPhone ||
           normalizedPhone.includes(patientPhoneNorm) ||
           patientPhoneNorm.includes(normalizedPhone)
  })

  if (!patient) {
    return { processed: false }
  }

  // Find notified waitlist entry for this patient
  const waitlistRows = await db
    .select({
      id: waitlist.id,
      patientId: waitlist.patientId,
      preferredDate: waitlist.preferredDate,
      preferredTimeStart: waitlist.preferredTimeStart,
      procedureId: waitlist.procedureId,
      dentistId: waitlist.dentistId,
      status: waitlist.status,
      notifiedAt: waitlist.notifiedAt,
    })
    .from(waitlist)
    .where(and(
      eq(waitlist.clinicId, clinicId),
      eq(waitlist.status, 'notified'),
      eq(waitlist.patientId, patient.id)
    ))
    .orderBy(waitlist.notifiedAt)
    .limit(1)

  if (waitlistRows.length === 0) {
    return { processed: false }
  }

  const entry = waitlistRows[0]

  // Build scheduledAt from preferred_date and preferred_time_start
  const prefDate = entry.preferredDate instanceof Date
    ? entry.preferredDate
    : entry.preferredDate ? new Date(entry.preferredDate) : new Date()
  const prefTime = entry.preferredTimeStart || '09:00'
  const scheduledAt = new Date(`${prefDate.toISOString().split('T')[0]}T${prefTime}:00`)

  // Create appointment from waitlist
  const appointmentResult = await db
    .insert(appointments)
    .values({
      clinicId,
      patientId: entry.patientId,
      dentistId: entry.dentistId ?? null,
      procedureId: entry.procedureId ?? null,
      scheduledAt,
      durationMinutes: 30,
      status: 'confirmed' as any,
      notes: 'Agendado via lista de espera',
    } as any)
    .returning()

  const appointment = appointmentResult[0]

  if (!appointment) {
    dbLogger.error('Error creating appointment from waitlist', { entry })
    return { processed: false }
  }

  // Update waitlist entry
  await db
    .update(waitlist)
    .set({
      status: 'scheduled',
      scheduledAppointmentId: appointment.id,
    } as any)
    .where(eq(waitlist.id, entry.id))

  const dateStr = scheduledAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  dbLogger.info(`Waitlist appointment created for ${patient.name}`)

  return {
    processed: true,
    scheduled: true,
    responseMessage: `✅ Perfeito, ${patient.name}!

Sua consulta está confirmada:

📅 ${dateStr}
⏰ às ${timeStr}

Te vejo lá! 🦷`,
  }
}