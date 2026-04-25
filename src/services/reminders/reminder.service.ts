import { createTypedClient } from '@/lib/supabase/typed'
import { sendWhatsAppMessage, sendWhatsAppButtons } from '@/services/whatsapp'
import { dbLogger, whatsappLogger } from '@/lib/logger'
import { fillTemplate } from '@/services/whatsapp/message-templates.service'
import { getEffectiveConfig } from './procedure-reminder-config.service'

/**
 * Reminder Service
 * Handles automatic appointment reminders via WhatsApp
 */

/** Appointment row with joins for reminder queries */
type ReminderAppointment = {
  id: string
  scheduled_at: string
  clinic_id: string
  patients: { id: string; name: string; phone: string } | null
  dentists: { name: string } | null
  procedures: { id: string; name: string } | null
  clinics: { name: string; phone: string } | null
}

type SentReminderRow = {
  appointment_id: string
  reminder_type: string
}

export interface ReminderConfig {
  hoursBefore: number // Hours before appointment to send reminder
  channels: ('whatsapp' | 'sms' | 'email')[]
  messageTemplate: string
}

export interface AppointmentReminder {
  appointmentId: string
  patientId: string
  patientName: string
  patientPhone: string
  scheduledAt: Date
  dentistName?: string
  procedureId?: string
  procedureName?: string
  clinicId: string
  clinicName: string
  clinicPhone: string
}

// Default reminder configurations
export const DEFAULT_REMINDER_CONFIGS: ReminderConfig[] = [
  {
    hoursBefore: 24,
    channels: ['whatsapp'],
    messageTemplate: 'lembrete_24h',
  },
  {
    hoursBefore: 2,
    channels: ['whatsapp'],
    messageTemplate: 'lembrete_2h',
  },
]

/**
 * Get appointments that need reminders
 */
export async function getAppointmentsNeedingReminders(
  hoursBefore: number
): Promise<AppointmentReminder[]> {
  const supabase = await createTypedClient()

  // Calculate time window
  const now = new Date()
  const reminderTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000)

  // Window of 5 minutes to account for cron job timing
  const windowStart = reminderTime
  const windowEnd = new Date(reminderTime.getTime() + 5 * 60 * 1000)

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      clinics!inner (id, name, phone),
      patients!inner (id, name, phone),
      dentists (name),
      procedures (id, name)
    `)
    .in('status', hoursBefore === 24 ? ['confirmed', 'scheduled'] : ['confirmed'])
    .gte('scheduled_at', windowStart.toISOString())
    .lte('scheduled_at', windowEnd.toISOString())

  if (error) {
    dbLogger.error('Error fetching appointments for reminders', error)
    return []
  }

  // Check which appointments have already received this reminder
  const { data: sentReminders } = await supabase
    .from('appointment_reminders')
    .select('appointment_id, reminder_type')
    .in('appointment_id', appointments?.map((a: ReminderAppointment) => a.id) || [])
    .eq('reminder_type', `${hoursBefore}h`)

  const alreadySent = new Set(sentReminders?.map((r: SentReminderRow) => r.appointment_id) || [])

  return (appointments || [])
    .filter((apt: ReminderAppointment) => !alreadySent.has(apt.id))
    .map((apt: ReminderAppointment) => ({
      appointmentId: apt.id,
      patientId: apt.patients?.id || '',
      patientName: apt.patients?.name || '',
      patientPhone: apt.patients?.phone || '',
      scheduledAt: new Date(apt.scheduled_at),
      dentistName: apt.dentists?.name,
      procedureId: apt.procedures?.id,
      procedureName: apt.procedures?.name,
      clinicId: apt.clinics?.id || '',
      clinicName: apt.clinics?.name || '',
      clinicPhone: apt.clinics?.phone || '',
    }))
}

/**
 * Format reminder message
 */
export function formatReminderMessage(
  reminder: AppointmentReminder,
  hoursBefore: number
): string {
  const dateStr = reminder.scheduledAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const timeStr = reminder.scheduledAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (hoursBefore === 24) {
    return `🏥 *Lembrete de Consulta - ${reminder.clinicName}*

Olá, ${reminder.patientName}! 👋

Você tem uma consulta agendada para *amanhã*:

📅 *Data:* ${dateStr}
⏰ *Horário:* ${timeStr}
${reminder.dentistName ? `👨‍⚕️ *Profissional:* Dr(a). ${reminder.dentistName}` : ''}
${reminder.procedureName ? `🦷 *Procedimento:* ${reminder.procedureName}` : ''}

Por favor, confirme sua presença respondendo esta mensagem ou ligando para ${reminder.clinicPhone}.

Em caso de impossibilidade, avise-nos com antecedência para reagendamento.`
  }

  if (hoursBefore === 2) {
    return `🏥 *Sua consulta é em 2 horas!*

${reminder.patientName}, não se esqueça:

📅 *Hoje* às *${timeStr}*
${reminder.dentistName ? `👨‍⚕️ Dr(a). ${reminder.dentistName}` : ''}

📍 ${reminder.clinicName}

Estamos te esperando! Se precisar cancelar ou reagendar, ligue: ${reminder.clinicPhone}`
  }

  return `Olá ${reminder.patientName}, você tem uma consulta agendada para ${dateStr} às ${timeStr}.`
}

/**
 * Send reminder via WhatsApp
 */
export async function sendWhatsAppReminder(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const result = await sendWhatsAppMessage(phone, message)
    if (result.success) {
      whatsappLogger.info('WhatsApp reminder sent', { phone })
    }
    return result
  } catch (error) {
    whatsappLogger.error('Error sending WhatsApp reminder', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Record that a reminder was sent
 */
export async function recordReminderSent(
  appointmentId: string,
  reminderType: string,
  channel: string,
  success: boolean,
  messageId?: string,
  error?: string
): Promise<void> {
  const supabase = await createTypedClient()

  await (supabase.from('appointment_reminders') as any).insert({
    appointment_id: appointmentId,
    reminder_type: reminderType,
    channel,
    status: success ? 'sent' : 'failed',
    message_id: messageId,
    error_message: error,
    sent_at: new Date().toISOString(),
  })
}

/**
 * Process reminders for a specific time window
 * Uses procedure-specific configs with D-05 defaults
 */
export async function processReminders(hoursBefore: number): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  dbLogger.info(`Processing ${hoursBefore}h reminders...`)

  const appointments = await getAppointmentsNeedingReminders(hoursBefore)

  let sent = 0
  let failed = 0

  for (const appointment of appointments) {
    // Get procedure-specific config or use default
    const effectiveConfig = await getEffectiveConfig(
      appointment.clinicId,
      appointment.procedureId || '',
      appointment.procedureName || ''
    )

    // Format placeholder values
    const dataStr = appointment.scheduledAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const horarioStr = appointment.scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Replace placeholders in custom template
    const filledMessage = fillTemplate(
      { body: effectiveConfig.message_template } as any,
      {
        paciente_nome: appointment.patientName,
        data: dataStr,
        horario: horarioStr,
        dentista: appointment.dentistName || '',
        procedimento: appointment.procedureName || '',
      }
    )

    let result: { success: boolean; messageId?: string; error?: string }

    if (hoursBefore === 24) {
      // 24h reminder: send interactive buttons for confirmation
      const dateStr = appointment.scheduledAt.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
      const timeStr = appointment.scheduledAt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })

      const title = `Lembrete - ${appointment.clinicName}`
      const description =
        `Olá, ${appointment.patientName}! 👋\n\n` +
        `Você tem uma consulta agendada para *amanhã*:\n\n` +
        `📅 *Data:* ${dateStr}\n` +
        `⏰ *Horário:* ${timeStr}\n` +
        (appointment.dentistName ? `👨‍⚕️ *Profissional:* Dr(a). ${appointment.dentistName}\n` : '') +
        (appointment.procedureName ? `🦷 *Procedimento:* ${appointment.procedureName}\n` : '') +
        `\nPor favor, confirme sua presença:`

      result = await sendWhatsAppButtons(
        appointment.patientPhone,
        title,
        description,
        [
          { id: `confirm_${appointment.appointmentId}`, text: '✅ Confirmar' },
          { id: `cancel_${appointment.appointmentId}`, text: '❌ Cancelar' },
        ]
      )
    } else {
      // Use custom template with replaced placeholders
      result = await sendWhatsAppReminder(appointment.patientPhone, filledMessage)
    }

    await recordReminderSent(
      appointment.appointmentId,
      `${hoursBefore}h`,
      'whatsapp',
      result.success,
      result.messageId,
      result.error
    )

    if (result.success) {
      sent++
      dbLogger.info(`Reminder sent to ${appointment.patientName}`, { phone: appointment.patientPhone })
    } else {
      failed++
      dbLogger.error(`Failed to send reminder to ${appointment.patientName}`, null, { error: result.error })
    }
  }

  return {
    processed: appointments.length,
    sent,
    failed,
  }
}

/**
 * Process all scheduled reminders
 */
export async function processAllReminders(): Promise<void> {
  dbLogger.info('Starting reminder processing...')

  for (const config of DEFAULT_REMINDER_CONFIGS) {
    const result = await processReminders(config.hoursBefore)
    dbLogger.info(`${config.hoursBefore}h reminders complete`, { sent: result.sent, failed: result.failed })
  }

  dbLogger.info('Reminder processing complete')
}