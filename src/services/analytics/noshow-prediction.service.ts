/**
 * No-Show Prediction Service — migrated to Drizzle.
 * Predicts the likelihood of a patient not showing up for an appointment.
 */

import { eq, and, gte, lte, inArray, desc, asc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointments, patients } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface NoShowPrediction {
  patient_id: string
  patient_name: string
  appointment_id?: string
  scheduled_at: string
  risk_score: number
  riskLevel: 'low' | 'medium' | 'high'
  factors: RiskFactor[]
  recommendations: string[]
}

export interface RiskFactor {
  name: string
  impact: number
  description: string
}

interface PatientHistory {
  total_appointments: number
  completed: number
  cancelled: number
  no_shows: number
  last_visit: string | null
  average_confirmation_time: number | null
}

// ══════════════════════════════════════
// Pure functions (data-access-free)
// ══════════════════════════════════════

/** Get patient's appointment history — Drizzle. */
async function getPatientHistory(patientId: string): Promise<PatientHistory> {
  const db = getDb()
  try {
    const rows = await db
      .select({
        status: appointments.status,
        scheduledAt: appointments.scheduledAt,
        confirmationSentAt: appointments.confirmationSentAt,
      })
      .from(appointments)
      .where(eq(appointments.patientId, patientId))

    const total = rows.length
    const completed = rows.filter(a => a.status === 'completed').length
    const cancelled = rows.filter(a => a.status === 'cancelled').length
    const no_shows = rows.filter(a => a.status === 'no_show').length

    const completedAppts = rows.filter(a => a.status === 'completed')
    const lastVisit = completedAppts.length > 0
      ? completedAppts.sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0))[0].scheduledAt?.toISOString() ?? null
      : null

    const confirmedAppts = rows.filter(a => a.confirmationSentAt && a.scheduledAt && a.scheduledAt > a.confirmationSentAt)
    let avgConfirmationTime: number | null = null
    if (confirmedAppts.length > 0) {
      const totalHours = confirmedAppts.reduce((sum, a) => {
        const scheduled = a.scheduledAt!.getTime()
        const confirmed = a.confirmationSentAt!.getTime()
        return sum + (scheduled - confirmed) / (1000 * 60 * 60)
      }, 0)
      avgConfirmationTime = Math.round((totalHours / confirmedAppts.length) * 10) / 10
    }

    return { total_appointments: total, completed, cancelled, no_shows, last_visit: lastVisit, average_confirmation_time: avgConfirmationTime }
  } catch (error) {
    dbLogger.error('Error fetching patient history', error)
    return { total_appointments: 0, completed: 0, cancelled: 0, no_shows: 0, last_visit: null, average_confirmation_time: null }
  }
}

function calculateHistoryRisk(history: PatientHistory): RiskFactor {
  const { total_appointments, no_shows, cancelled } = history
  if (total_appointments === 0) return { name: 'new_patient', impact: 0.2, description: 'Paciente novo sem histórico' }
  const noShowRate = no_shows / total_appointments
  const cancelRate = cancelled / total_appointments
  if (noShowRate >= 0.3) return { name: 'patient_history', impact: 0.5, description: `Alta taxa de no-show: ${Math.round(noShowRate * 100)}%` }
  if (noShowRate >= 0.15) return { name: 'patient_history', impact: 0.3, description: `Taxa moderada de no-show: ${Math.round(noShowRate * 100)}%` }
  if (cancelRate >= 0.3) return { name: 'patient_history', impact: 0.25, description: `Alta taxa de cancelamento: ${Math.round(cancelRate * 100)}%` }
  return { name: 'patient_history', impact: 0, description: 'Histórico bom de comparecimento' }
}

function calculateTimingRisk(scheduledAt: string): RiskFactor {
  const scheduled = new Date(scheduledAt)
  const hour = scheduled.getHours()
  const dayOfWeek = scheduled.getDay()
  const now = new Date()
  let impact = 0
  const factors: string[] = []
  if (hour < 9) { impact += 0.15; factors.push('Horário muito cedo') }
  if (hour >= 17) { impact += 0.1; factors.push('Horário tardio') }
  if (dayOfWeek === 1 || dayOfWeek === 5) { impact += 0.1; factors.push(dayOfWeek === 1 ? 'Segunda-feira' : 'Sexta-feira') }
  const daysUntil = Math.floor((scheduled.getTime() - now.getTime()) / 86400000)
  if (daysUntil > 14) { impact += 0.15; factors.push('Agendamento muito antecipado') }
  else if (daysUntil < 1) { impact += 0.1; factors.push('Agendamento de última hora') }
  return { name: 'timing', impact: Math.min(impact, 0.5), description: factors.length > 0 ? factors.join(', ') : 'Horário favorável' }
}

function calculateInactivityRisk(lastVisit: string | null): RiskFactor {
  if (!lastVisit) return { name: 'inactivity', impact: 0.2, description: 'Paciente nunca compareceu' }
  const daysSinceVisit = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)
  if (daysSinceVisit > 365) return { name: 'inactivity', impact: 0.35, description: `Sem visita há ${Math.floor(daysSinceVisit / 30)} meses` }
  if (daysSinceVisit > 180) return { name: 'inactivity', impact: 0.2, description: `Sem visita há ${Math.floor(daysSinceVisit / 30)} meses` }
  if (daysSinceVisit > 90) return { name: 'inactivity', impact: 0.1, description: 'Paciente um pouco inativo' }
  return { name: 'inactivity', impact: 0, description: 'Paciente ativo' }
}

function generateRecommendations(factors: RiskFactor[], riskScore: number): string[] {
  const recs: string[] = []
  if (riskScore >= 50) { recs.push('Considerar ligação de confirmação 24h antes', 'Enviar lembrete por WhatsApp no dia anterior') }
  else if (riskScore >= 30) { recs.push('Enviar lembrete por WhatsApp 24h antes') }
  const hf = factors.find(f => f.name === 'patient_history')
  if (hf && hf.impact > 0.3) recs.push('Pedir confirmação por mensagem')
  const tf = factors.find(f => f.name === 'timing')
  if (tf && tf.impact > 0.2) recs.push('Oferecer opção de reagendamento se necessário')
  const inf = factors.find(f => f.name === 'inactivity')
  if (inf && inf.impact > 0.2) recs.push('Considerar taxa de reagendamento flexível')
  return [...new Set(recs)]
}

interface ApptHistoryRow {
  status: string; scheduled_at: string; confirmation_sent_at: string | null; patient_id: string
}
function buildPatientHistoryMap(raw: ApptHistoryRow[]): Map<string, PatientHistory> {
  const grouped = new Map<string, ApptHistoryRow[]>()
  for (const a of raw) {
    const list = grouped.get(a.patient_id) || []; list.push(a); grouped.set(a.patient_id, list)
  }
  const map = new Map<string, PatientHistory>()
  for (const [pid, appts] of grouped) {
    const total = appts.length
    const completed = appts.filter(a => a.status === 'completed').length
    const cancelled = appts.filter(a => a.status === 'cancelled').length
    const no_shows = appts.filter(a => a.status === 'no_show').length
    const completedAppts = appts.filter(a => a.status === 'completed')
    const lastVisit = completedAppts.length > 0
      ? completedAppts.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0].scheduled_at
      : null
    const confirmedAppts = appts.filter(a => a.confirmation_sent_at && new Date(a.scheduled_at) > new Date(a.confirmation_sent_at))
    let avgConf = null as number | null
    if (confirmedAppts.length > 0) {
      const totalH = confirmedAppts.reduce((s, a) => s + (new Date(a.scheduled_at).getTime() - new Date(a.confirmation_sent_at!).getTime()) / 3600000, 0)
      avgConf = Math.round((totalH / confirmedAppts.length) * 10) / 10
    }
    map.set(pid, { total_appointments: total, completed, cancelled, no_shows, last_visit: lastVisit, average_confirmation_time: avgConf })
  }
  return map
}

// ══════════════════════════════════════
// Main exports
// ══════════════════════════════════════

export async function predictNoShowRisk(patientId: string, scheduledAt: string, _procedureId?: string): Promise<NoShowPrediction> {
  const db = getDb()
  try {
    const [pt] = await db
      .select({ id: patients.id, name: patients.name, riskScore: patients.riskScore })
      .from(patients).where(eq(patients.id, patientId))

    const history = await getPatientHistory(patientId)
    const factors: RiskFactor[] = [
      calculateHistoryRisk(history),
      calculateTimingRisk(scheduledAt),
      calculateInactivityRisk(history.last_visit),
    ]
    if (pt && Number(pt.riskScore ?? 0) > 0) {
      factors.push({ name: 'base_risk', impact: Number(pt.riskScore) / 100, description: `Score de risco base: ${pt.riskScore}` })
    }
    const riskScore = Math.min(Math.round(factors.reduce((s, f) => s + f.impact, 0) * 100), 100)
    const riskLevel: NoShowPrediction['riskLevel'] = riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low'
    return {
      patient_id: patientId,
      patient_name: pt?.name ?? 'Unknown',
      scheduled_at: scheduledAt,
      risk_score: riskScore,
      riskLevel,
      factors,
      recommendations: generateRecommendations(factors, riskScore),
    }
  } catch (err) {
    dbLogger.error('Error predicting no-show risk', err)
    return { patient_id: patientId, patient_name: 'Unknown', scheduled_at: scheduledAt, risk_score: 50, riskLevel: 'medium',
      factors: [{ name: 'error', impact: 0.5, description: 'Erro ao calcular risco' }], recommendations: ['Verificar dados do paciente'] }
  }
}

export async function getUpcomingAppointmentRisks(clinicId: string, days: number = 7): Promise<NoShowPrediction[]> {
  const db = getDb()
  try {
    const startDate = new Date()
    const endDate = new Date(); endDate.setDate(endDate.getDate() + days)

    // Query 1: upcoming appointments with patient data (leftJoin)
    const upcoming = await db
      .select({
        id: appointments.id,
        scheduledAt: appointments.scheduledAt,
        patientId: appointments.patientId,
        patientName: patients.name,
        patientRiskScore: patients.riskScore,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          inArray(appointments.status as any, ['scheduled', 'confirmed']),
          gte(appointments.scheduledAt, startDate),
          lte(appointments.scheduledAt, endDate),
        ),
      )
      .orderBy(asc(appointments.scheduledAt))

    if (!upcoming.length) return []

    const patientIdSet = new Set(upcoming.map(a => a.patientId))
    const patientIds = [...patientIdSet]

    // Query 2: batch-fetch history
    const historyRows = await db
      .select({
        status: appointments.status,
        scheduled_at: appointments.scheduledAt,
        confirmation_sent_at: appointments.confirmationSentAt,
        patient_id: appointments.patientId,
      })
      .from(appointments)
      .where(inArray(appointments.patientId, patientIds))

    const historyMap = buildPatientHistoryMap(
      historyRows.map(r => ({
        status: r.status,
        scheduled_at: (r.scheduled_at as any)?.toISOString?.() ?? String(r.scheduled_at),
        confirmation_sent_at: (r.confirmation_sent_at as any)?.toISOString?.() ?? (r.confirmation_sent_at ? String(r.confirmation_sent_at) : null),
        patient_id: r.patient_id,
      }))
    )

    const predictions: NoShowPrediction[] = []
    for (const apt of upcoming) {
      if (!apt.patientName) continue
      const history = historyMap.get(apt.patientId) || { total_appointments: 0, completed: 0, cancelled: 0, no_shows: 0, last_visit: null, average_confirmation_time: null }
      const factors: RiskFactor[] = [
        calculateHistoryRisk(history),
        calculateTimingRisk(apt.scheduledAt?.toISOString?.() ?? String(apt.scheduledAt)),
        calculateInactivityRisk(history.last_visit),
      ]
      const riskScoreNum = Number(apt.patientRiskScore ?? 0)
      if (riskScoreNum > 0) factors.push({ name: 'base_risk', impact: riskScoreNum / 100, description: `Score de risco base: ${riskScoreNum}` })
      const riskScore = Math.min(Math.round(factors.reduce((s, f) => s + f.impact, 0) * 100), 100)
      predictions.push({
        patient_id: apt.patientId,
        patient_name: apt.patientName,
        appointment_id: apt.id,
        scheduled_at: apt.scheduledAt?.toISOString?.() ?? String(apt.scheduledAt),
        risk_score: riskScore,
        riskLevel: riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low',
        factors,
        recommendations: generateRecommendations(factors, riskScore),
      })
    }
    return predictions.sort((a, b) => b.risk_score - a.risk_score)
  } catch (err) {
    dbLogger.error('Error getting upcoming appointment risks', err)
    return []
  }
}
