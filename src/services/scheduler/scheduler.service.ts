import { getDb } from '@/lib/db/client'
import { clinics, appointments, dentists, procedures } from '@/lib/db/schema'
import { eq, and, gte, lte, inArray, ilike } from 'drizzle-orm'
import { getLLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'

/**
 * Scheduler Agent
 * Intelligent appointment booking through natural language conversation
 * Migrated from Supabase to Drizzle ORM
 */

export interface SchedulerContext {
  clinicId: string
  patientId?: string
  conversationId?: string
  patientInfo?: {
    name: string
    phone: string
    email?: string
  }
  appointmentRequest?: {
    date?: string
    time?: string
    procedure?: string
    dentist?: string
    notes?: string
  }
}

export interface SlotInfo {
  time: string
  available: boolean
  dentistName?: string
}

export interface OperatingHours {
  start: string
  end: string
  lunchStart: string
  lunchEnd: string
  workDays: number[]
}

export interface ClinicSettings {
  operating_hours?: OperatingHours
  [key: string]: unknown
}

export interface SchedulingResult {
  success: boolean
  appointmentId?: string
  message: string
  requiresConfirmation?: boolean
  alternatives?: SlotInfo[]
}

const SYSTEM_PROMPT = `Você é a Ana, assistente de agendamento de uma clínica odontológica. Seu papel é ajudar pacientes a agendar consultas de forma natural e amigável.

**Suas responsabilidades:**
1. Coletar informações necessárias: data, horário preferido, procedimento (opcional)
2. Verificar disponibilidade antes de confirmar
3. Oferecer alternativas quando o horário não estiver disponível
4. Confirmar os detalhes antes de finalizar

**Tom de comunicação:**
- Amigável e profissional
- Use emojis com moderação (máximo 2 por mensagem)
- Seja conciso mas prestativo
- Sempre confirme os detalhes antes de finalizar

**Formato de resposta:**
Responda SEMPRE em JSON com esta estrutura:
{
  "message": "sua resposta para o paciente",
  "action": "collect_info" | "check_availability" | "confirm_appointment" | "create_appointment" | "offer_alternatives",
  "extracted": {
    "date": "YYYY-MM-DD ou null",
    "time": "HH:MM ou null",
    "procedure": "nome do procedimento ou null",
    "dentist": "nome do dentista ou null"
  }
}

**Exemplos de conversa:**

Paciente: "Quero agendar uma consulta para amanhã"
{
  "message": "Claro! Qual horário você prefere para amanhã? Temos disponibilidade das 8h às 18h.",
  "action": "collect_info",
  "extracted": { "date": "amanhã", "time": null, "procedure": null, "dentist": null }
}

Paciente: "Pode ser às 14h"
{
  "message": "Perfeito! Vou verificar a disponibilidade para às 14h. Qual procedimento você deseja fazer?",
  "action": "check_availability",
  "extracted": { "date": "amanhã", "time": "14:00", "procedure": null, "dentist": null }
}`

/**
 * Parse natural language date to YYYY-MM-DD format
 */
export function parseNaturalDate(text: string): string | null {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const lowerText = text.toLowerCase()

  // Today/tomorrow
  if (lowerText.includes('hoje')) {
    return today.toISOString().split('T')[0]
  }
  if (lowerText.includes('amanh') || lowerText.includes('amanhã')) {
    return tomorrow.toISOString().split('T')[0]
  }

  // Specific date patterns
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/, // DD/MM or DD/MM/YYYY
    /(\d{1,2}) de (\w+)/, // "15 de janeiro"
  ]

  // DD/MM pattern
  const dmyMatch = lowerText.match(/(\d{1,2})\/(\d{1,2})/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1])
    const month = parseInt(dmyMatch[2]) - 1
    const year = today.getFullYear()
    const date = new Date(year, month, day)
    if (date >= today) {
      return date.toISOString().split('T')[0]
    }
  }

  // Day of week
  const dayNames = ['domingo', 'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado']
  for (let i = 0; i < dayNames.length; i++) {
    if (lowerText.includes(dayNames[i])) {
      const targetDay = i
      const currentDay = today.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 7
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + daysUntil)
      return targetDate.toISOString().split('T')[0]
    }
  }

  return null
}

/**
 * Parse time from text
 */
export function parseTime(text: string): string | null {
  const lowerText = text.toLowerCase()

  // HH:MM pattern
  const timeMatch = lowerText.match(/(\d{1,2}):?(\d{2})?\s*(h|hrs|horas)?/)
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0')
    const minutes = timeMatch[2] || '00'
    return `${hours}:${minutes}`
  }

  // Natural time
  if (lowerText.includes('manhã') || lowerText.includes('manha')) {
    if (lowerText.includes('cedo')) return '08:00'
    return '10:00'
  }
  if (lowerText.includes('tarde')) {
    if (lowerText.includes('cedo')) return '14:00'
    return '16:00'
  }
  if (lowerText.includes('noite')) return '18:00'

  return null
}

/**
 * Get available slots for a date
 */
export async function getAvailableSlots(
  clinicId: string,
  date: string,
  durationMinutes: number = 30,
  dentistId?: string
): Promise<SlotInfo[]> {
  const db = getDb()

  // Get clinic settings
  const clinicRows = await db
    .select({ settings: clinics.settings })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1)

  const defaultHours: OperatingHours = {
    start: '08:00',
    end: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    workDays: [1, 2, 3, 4, 5],
  }

  const clinicSettings = (clinicRows[0]?.settings as ClinicSettings | null)
  const operatingHours = clinicSettings?.operating_hours || defaultHours

  // Get existing appointments
  const startOfDay = new Date(`${date}T00:00:00Z`)
  const endOfDay = new Date(`${date}T23:59:59Z`)

  const appointmentConditions = [
    eq(appointments.clinicId, clinicId),
    gte(appointments.scheduledAt, startOfDay),
    lte(appointments.scheduledAt, endOfDay),
    inArray(appointments.status, ['scheduled', 'confirmed', 'in_progress']),
  ]
  if (dentistId) {
    appointmentConditions.push(eq(appointments.dentistId, dentistId))
  }

  const existingAppointments = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      durationMinutes: appointments.durationMinutes,
      dentistId: appointments.dentistId,
    })
    .from(appointments)
    .where(and(...appointmentConditions))

  // Get dentists for reference
  const dentistRows = await db
    .select({ id: dentists.id, name: dentists.name })
    .from(dentists)
    .where(and(
      eq(dentists.clinicId, clinicId),
      eq(dentists.isActive, true)
    ))

  const dentistMap = new Map<string, string>(dentistRows.map(d => [d.id, d.name]))

  // Generate slots
  const slots: SlotInfo[] = []
  const start = operatingHours.start
  const end = operatingHours.end
  const lunchStart = operatingHours.lunchStart
  const lunchEnd = operatingHours.lunchEnd

  const [startHour] = start.split(':').map(Number)
  const [endHour] = end.split(':').map(Number)
  const [lunchStartHour] = lunchStart.split(':').map(Number)
  const [lunchEndHour] = lunchEnd.split(':').map(Number)

  for (let hour = startHour; hour < endHour; hour++) {
    // Skip lunch
    if (hour >= lunchStartHour && hour < lunchEndHour) continue

    for (let min = 0; min < 60; min += 30) {
      const slotTime = new Date(`${date}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`)

      // Skip past times
      if (slotTime <= new Date()) continue

      const slotEndTime = new Date(slotTime.getTime() + durationMinutes * 60000)

      // Check conflicts
      const hasConflict = existingAppointments.some(apt => {
        const aptStart = new Date(apt.scheduledAt)
        const aptEnd = new Date(aptStart.getTime() + (apt.durationMinutes ?? 30) * 60000)
        return slotTime < aptEnd && slotEndTime > aptStart
      })

      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
        available: !hasConflict,
        dentistName: dentistId ? dentistMap.get(dentistId) : undefined,
      })
    }
  }

  return slots
}

/**
 * Process scheduling request using AI
 */
export async function processSchedulingRequest(
  userMessage: string,
  context: SchedulerContext
): Promise<SchedulingResult> {
  try {
    // Build context for AI
    const contextInfo = [
      `Clínica: ${context.clinicId}`,
      context.patientInfo ? `Paciente: ${context.patientInfo.name}` : '',
      context.appointmentRequest?.date ? `Data solicitada: ${context.appointmentRequest.date}` : '',
    ].filter(Boolean).join('\n')

    const llm = getLLMProvider()
    const response = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${contextInfo}\n\nPaciente: ${userMessage}` },
    ])

    // Parse AI response
    const aiResponse = JSON.parse(response)

    // Extract date and time if present
    const extractedDate = aiResponse.extracted?.date
      ? parseNaturalDate(aiResponse.extracted.date) || context.appointmentRequest?.date
      : context.appointmentRequest?.date

    const extractedTime = aiResponse.extracted?.time
      ? parseTime(aiResponse.extracted.time) || context.appointmentRequest?.time
      : context.appointmentRequest?.time

    // Handle different actions
    switch (aiResponse.action) {
      case 'check_availability':
        if (extractedDate && extractedTime) {
          const slots = await getAvailableSlots(context.clinicId, extractedDate)
          const requestedSlot = slots.find(s => s.time === extractedTime)

          if (requestedSlot?.available) {
            return {
              success: true,
              message: aiResponse.message,
              requiresConfirmation: true,
            }
          } else {
            const alternatives = slots.filter(s => s.available).slice(0, 4)
            return {
              success: false,
              message: `Desculpe, o horário das ${extractedTime} não está disponível. Posso oferecer estes horários:`,
              alternatives,
            }
          }
        }
        break

      case 'create_appointment':
        return {
          success: true,
          message: aiResponse.message,
          requiresConfirmation: true,
        }
    }

    return {
      success: true,
      message: aiResponse.message,
    }
  } catch (error) {
    dbLogger.error('Error processing scheduling request', error)
    return {
      success: false,
      message: 'Desculpe, tive um problema para processar sua solicitação. Pode repetir, por favor?',
    }
  }
}

/**
 * Create appointment from context
 */
export async function createAppointmentFromContext(
  context: SchedulerContext
): Promise<SchedulingResult> {
  const db = getDb()

  if (!context.patientId || !context.appointmentRequest?.date || !context.appointmentRequest?.time) {
    return {
      success: false,
      message: 'Informações incompletas para criar o agendamento.',
    }
  }

  try {
    const scheduledAt = new Date(`${context.appointmentRequest.date}T${context.appointmentRequest.time}:00`)

    // Get procedure if specified
    let procedureId: string | null = null
    if (context.appointmentRequest.procedure) {
      const procedureRows = await db
        .select({ id: procedures.id })
        .from(procedures)
        .where(and(
          eq(procedures.clinicId, context.clinicId),
          ilike(procedures.name, `%${context.appointmentRequest.procedure}%`)
        ))
        .limit(1)
      procedureId = procedureRows[0]?.id || null
    }

    // Get dentist if specified
    let dentistId: string | null = null
    if (context.appointmentRequest.dentist) {
      const dentistRows = await db
        .select({ id: dentists.id })
        .from(dentists)
        .where(and(
          eq(dentists.clinicId, context.clinicId),
          ilike(dentists.name, `%${context.appointmentRequest.dentist}%`)
        ))
        .limit(1)
      dentistId = dentistRows[0]?.id || null
    }

    const appointmentResult = await db
      .insert(appointments)
      .values({
        clinicId: context.clinicId,
        patientId: context.patientId,
        dentistId: dentistId ?? null,
        procedureId: procedureId ?? null,
        scheduledAt,
        durationMinutes: 30,
        status: 'scheduled' as any,
        notes: context.appointmentRequest.notes ?? null,
      } as any)
      .returning()

    const appointment = appointmentResult[0]

    if (!appointment) {
      dbLogger.error('Error creating appointment', { context })
      return {
        success: false,
        message: 'Não foi possível criar o agendamento. Por favor, tente novamente.',
      }
    }

    const dateStr = scheduledAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    const timeStr = scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      success: true,
      appointmentId: appointment.id,
      message: `✅ Agendamento confirmado!\n\n📅 ${dateStr}\n⏰ às ${timeStr}\n\nVocê receberá um lembrete por WhatsApp. Até logo!`,
    }
  } catch (error) {
    dbLogger.error('Error creating appointment', error)
    return {
      success: false,
      message: 'Ocorreu um erro ao criar o agendamento. Tente novamente.',
    }
  }
}