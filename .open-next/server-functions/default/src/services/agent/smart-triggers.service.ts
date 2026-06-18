/**
 * Smart Triggers Service
 * Automated follow-ups, no-show recovery, patient reactivation, and satisfaction surveys
 * Migrated from Supabase to Drizzle ORM.
 */

import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { smartTriggerLog, appointments, patients, clinics, procedures, dentists } from '@/lib/db/schema'
import { sendWhatsAppMessage } from '@/services/whatsapp'
import { dbLogger } from '@/lib/logger'

// -- Types -------------------------------------------------------------------

type TriggerType =
  | 'no_show_recovery_1h'
  | 'post_appointment_1d'
  | 'satisfaction_survey_7d'
  | 'inactive_30d_check'
  | 'reactivation_90d'
  | 'budget_followup_3d'

interface TriggerData {
  patientName: string
  patientPhone: string
  clinicName: string
  clinicPhone: string
  dentistName?: string
  procedureName?: string
  appointmentDate?: string
  daysSince?: number
}

interface TriggerConfig {
  type: TriggerType
  priority: number
  cooldownMinutes: number
  maxPerPatientPerMonth: number
  messageTemplate: (data: TriggerData) => string
}

interface TriggerSummary {
  triggerType: TriggerType
  sent: number
  skipped: number
  errors: number
}

interface LogTriggerParams {
  clinicId: string
  patientId: string
  appointmentId?: string
  triggerType: TriggerType
  priority?: number
  messageSent: string
  channel?: string
}

// -- Configs -----------------------------------------------------------------

const TRIGGER_CONFIGS: Record<TriggerType, TriggerConfig> = {
  no_show_recovery_1h: {
    type: 'no_show_recovery_1h', priority: 2,
    cooldownMinutes: 24 * 60, maxPerPatientPerMonth: 2,
    messageTemplate: (d) =>
      `Oi ${d.patientName}, senti sua falta hoje! 😔 Quer que eu remarque sua consulta?`,
  },
  post_appointment_1d: {
    type: 'post_appointment_1d', priority: 3,
    cooldownMinutes: 168 * 60, maxPerPatientPerMonth: 4,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Como está se sentindo após ${d.procedureName ?? 'o procedimento'}? Se tiver alguma dúvida, estou aqui! 😊`,
  },
  satisfaction_survey_7d: {
    type: 'satisfaction_survey_7d', priority: 5,
    cooldownMinutes: 720 * 60, maxPerPatientPerMonth: 1,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Como foi sua experiência conosco? Avalie de 1 a 5 ⭐ (1=péssimo, 5=excelente)`,
  },
  inactive_30d_check: {
    type: 'inactive_30d_check', priority: 6,
    cooldownMinutes: 720 * 60, maxPerPatientPerMonth: 1,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Faz um tempinho que não te vemos. Como estão seus dentes? 😊`,
  },
  reactivation_90d: {
    type: 'reactivation_90d', priority: 7,
    cooldownMinutes: 2160 * 60, maxPerPatientPerMonth: 1,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Faz ${d.daysSince ?? 90} dias que não te vemos. Que tal agendar uma limpeza? Temos horários disponíveis! 🦷`,
  },
  budget_followup_3d: {
    type: 'budget_followup_3d', priority: 4,
    cooldownMinutes: 72 * 60, maxPerPatientPerMonth: 3,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Gostaria de saber se teve oportunidade de avaliar o orçamento. Podemos ajustar se necessário!`,
  },
}

// -- Helpers -----------------------------------------------------------------

function nowMinus(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function startOfDay(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0); return d.toISOString()
}

function endOfDay(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  d.setHours(23, 59, 59, 999); return d.toISOString()
}

// -- Service -----------------------------------------------------------------

class SmartTriggersService {

  /** Returns true when the trigger may be sent (outside cooldown + within monthly quota). */
  async checkCooldown(patientId: string, triggerType: string, cooldownMinutes: number): Promise<boolean> {
    const config = TRIGGER_CONFIGS[triggerType as TriggerType]
    const maxPerMonth = config?.maxPerPatientPerMonth ?? 4
    const db = getDb()

    // Check cooldown
    const cooldownCutoff = new Date(Date.now() - cooldownMinutes * 60_000)
    const recent = await db.select({ id: smartTriggerLog.id })
      .from(smartTriggerLog)
      .where(and(
        eq(smartTriggerLog.patientId, patientId),
        eq(smartTriggerLog.triggerType, triggerType),
        gte(smartTriggerLog.createdAt, cooldownCutoff),
      ))
      .limit(1)

    if (recent.length > 0) return false

    // Check monthly quota
    const monthCutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000)
    const monthLogs = await db.select({ id: smartTriggerLog.id })
      .from(smartTriggerLog)
      .where(and(
        eq(smartTriggerLog.patientId, patientId),
        eq(smartTriggerLog.triggerType, triggerType),
        gte(smartTriggerLog.createdAt, monthCutoff),
      ))

    if (monthLogs.length >= maxPerMonth) return false

    return true
  }

  async logTrigger(params: LogTriggerParams): Promise<void> {
    const db = getDb()
    try {
      await db.insert(smartTriggerLog).values({
        clinicId: params.clinicId,
        patientId: params.patientId,
        appointmentId: params.appointmentId ?? null,
        triggerType: params.triggerType,
        priority: params.priority ?? TRIGGER_CONFIGS[params.triggerType].priority,
        messageSent: params.messageSent,
        channel: params.channel ?? 'whatsapp',
        status: 'sent',
      })
    } catch (error) {
      dbLogger.error('Failed to log trigger', error, { triggerType: params.triggerType })
    }
  }

  async recordResponse(triggerLogId: string, response: string): Promise<void> {
    const db = getDb()
    try {
      await db.update(smartTriggerLog)
        .set({
          patientResponded: true,
          responseAt: new Date(),
          patientResponse: response,
        })
        .where(eq(smartTriggerLog.id, triggerLogId))
    } catch (error) {
      dbLogger.error('Failed to record trigger response', error, { triggerLogId })
    }
  }

  // -- Shared appointment-based trigger runner ------------------------------

  private async processAppointmentTrigger(
    triggerType: TriggerType,
    status: string,
    dateFrom: string,
    dateTo: string,
    needsProcedureInfo = false,
  ): Promise<TriggerSummary> {
    const summary: TriggerSummary = { triggerType, sent: 0, skipped: 0, errors: 0 }
    const config = TRIGGER_CONFIGS[triggerType]
    const db = getDb()
    const dateFromDate = new Date(dateFrom)
    const dateToDate = new Date(dateTo)

    const appts = await db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      clinicId: appointments.clinicId,
      scheduledAt: appointments.scheduledAt,
      procedureId: appointments.procedureId,
      dentistId: appointments.dentistId,
    })
      .from(appointments)
      .where(and(
        eq(appointments.status, status as any),
        gte(appointments.scheduledAt, dateFromDate),
        lte(appointments.scheduledAt, dateToDate),
      ))

    for (const appt of appts) {
      // Fetch patient info
      const [patient] = await db.select({ name: patients.name, phone: patients.phone })
        .from(patients)
        .where(eq(patients.id, appt.patientId))
        .limit(1)

      // Fetch clinic info
      const [clinic] = await db.select({ name: clinics.name, phone: clinics.phone })
        .from(clinics)
        .where(eq(clinics.id, appt.clinicId))
        .limit(1)

      if (!patient?.phone) { summary.skipped++; continue }

      const canSend = await this.checkCooldown(appt.patientId, triggerType, config.cooldownMinutes)
      if (!canSend) { summary.skipped++; continue }

      // Resolve procedure/dentist names if needed
      let procedureName: string | undefined
      let dentistName: string | undefined

      if (needsProcedureInfo) {
        if (appt.procedureId) {
          const [proc] = await db.select({ name: procedures.name })
            .from(procedures)
            .where(eq(procedures.id, appt.procedureId))
            .limit(1)
          procedureName = proc?.name
        }
        if (appt.dentistId) {
          const [dentist] = await db.select({ name: dentists.name })
            .from(dentists)
            .where(eq(dentists.id, appt.dentistId))
            .limit(1)
          dentistName = dentist?.name
        }
      }

      const data: TriggerData = {
        patientName: patient.name,
        patientPhone: patient.phone,
        clinicName: clinic?.name ?? '',
        clinicPhone: clinic?.phone ?? '',
        procedureName,
        dentistName,
      }
      const message = config.messageTemplate(data)

      try {
        await sendWhatsAppMessage(patient.phone, message)
        await this.logTrigger({
          clinicId: appt.clinicId,
          patientId: appt.patientId,
          appointmentId: appt.id,
          triggerType,
          messageSent: message,
        })
        summary.sent++
      } catch (err) {
        dbLogger.error(`${triggerType} send failed`, err, { appointmentId: appt.id })
        summary.errors++
      }
    }
    return summary
  }

  // -- Public trigger methods ------------------------------------------------

  async processNoShowRecovery(): Promise<TriggerSummary> {
    return this.processAppointmentTrigger('no_show_recovery_1h', 'no_show', nowMinus(120), nowMinus(60))
  }

  async processPostAppointmentFollowup(): Promise<TriggerSummary> {
    return this.processAppointmentTrigger('post_appointment_1d', 'completed', startOfDay(1), endOfDay(1), true)
  }

  async processSatisfactionSurvey(): Promise<TriggerSummary> {
    return this.processAppointmentTrigger('satisfaction_survey_7d', 'completed', startOfDay(7), endOfDay(7))
  }

  async processInactivePatients(): Promise<TriggerSummary[]> {
    const results: TriggerSummary[] = []
    const db = getDb()

    for (const { daysAgo, triggerType } of [
      { daysAgo: 30, triggerType: 'inactive_30d_check' as TriggerType },
      { daysAgo: 90, triggerType: 'reactivation_90d' as TriggerType },
    ]) {
      const summary: TriggerSummary = { triggerType, sent: 0, skipped: 0, errors: 0 }
      const config = TRIGGER_CONFIGS[triggerType]
      const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60_000)

      const inactivePatients = await db.select({
        id: patients.id,
        name: patients.name,
        phone: patients.phone,
        lastVisitAt: patients.lastVisitAt,
        clinicId: patients.clinicId,
      })
        .from(patients)
        .where(and(
          isNotNull(patients.lastVisitAt),
          lte(patients.lastVisitAt, cutoff),
        ))

      for (const p of inactivePatients) {
        if (!p.phone) { summary.skipped++; continue }
        const canSend = await this.checkCooldown(p.id, triggerType, config.cooldownMinutes)
        if (!canSend) { summary.skipped++; continue }

        // Fetch clinic info
        const [clinic] = await db.select({ name: clinics.name, phone: clinics.phone })
          .from(clinics)
          .where(eq(clinics.id, p.clinicId))
          .limit(1)

        const daysSince = p.lastVisitAt
          ? Math.floor((Date.now() - new Date(p.lastVisitAt).getTime()) / 86_400_000)
          : (daysAgo ?? 90)

        const data: TriggerData = {
          patientName: p.name,
          patientPhone: p.phone,
          clinicName: clinic?.name ?? '',
          clinicPhone: clinic?.phone ?? '',
          daysSince,
        }
        const message = config.messageTemplate(data)

        try {
          await sendWhatsAppMessage(p.phone, message)
          await this.logTrigger({ clinicId: p.clinicId, patientId: p.id, triggerType, messageSent: message })
          summary.sent++
        } catch (err) {
          dbLogger.error('Inactive trigger send failed', err, { patientId: p.id, triggerType })
          summary.errors++
        }
      }
      results.push(summary)
    }
    return results
  }

  // -- Run all triggers -----------------------------------------------------

  async processAll(): Promise<TriggerSummary[]> {
    dbLogger.info('Smart triggers: processing all triggers')

    const summaries: TriggerSummary[] = []
    summaries.push(await this.processNoShowRecovery())
    summaries.push(await this.processPostAppointmentFollowup())
    summaries.push(await this.processSatisfactionSurvey())
    summaries.push(...(await this.processInactivePatients()))

    dbLogger.info('Smart triggers: batch complete', {
      totalSent: summaries.reduce((a, s) => a + s.sent, 0),
      totalSkipped: summaries.reduce((a, s) => a + s.skipped, 0),
      totalErrors: summaries.reduce((a, s) => a + s.errors, 0),
    })
    return summaries
  }
}

export const smartTriggersService = new SmartTriggersService()
