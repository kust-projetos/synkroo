/**
 * Smart Triggers Service
 * Automated follow-ups, no-show recovery, patient reactivation, and satisfaction surveys
 */

import { createTypedClient } from '@/lib/supabase/typed'
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
      `Oi ${d.patientName}, senti sua falta hoje! \ud83d\ude14 Quer que eu remarque sua consulta?`,
  },
  post_appointment_1d: {
    type: 'post_appointment_1d', priority: 3,
    cooldownMinutes: 168 * 60, maxPerPatientPerMonth: 4,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Como está se sentindo após ${d.procedureName ?? 'o procedimento'}? Se tiver alguma dúvida, estou aqui! \ud83d\ude0a`,
  },
  satisfaction_survey_7d: {
    type: 'satisfaction_survey_7d', priority: 5,
    cooldownMinutes: 720 * 60, maxPerPatientPerMonth: 1,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Como foi sua experiência conosco? Avalie de 1 a 5 \u2b50 (1=p\u00e9ssimo, 5=excelente)`,
  },
  inactive_30d_check: {
    type: 'inactive_30d_check', priority: 6,
    cooldownMinutes: 720 * 60, maxPerPatientPerMonth: 1,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Faz um tempinho que não te vemos. Como estão seus dentes? \ud83d\ude0a`,
  },
  reactivation_90d: {
    type: 'reactivation_90d', priority: 7,
    cooldownMinutes: 2160 * 60, maxPerPatientPerMonth: 1,
    messageTemplate: (d) =>
      `Oi ${d.patientName}! Faz ${d.daysSince ?? 90} dias que não te vemos. Que tal agendar uma limpeza? Temos horários disponíveis! \ud83e\udcb7`,
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
  private client: Promise<import('@/lib/supabase/typed').TypedSupabaseClient>

  constructor() {
    this.client = createTypedClient()
  }

  /** Returns true when the trigger may be sent (outside cooldown + within monthly quota). */
  async checkCooldown(patientId: string, triggerType: string, cooldownMinutes: number): Promise<boolean> {
    const config = TRIGGER_CONFIGS[triggerType as TriggerType]
    const maxPerMonth = config?.maxPerPatientPerMonth ?? 4

    const { data: recent, error: coolErr } = await (await this.client)
      .from('smart_trigger_log').select('id')
      .eq('patient_id', patientId).eq('trigger_type', triggerType)
      .gte('created_at', nowMinus(cooldownMinutes)).limit(1)

    if (coolErr) { dbLogger.error('Cooldown query failed', coolErr, { patientId, triggerType }); return false }
    if (recent && recent.length > 0) return false

    const { data: monthLogs, error: quotaErr } = await (await this.client)
      .from('smart_trigger_log').select('id')
      .eq('patient_id', patientId).eq('trigger_type', triggerType)
      .gte('created_at', nowMinus(30 * 24 * 60))

    if (quotaErr) { dbLogger.error('Quota query failed', quotaErr, { patientId, triggerType }); return false }
    if (monthLogs && monthLogs.length >= maxPerMonth) return false

    return true
  }

  async logTrigger(params: LogTriggerParams): Promise<void> {
    const { error } = await (await this.client).from('smart_trigger_log').insert({
      clinic_id: params.clinicId, patient_id: params.patientId,
      appointment_id: params.appointmentId ?? null,
      trigger_type: params.triggerType,
      priority: params.priority ?? TRIGGER_CONFIGS[params.triggerType].priority,
      message_sent: params.messageSent,
      channel: params.channel ?? 'whatsapp', status: 'sent',
    })
    if (error) dbLogger.error('Failed to log trigger', error, { triggerType: params.triggerType })
  }

  async recordResponse(triggerLogId: string, response: string): Promise<void> {
    const { error } = await (await this.client).from('smart_trigger_log').update({
      patient_responded: true, response_at: new Date().toISOString(), patient_response: response,
    }).eq('id', triggerLogId)
    if (error) dbLogger.error('Failed to record trigger response', error, { triggerLogId })
  }

  // -- Shared appointment-based trigger runner ------------------------------

  private async processAppointmentTrigger(
    triggerType: TriggerType,
    status: string,
    dateFrom: string,
    dateTo: string,
    extraFields: string = '',
  ): Promise<TriggerSummary> {
    const summary: TriggerSummary = { triggerType, sent: 0, skipped: 0, errors: 0 }
    const config = TRIGGER_CONFIGS[triggerType]

    const selectFields = `id, patient_id, clinic_id, appointment_date${extraFields ? `, ${extraFields}` : ''}`
    const { data: appointments, error } = await (await this.client)
      .from('appointments')
      .select(selectFields)
      .eq('status', status)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)

    if (error) { dbLogger.error(`${triggerType} query failed`, error); summary.errors++; return summary }

    for (const appt of (appointments ?? []) as any[]) {
      // Fetch patient and clinic info separately (typed client doesn't support joins)
      const { data: patient } = await (await this.client)
        .from('patients')
        .select('name, phone')
        .eq('id', appt.patient_id)
        .single()
      const { data: clinic } = await (await this.client)
        .from('clinics')
        .select('name, phone')
        .eq('id', appt.clinic_id)
        .single()
      if (!patient?.phone) { summary.skipped++; continue }

      const canSend = await this.checkCooldown(appt.patient_id, triggerType, config.cooldownMinutes)
      if (!canSend) { summary.skipped++; continue }

      const data: TriggerData = {
        patientName: patient.name, patientPhone: patient.phone,
        clinicName: clinic?.name ?? '', clinicPhone: clinic?.phone ?? '',
        procedureName: (appt as any).procedure_name ?? undefined,
        dentistName: (appt as any).dentist_name ?? undefined,
      }
      const message = config.messageTemplate(data)

      try {
        await sendWhatsAppMessage(patient.phone, message)
        await this.logTrigger({
          clinicId: appt.clinic_id, patientId: appt.patient_id,
          appointmentId: appt.id, triggerType, messageSent: message,
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
    return this.processAppointmentTrigger('post_appointment_1d', 'completed', startOfDay(1), endOfDay(1), 'procedure_name, dentist_name')
  }

  async processSatisfactionSurvey(): Promise<TriggerSummary> {
    return this.processAppointmentTrigger('satisfaction_survey_7d', 'completed', startOfDay(7), endOfDay(7))
  }

  async processInactivePatients(): Promise<TriggerSummary[]> {
    const results: TriggerSummary[] = []

    for (const { daysAgo, triggerType } of [
      { daysAgo: 30, triggerType: 'inactive_30d_check' as TriggerType },
      { daysAgo: 90, triggerType: 'reactivation_90d' as TriggerType },
    ]) {
      const summary: TriggerSummary = { triggerType, sent: 0, skipped: 0, errors: 0 }
      const config = TRIGGER_CONFIGS[triggerType]

      const { data: patients, error } = await (await this.client)
        .from('patients')
        .select('id, name, phone, last_visit_at, clinic_id')
        .not('last_visit_at', 'is', null)
        .lte('last_visit_at', nowMinus(daysAgo * 24 * 60))

      if (error) { dbLogger.error('Inactive patients query failed', error, { triggerType }); summary.errors++; results.push(summary); continue }

      for (const p of (patients ?? []) as any[]) {
        if (!p.phone) { summary.skipped++; continue }
        const canSend = await this.checkCooldown(p.id, triggerType, config.cooldownMinutes)
        if (!canSend) { summary.skipped++; continue }

        // Fetch clinic info separately (typed client doesn't support joins)
        const { data: clinicRow } = await (await this.client)
          .from('clinics')
          .select('name, phone')
          .eq('id', p.clinic_id)
          .single()
        const clinic = clinicRow as any
        const daysSince = Math.floor((Date.now() - new Date(p.last_visit_at).getTime()) / 86_400_000)
        const data: TriggerData = {
          patientName: p.name, patientPhone: p.phone,
          clinicName: clinic?.name ?? '', clinicPhone: clinic?.phone ?? '', daysSince,
        }
        const message = config.messageTemplate(data)

        try {
          await sendWhatsAppMessage(p.phone, message)
          await this.logTrigger({ clinicId: p.clinic_id, patientId: p.id, triggerType, messageSent: message })
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
