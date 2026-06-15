/**
 * Follow-up Service
 * Handles post-consultation follow-ups, return reminders, and patient retention
 * Migrated from Supabase to Drizzle ORM.
 */

import { eq, and, gte, lte, isNull, isNotNull, inArray, ilike, asc, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import {
  procedureGuidelines,
  patientFeedback,
} from '@/lib/db/schema/core'
import { followUpConfigs } from '@/lib/db/schema/crm'
import { appointments } from '@/lib/db/schema/appointments'
import { clinics, patients, procedures, dentists } from '@/lib/db/schema/core'
import { dbLogger, whatsappLogger } from '@/lib/logger'
import { createFeedback } from '@/repositories/followup'

// -- Types ------------------------------------------------------------------

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

// -- DB operations ----------------------------------------------------------

export async function getProcedureGuidelines(
  clinicId: string,
  procedureName: string,
): Promise<ProcedureGuideline | null> {
  const db = getDb()

  const rows = await db.select()
    .from(procedureGuidelines)
    .where(and(
      eq(procedureGuidelines.clinicId, clinicId),
      ilike(procedureGuidelines.procedureName, `%${procedureName.replace(/[%_\\]/g, '\\$&')}%`),
      eq(procedureGuidelines.isActive, true),
    ))
    .limit(1)

  if (!rows.length) return null
  const r = rows[0]

  return {
    id: r.id,
    clinicId: r.clinicId,
    procedureId: r.procedureId ?? undefined,
    procedureName: r.procedureName,
    title: r.title,
    instructions: r.instructions,
    emergencyContact: r.emergencyContact ?? false,
    recoveryTimeDays: r.recoveryTimeDays ?? undefined,
    restrictions: r.restrictions ?? undefined,
    warningSigns: r.warningSigns ?? undefined,
  }
}

export async function getFollowUpConfig(
  clinicId: string,
  configType: string,
  procedureName?: string,
): Promise<FollowUpConfig | null> {
  const db = getDb()

  // Try procedure-specific config first
  let rows: any[]
  if (procedureName) {
    rows = await db.select()
      .from(followUpConfigs)
      .where(and(
        eq(followUpConfigs.clinicId, clinicId),
        eq(followUpConfigs.configType, configType),
        eq(followUpConfigs.isActive, true),
        ilike(followUpConfigs.procedureName, `%${procedureName.replace(/[%_\\]/g, '\\$&')}%`),
      ))
      .limit(1)
  } else {
    rows = await db.select()
      .from(followUpConfigs)
      .where(and(
        eq(followUpConfigs.clinicId, clinicId),
        eq(followUpConfigs.configType, configType),
        eq(followUpConfigs.isActive, true),
      ))
      .limit(1)
  }

  let cfg = rows[0]

  // Fall back to default config for this type
  if (!cfg) {
    const defaultRows = await db.select()
      .from(followUpConfigs)
      .where(and(
        eq(followUpConfigs.configType, configType),
        isNull(followUpConfigs.procedureName),
        eq(followUpConfigs.isActive, true),
      ))
      .limit(1)

    cfg = defaultRows[0]
    if (!cfg) return null
  }

  return {
    id: cfg.id,
    clinicId: cfg.clinicId,
    configType: cfg.configType as FollowUpConfig['configType'],
    procedureId: cfg.procedureId ?? undefined,
    procedureName: cfg.procedureName ?? undefined,
    delayHours: cfg.delayHours ?? undefined,
    delayDays: cfg.delayDays ?? undefined,
    delayMonths: cfg.delayMonths ?? undefined,
    messageTemplate: cfg.messageTemplate,
  }
}

export async function getAppointmentsNeedingFollowUp(
  hoursAfter: number = 2,
): Promise<PatientFeedback[]> {
  const db = getDb()

  const now = new Date()
  const followUpTime = new Date(now.getTime() - hoursAfter * 60 * 60 * 1000)
  const windowStart = followUpTime
  const windowEnd = new Date(followUpTime.getTime() + 5 * 60 * 1000)

  // Query appointments with inner joins for patients + clinics, left join for dentists/procedures
  const aptRows = await db.select({
    id: appointments.id,
    scheduledAt: appointments.scheduledAt,
    updatedAt: appointments.updatedAt,
    patientId: patients.id,
    patientName: patients.name,
    patientPhone: patients.phone,
    dentistName: dentists.name,
    procedureName: procedures.name,
    clinicId: clinics.id,
    clinicName: clinics.name,
    clinicPhone: clinics.phone,
  })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(clinics, eq(appointments.clinicId, clinics.id))
    .leftJoin(dentists, eq(appointments.dentistId, dentists.id))
    .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
    .where(and(
      eq(appointments.status, 'completed' as any),
      gte(appointments.updatedAt, windowStart),
      lte(appointments.updatedAt, windowEnd),
    ))

  if (!aptRows.length) return []

  // Check which appointments have already received follow-up
  const aptIds = aptRows.map((a) => a.id)
  const sentRows = await db.select({ appointmentId: patientFeedback.appointmentId })
    .from(patientFeedback)
    .where(and(
      inArray(patientFeedback.appointmentId, aptIds),
      eq(patientFeedback.feedbackType, 'post_consultation'),
    ))

  const alreadySent = new Set(sentRows.map((f) => f.appointmentId))

  return aptRows
    .filter((apt) => !alreadySent.has(apt.id))
    .map((apt) => ({
      patientId: apt.patientId || '',
      patientName: apt.patientName || '',
      patientPhone: apt.patientPhone || '',
      appointmentId: apt.id,
      procedureName: apt.procedureName ?? undefined,
      dentistName: apt.dentistName ?? undefined,
      clinicId: apt.clinicId || '',
      clinicName: apt.clinicName || '',
      clinicPhone: apt.clinicPhone || '',
      completedAt: apt.updatedAt ? new Date(apt.updatedAt) : new Date(apt.scheduledAt!),
    }))
}

// -- Formatting + sending ---------------------------------------------------

export function formatFollowUpMessage(
  patient: PatientFeedback,
  config: FollowUpConfig,
  guidelines?: ProcedureGuideline | null,
): string {
  let message = config.messageTemplate
    .replace(/{{patient_name}}/g, patient.patientName)
    .replace(/{{procedure_name}}/g, patient.procedureName || 'consulta')
    .replace(/{{dentist_name}}/g, patient.dentistName || '')
    .replace(/{{clinic_name}}/g, patient.clinicName)
    .replace(/{{clinic_phone}}/g, patient.clinicPhone)

  if (guidelines) {
    message = message.replace(/{{procedure_guidelines}}/g, guidelines.instructions)
  } else {
    message = message.replace(/{{procedure_guidelines}}/g, 'Cuide bem da sua saúde bucal! 🦷')
  }

  return message
}

export async function sendFollowUpMessage(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const whatsappApiUrl = process.env.WHATSAPP_API_URL
    const whatsappToken = process.env.WHATSAPP_TOKEN

    if (!whatsappApiUrl || !whatsappToken) {
      whatsappLogger.warn('WhatsApp API not configured, skipping follow-up')
      return { success: false, error: 'WhatsApp API not configured' }
    }

    let formattedPhone = phone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
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
  await createFeedback({
    clinicId: params.clinicId,
    patientId: params.patientId,
    appointmentId: params.appointmentId,
    feedbackType: params.feedbackType,
    rating: params.rating,
    npsScore: params.npsScore,
    wouldRecommend: params.wouldRecommend,
    comments: params.comments,
    channel: params.channel,
  })
}

// -- Processing -------------------------------------------------------------

export async function processPostConsultationFollowUps(): Promise<{
  processed: number; sent: number; failed: number
}> {
  dbLogger.info('Processing post-consultation follow-ups...')

  const appointmentList = await getAppointmentsNeedingFollowUp(2)

  let sent = 0
  let failed = 0

  for (const appointment of appointmentList) {
    const config = await getFollowUpConfig(
      appointment.clinicId,
      'post_consultation',
      appointment.procedureName,
    )

    if (!config) {
      dbLogger.debug('No follow-up config found', { procedureName: appointment.procedureName })
      continue
    }

    let guidelines = null
    if (appointment.procedureName) {
      guidelines = await getProcedureGuidelines(appointment.clinicId, appointment.procedureName)
    }

    const message = formatFollowUpMessage(appointment, config, guidelines)
    const result = await sendFollowUpMessage(appointment.patientPhone, message)

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

  return { processed: appointmentList.length, sent, failed }
}

/**
 * Get patients needing return reminders.
 * Returns patients with last_visit within a window of target months ago.
 */
export async function getPatientsNeedingReturnReminder(
  monthsSinceLastVisit: number,
): Promise<any[]> {
  const db = getDb()

  const now = new Date()
  const targetDate = new Date(now.getTime() - monthsSinceLastVisit * 30 * 24 * 60 * 60 * 1000)

  // Query patients with clinic info
  const patientRows = await db.select({
    id: patients.id,
    name: patients.name,
    phone: patients.phone,
    lastVisit: patients.lastVisitAt,
    optOutReminders: patients.optOutReminders,
    clinicId: clinics.id,
    clinicName: clinics.name,
    clinicPhone: clinics.phone,
  })
    .from(patients)
    .innerJoin(clinics, eq(patients.clinicId, clinics.id))
    .where(and(
      isNotNull(patients.lastVisitAt),
      gte(patients.lastVisitAt, new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
      lte(patients.lastVisitAt, targetDate),
    ))

  if (!patientRows.length) return []

  // Fetch appointments for these patients (with procedures)
  const patientIds = patientRows.map((p) => p.id)
  const aptRows = await db.select({
    patientId: appointments.patientId,
    id: appointments.id,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    procedureName: procedures.name,
  })
    .from(appointments)
    .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
    .where(inArray(appointments.patientId, patientIds))

  // Group appointments by patient
  const aptsByPatient = new Map<string, any[]>()
  for (const a of aptRows) {
    const arr = aptsByPatient.get(a.patientId) || []
    arr.push(a)
    aptsByPatient.set(a.patientId, arr)
  }

  // Assemble response matching Supabase relational shape
  return patientRows.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    last_visit: p.lastVisit,
    opt_out_reminders: p.optOutReminders,
    clinics: {
      id: p.clinicId,
      name: p.clinicName,
      phone: p.clinicPhone,
    },
    appointments: (aptsByPatient.get(p.id) || []).map((a) => ({
      id: a.id,
      scheduled_at: a.scheduledAt,
      status: a.status,
      procedures: a.procedureName ? { name: a.procedureName } : null,
    })),
  }))
}

export async function processReturnReminders(): Promise<{
  processed: number; sent: number; failed: number
}> {
  dbLogger.info('Processing return reminders...')

  const timeframes = [6, 12]
  let totalProcessed = 0
  let totalSent = 0
  let totalFailed = 0

  for (const months of timeframes) {
    const patientList = await getPatientsNeedingReturnReminder(months)

    for (const patient of patientList) {
      const lastAppointment = (patient as any).appointments
        ?.filter((a: any) => a.status === 'completed')
        .sort((a: any, b: any) =>
          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
        )[0]

      const procedureName = lastAppointment?.procedures?.name
      const clinicId = patient.clinics?.id

      const config = await getFollowUpConfig(
        clinicId,
        'return_reminder',
        procedureName,
      )

      if (!config) continue

      const message = config.messageTemplate.replace(
        /{{patient_name}}/g,
        patient.name,
      )

      if (patient.opt_out_reminders) {
        dbLogger.debug(`Skipping ${patient.name} - opted out of reminders`)
        continue
      }

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

  return { processed: totalProcessed, sent: totalSent, failed: totalFailed }
}

export async function processAllFollowUps(): Promise<void> {
  dbLogger.info('Starting follow-up processing...')

  const postResult = await processPostConsultationFollowUps()
  dbLogger.info('Post-consultation complete', { sent: postResult.sent, failed: postResult.failed })

  const reminderResult = await processReturnReminders()
  dbLogger.info('Return reminders complete', { sent: reminderResult.sent, failed: reminderResult.failed })

  dbLogger.info('Follow-up processing complete')
}
