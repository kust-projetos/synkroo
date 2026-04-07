import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger, whatsappLogger } from '@/lib/logger'

/**
 * Follow-up Service
 * Handles post-consultation follow-ups, return reminders, and patient retention
 */

/** Appointment row with joins for follow-up queries */
type FollowupAppointment = {
  id: string
  scheduled_at: string
  updated_at?: string
  patients: { id: string; name: string; phone: string } | null
  procedures: { name: string } | null
  dentists: { name: string } | null
  clinics: { id: string; name: string; phone: string } | null
}

type FeedbackRow = {
  appointment_id: string
}

type PatientAppointments = {
  appointments?: {
    status: string
    scheduled_at: string
    procedures: { name: string } | null
  }[]
  clinics?: { id: string; name: string } | null
}

export interface ProcedureGuideline {
  id: string
  clinicId: string
  procedureId?: string
  procedureName: string
  title: string
  instructions: string
  emergencyContact: boolean
  recoveryTimeDays?: number
  restrictions?: string[]
  warningSigns?: string[]
}

export interface FollowUpConfig {
  id: string
  clinicId: string
  configType: 'post_consultation' | 'return_reminder' | 'budget_follow_up'
  procedureId?: string
  procedureName?: string
  delayHours?: number
  delayDays?: number
  delayMonths?: number
  messageTemplate: string
}

export interface PatientFeedback {
  patientId: string
  patientName: string
  patientPhone: string
  appointmentId?: string
  procedureName?: string
  dentistName?: string
  clinicId: string
  clinicName: string
  clinicPhone: string
  completedAt: Date
}

/**
 * Get procedure guidelines for a specific procedure
 */
export async function getProcedureGuidelines(
  clinicId: string,
  procedureName: string
): Promise<ProcedureGuideline | null> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('procedure_guidelines')
    .select('*')
    .eq('clinic_id', clinicId)
    .ilike('procedure_name', `%${procedureName.replace(/[%_\\]/g, '\\$&')}%`)
    .eq('is_active', true)
    .single() as any

  if (error || !data) return null

  return {
    id: (data as any).id,
    clinicId: (data as any).clinic_id,
    procedureId: (data as any).procedure_id,
    procedureName: (data as any).procedure_name,
    title: (data as any).title,
    instructions: data.instructions,
    emergencyContact: data.emergency_contact,
    recoveryTimeDays: data.recovery_time_days,
    restrictions: data.restrictions,
    warningSigns: data.warning_signs,
  }
}

/**
 * Get follow-up configuration
 */
export async function getFollowUpConfig(
  clinicId: string,
  configType: string,
  procedureName?: string
): Promise<FollowUpConfig | null> {
  const supabase = await createTypedClient()

  let query = supabase
    .from('follow_up_configs')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('config_type', configType)
    .eq('is_active', true)

  if (procedureName) {
    query = query.ilike('procedure_name', `%${procedureName.replace(/[%_\\]/g, '\\$&')}%`)
  }

  const { data: initialData, error } = await query.single()

  let configData = initialData

  if (error || !configData) {
    // Fall back to default config for this type
    const { data: defaultConfig } = await supabase
      .from('follow_up_configs')
      .select('*')
      .eq('config_type', configType)
      .is('procedure_name', null)
      .eq('is_active', true)
      .limit(1)
      .single() as any

    if (!defaultConfig) return null

    configData = defaultConfig as any
  }

  const cfg = configData as any
  return {
    id: cfg.id,
    clinicId: cfg.clinic_id,
    configType: cfg.config_type,
    procedureId: cfg.procedure_id,
    procedureName: cfg.procedure_name,
    delayHours: cfg.delay_hours,
    delayDays: cfg.delay_days,
    delayMonths: cfg.delay_months,
    messageTemplate: cfg.message_template,
  }
}

/**
 * Get completed appointments that need post-consultation follow-up
 */
export async function getAppointmentsNeedingFollowUp(
  hoursAfter: number = 2
): Promise<PatientFeedback[]> {
  const supabase = await createTypedClient()

  const now = new Date()
  const followUpTime = new Date(now.getTime() - hoursAfter * 60 * 60 * 1000)

  // Window of 5 minutes
  const windowStart = followUpTime
  const windowEnd = new Date(followUpTime.getTime() + 5 * 60 * 1000)

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      updated_at,
      patients!inner (id, name, phone),
      dentists (name),
      procedures (name),
      clinics!inner (id, name, phone)
    `)
    .eq('status', 'completed')
    .gte('updated_at', windowStart.toISOString())
    .lte('updated_at', windowEnd.toISOString())

  if (error) {
    dbLogger.error('Error fetching appointments for follow-up', error)
    return []
  }

  // Check which appointments have already received follow-up
  const { data: sentFollowUps } = await supabase
    .from('patient_feedback')
    .select('appointment_id')
    .in('appointment_id', appointments?.map((a: FollowupAppointment) => a.id) || [])
    .eq('feedback_type', 'post_consultation')

  const alreadySent = new Set(sentFollowUps?.map((f: FeedbackRow) => f.appointment_id) || [])

  return (appointments || [])
    .filter((apt: FollowupAppointment) => !alreadySent.has(apt.id))
    .map((apt: FollowupAppointment) => ({
      patientId: apt.patients?.id || '',
      patientName: apt.patients?.name || '',
      patientPhone: apt.patients?.phone || '',
      appointmentId: apt.id,
      procedureName: apt.procedures?.name,
      dentistName: apt.dentists?.name,
      clinicId: apt.clinics?.id || '',
      clinicName: apt.clinics?.name || '',
      clinicPhone: apt.clinics?.phone || '',
      completedAt: new Date(apt.updated_at ?? apt.scheduled_at),
    }))
}

/**
 * Format follow-up message with procedure guidelines
 */
export function formatFollowUpMessage(
  patient: PatientFeedback,
  config: FollowUpConfig,
  guidelines?: ProcedureGuideline | null
): string {
  let message = config.messageTemplate
    .replace(/{{patient_name}}/g, patient.patientName)
    .replace(/{{procedure_name}}/g, patient.procedureName || 'consulta')
    .replace(/{{dentist_name}}/g, patient.dentistName || '')
    .replace(/{{clinic_name}}/g, patient.clinicName)
    .replace(/{{clinic_phone}}/g, patient.clinicPhone)

  // Replace procedure guidelines placeholder
  if (guidelines) {
    message = message.replace(/{{procedure_guidelines}}/g, guidelines.instructions)
  } else {
    message = message.replace(/{{procedure_guidelines}}/g, 'Cuide bem da sua saúde bucal! 🦷')
  }

  return message
}

/**
 * Send follow-up message via WhatsApp
 */
export async function sendFollowUpMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const whatsappApiUrl = process.env.WHATSAPP_API_URL
    const whatsappToken = process.env.WHATSAPP_TOKEN

    if (!whatsappApiUrl || !whatsappToken) {
      whatsappLogger.warn('WhatsApp API not configured, skipping follow-up')
      return { success: false, error: 'WhatsApp API not configured' }
    }

    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      whatsappLogger.error('WhatsApp API error', null, { data })
      return { success: false, error: data.error?.message || 'Failed to send message' }
    }

    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (error) {
    whatsappLogger.error('Error sending follow-up', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Record patient feedback
 */
export async function recordPatientFeedback(params: {
  clinicId: string
  patientId: string
  appointmentId?: string
  feedbackType: string
  rating?: number
  npsScore?: number
  wouldRecommend?: boolean
  comments?: string
  channel?: string
}): Promise<void> {
  const supabase = await createTypedClient()

  await (supabase.from('patient_feedback') as any).insert({
    clinic_id: params.clinicId,
    patient_id: params.patientId,
    appointment_id: params.appointmentId,
    feedback_type: params.feedbackType,
    rating: params.rating,
    nps_score: params.npsScore,
    would_recommend: params.wouldRecommend,
    comments: params.comments,
    channel: params.channel || 'whatsapp',
    collected_at: new Date().toISOString(),
  })
}

/**
 * Process post-consultation follow-ups
 */
export async function processPostConsultationFollowUps(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  dbLogger.info('Processing post-consultation follow-ups...')

  const appointments = await getAppointmentsNeedingFollowUp(2)

  let sent = 0
  let failed = 0

  for (const appointment of appointments) {
    // Get follow-up config
    const config = await getFollowUpConfig(
      appointment.clinicId,
      'post_consultation',
      appointment.procedureName
    )

    if (!config) {
      dbLogger.debug('No follow-up config found', { procedureName: appointment.procedureName })
      continue
    }

    // Get procedure guidelines
    let guidelines = null
    if (appointment.procedureName) {
      guidelines = await getProcedureGuidelines(
        appointment.clinicId,
        appointment.procedureName
      )
    }

    // Format message
    const message = formatFollowUpMessage(appointment, config, guidelines)

    // Send message
    const result = await sendFollowUpMessage(appointment.patientPhone, message)

    // Record that follow-up was sent
    await recordPatientFeedback({
      clinicId: appointment.clinicId,
      patientId: appointment.patientId,
      appointmentId: appointment.appointmentId,
      feedbackType: 'post_consultation',
      channel: 'whatsapp',
    })

    if (result.success) {
      sent++
      console.warn(`✓ Follow-up sent to ${appointment.patientName}`)
    } else {
      failed++
      console.error(`✗ Failed to send follow-up to ${appointment.patientName}: ${result.error}`)
    }
  }

  return {
    processed: appointments.length,
    sent,
    failed,
  }
}

/**
 * Get patients needing return reminders
 */
export async function getPatientsNeedingReturnReminder(
  monthsSinceLastVisit: number
): Promise<any[]> {
  const supabase = await createTypedClient()

  const now = new Date()
  const targetDate = new Date(now.getTime() - monthsSinceLastVisit * 30 * 24 * 60 * 60 * 1000)

  // Get patients whose last completed appointment was X months ago
  const { data: patients, error } = await supabase
    .from('patients')
    .select(`
      id,
      name,
      phone,
      last_visit,
      clinics (id, name, phone),
      appointments (
        id,
        scheduled_at,
        status,
        procedures (name)
      )
    `)
    .not('last_visit', 'is', null)
    .gte('last_visit', new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .lte('last_visit', targetDate.toISOString())

  if (error) {
    dbLogger.error('Error fetching patients for return reminder', error)
    return []
  }

  return patients || []
}

/**
 * Process return reminders
 */
export async function processReturnReminders(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  dbLogger.info('Processing return reminders...')

  // Process reminders for different timeframes
  const timeframes = [6, 12] // months

  let totalProcessed = 0
  let totalSent = 0
  let totalFailed = 0

  for (const months of timeframes) {
    const patients = await getPatientsNeedingReturnReminder(months)

    for (const patient of patients) {
      // Get last procedure
      const lastAppointment = (patient as PatientAppointments).appointments
        ?.filter((a) => a.status === 'completed')
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0]

      const procedureName = lastAppointment?.procedures?.name

      // Get config for this procedure
      const config = await getFollowUpConfig(
        patient.clinics?.id,
        'return_reminder',
        procedureName
      )

      if (!config) continue

      // Format message
      const message = config.messageTemplate
        .replace(/{{patient_name}}/g, patient.name)

      // Check opt-out
      if (patient.opt_out_reminders) {
        dbLogger.debug(`Skipping ${patient.name} - opted out of reminders`)
        continue
      }

      // Send reminder
      const result = await sendFollowUpMessage(patient.phone, message)

      totalProcessed++

      if (result.success) {
        totalSent++
        dbLogger.info(`Return reminder sent to ${patient.name} (${months} months)`)
      } else {
        totalFailed++
        dbLogger.error(`Failed to send reminder to ${patient.name}`, null, { error: result.error })
      }
    }
  }

  return {
    processed: totalProcessed,
    sent: totalSent,
    failed: totalFailed,
  }
}

/**
 * Process all follow-ups
 */
export async function processAllFollowUps(): Promise<void> {
  dbLogger.info('Starting follow-up processing...')

  // Post-consultation follow-ups
  const postResult = await processPostConsultationFollowUps()
  dbLogger.info('Post-consultation complete', { sent: postResult.sent, failed: postResult.failed })

  // Return reminders
  const reminderResult = await processReturnReminders()
  dbLogger.info('Return reminders complete', { sent: reminderResult.sent, failed: reminderResult.failed })

  dbLogger.info('Follow-up processing complete')
}