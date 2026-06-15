/** Analytics Service — migrated to Drizzle */
import { eq, and, gte, lt, isNotNull, asc, desc, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointments, patients } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface AppointmentTrend { date: string; total: number; confirmed: number; cancelled: number; no_show: number; completed: number }
export interface HourlyDistribution { hour: number; count: number; percentage: number }
export interface DayOfWeekDistribution { day: string; dayIndex: number; count: number; percentage: number }
export interface PatientRiskAnalysis { patient_id: string; patient_name: string; phone: string; risk_score: number; risk_factors: string[]; last_visit: string | null; total_visits: number; cancelled_count: number; no_show_count: number }
export interface DemandForecast { date: string; predicted_appointments: number; confidence: number; based_on: string }
export interface ClinicInsights {
  appointmentTrends: AppointmentTrend[]; hourlyDistribution: HourlyDistribution[]; dayOfWeekDistribution: DayOfWeekDistribution[]
  highRiskPatients: PatientRiskAnalysis[]; demandForecast: DemandForecast[]
  metrics: { avgAppointmentsPerDay: number; peakHour: number; peakDay: string; cancellationRate: number; noShowRate: number; avgConfirmationTime: number }
}

export async function getAppointmentTrends(clinicId: string, days = 30): Promise<AppointmentTrend[]> {
  const db = getDb()
  const startDate = new Date(); startDate.setDate(startDate.getDate() - days)
  try {
    const rows = await db.select({ scheduledAt: appointments.scheduledAt, status: appointments.status })
      .from(appointments).where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, startDate))).orderBy(asc(appointments.scheduledAt))
    const trends = new Map<string, AppointmentTrend>()
    for (const a of rows) {
      const date = a.scheduledAt.toISOString().split('T')[0]
      const t = trends.get(date) || { date, total: 0, confirmed: 0, cancelled: 0, no_show: 0, completed: 0 }
      t.total++; if (a.status === 'confirmed') t.confirmed++; else if (a.status === 'cancelled') t.cancelled++; else if (a.status === 'no_show') t.no_show++; else if (a.status === 'completed') t.completed++
      trends.set(date, t)
    }
    return Array.from(trends.values())
  } catch (e) { dbLogger.error('Error fetching appointment trends', e); return [] }
}

export async function getHourlyDistribution(clinicId: string, days = 90): Promise<HourlyDistribution[]> {
  const db = getDb()
  const startDate = new Date(); startDate.setDate(startDate.getDate() - days)
  try {
    const rows = await db.select({ scheduledAt: appointments.scheduledAt }).from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, startDate)))
    const counts = new Array(24).fill(0); let total = 0
    for (const a of rows) { counts[a.scheduledAt.getHours()]++; total++ }
    return counts.map((c, h) => ({ hour: h, count: c, percentage: total > 0 ? Math.round((c / total) * 100) : 0 }))
  } catch (e) { dbLogger.error('Error fetching hourly distribution', e); return [] }
}

export async function getDayOfWeekDistribution(clinicId: string, days = 90): Promise<DayOfWeekDistribution[]> {
  const db = getDb()
  const startDate = new Date(); startDate.setDate(startDate.getDate() - days)
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  try {
    const rows = await db.select({ scheduledAt: appointments.scheduledAt }).from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, startDate)))
    const counts = new Array(7).fill(0); let total = 0
    for (const a of rows) { counts[a.scheduledAt.getDay()]++; total++ }
    return counts.map((c, i) => ({ day: dayNames[i], dayIndex: i, count: c, percentage: total > 0 ? Math.round((c / total) * 100) : 0 }))
  } catch (e) { dbLogger.error('Error fetching day of week distribution', e); return [] }
}

export async function getHighRiskPatients(clinicId: string, limit = 20): Promise<PatientRiskAnalysis[]> {
  const db = getDb()
  try {
    const pRows = await db.select({ id: patients.id, name: patients.name, phone: patients.phone, lastVisit: patients.lastVisitAt, riskScore: patients.riskScore })
      .from(patients).where(eq(patients.clinicId, clinicId)).orderBy(desc(patients.riskScore)).limit(limit)
    if (!pRows.length) return []

    const patientIds = pRows.map(p => p.id)
    const aRows = await db.select({ patientId: appointments.patientId, status: appointments.status })
      .from(appointments).where(and(inArray(appointments.patientId, patientIds) as any, eq(appointments.clinicId, clinicId)))

    const apptMap = new Map<string, Array<{ status: string }>>()
    for (const a of aRows) { const arr = apptMap.get(a.patientId) || []; arr.push(a); apptMap.set(a.patientId, arr) }

    return pRows.map(p => {
      const appts = apptMap.get(p.id) || []
      const totalVisits = appts.length
      const cancelledCount = appts.filter(a => a.status === 'cancelled').length
      const noShowCount = appts.filter(a => a.status === 'no_show').length
      const factors: string[] = []
      if (!p.lastVisit) factors.push('Nunca visitou')
      else { const days = Math.floor((Date.now() - p.lastVisit.getTime()) / 86400000); if (days > 180) factors.push(`Sem visita há ${days} dias`) }
      if (noShowCount > 0) factors.push(`${noShowCount} no-show(s)`)
      if (cancelledCount > 2) factors.push(`${cancelledCount} cancelamentos`)
      if (totalVisits > 0 && cancelledCount / totalVisits > 0.3) factors.push('Alta taxa de cancelamento')
      return { patient_id: p.id, patient_name: p.name, phone: p.phone ?? '', risk_score: Number(p.riskScore ?? 0), risk_factors: factors, last_visit: p.lastVisit?.toISOString?.() ?? null, total_visits: totalVisits, cancelled_count: cancelledCount, no_show_count: noShowCount }
    })
  } catch (e) { dbLogger.error('Error analyzing high risk patients', e); return [] }
}

export async function getDemandForecast(clinicId: string, days = 14): Promise<DemandForecast[]> {
  const db = getDb()
  const historicalWeeks = 8
  try {
    const startDate = new Date(); startDate.setDate(startDate.getDate() - historicalWeeks * 7 - days)
    const endDate = new Date()
    const rows = await db.select({ scheduledAt: appointments.scheduledAt }).from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, startDate), lt(appointments.scheduledAt, endDate)))
    const byDow = new Map<number, Map<string, number>>()
    for (let d = 0; d < 7; d++) byDow.set(d, new Map())
    for (const a of rows) { const dow = a.scheduledAt.getDay(); const ds = a.scheduledAt.toISOString().split('T')[0]; const m = byDow.get(dow)!; m.set(ds, (m.get(ds) || 0) + 1) }
    const forecasts: DemandForecast[] = []
    for (let i = 0; i < days; i++) {
      const target = new Date(); target.setDate(target.getDate() + i)
      const dow = target.getDay(); const ds = target.toISOString().split('T')[0]
      const counts = Array.from(byDow.get(dow)!.values())
      const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
      const variance = counts.length > 1 ? counts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (counts.length - 1) : 0
      const confidence = avg > 0 ? Math.max(0.5, 1 - Math.sqrt(variance) / avg) : 0.5
      forecasts.push({ date: ds, predicted_appointments: Math.round(avg), confidence: Math.round(confidence * 100) / 100, based_on: `${counts.length} semanas de dados` })
    }
    return forecasts
  } catch (e) { dbLogger.error('Error generating demand forecast', e); return [] }
}

async function calculateAvgConfirmationTime(clinicId: string): Promise<number> {
  const db = getDb()
  try {
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const rows = await db.select({ scheduledAt: appointments.scheduledAt, confirmationSentAt: appointments.confirmationSentAt }).from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, ninetyDaysAgo), isNotNull(appointments.confirmationSentAt)))
    if (!rows.length) return 0
    let total = 0; let count = 0
    for (const a of rows) {
      const diff = (a.scheduledAt.getTime() - a.confirmationSentAt!.getTime()) / 3600000
      if (diff > 0) { total += diff; count++ }
    }
    return count > 0 ? Math.round((total / count) * 10) / 10 : 0
  } catch (e) { dbLogger.error('Error calculating avg confirmation time', e); return 0 }
}

export async function getClinicInsights(clinicId: string, options: { trendDays?: number; forecastDays?: number } = {}): Promise<ClinicInsights> {
  const { trendDays = 30, forecastDays = 14 } = options
  try {
    const [trends, hourly, dayOfWeek, riskPatients, forecast, avgConfirmationTime] = await Promise.all([
      getAppointmentTrends(clinicId, trendDays), getHourlyDistribution(clinicId, 90), getDayOfWeekDistribution(clinicId, 90),
      getHighRiskPatients(clinicId, 20), getDemandForecast(clinicId, forecastDays), calculateAvgConfirmationTime(clinicId),
    ])
    const total = trends.reduce((s, t) => s + t.total, 0)
    const totalCancelled = trends.reduce((s, t) => s + t.cancelled, 0)
    const totalNoShow = trends.reduce((s, t) => s + t.no_show, 0)
    const avgPerDay = trends.length > 0 ? total / trends.length : 0
    const peakHour = (hourly.reduce((m, h) => (h.count > m.count ? h : m), hourly[0]) || { hour: 9, count: 0 }).hour
    const peakDay = (dayOfWeek.reduce((m, d) => (d.count > m.count ? d : m), dayOfWeek[0]) || { day: 'Seg', dayIndex: 1, count: 0 }).day
    return {
      appointmentTrends: trends, hourlyDistribution: hourly, dayOfWeekDistribution: dayOfWeek,
      highRiskPatients: riskPatients, demandForecast: forecast,
      metrics: { avgAppointmentsPerDay: Math.round(avgPerDay * 10) / 10, peakHour, peakDay, cancellationRate: total > 0 ? Math.round((totalCancelled / total) * 100) : 0, noShowRate: total > 0 ? Math.round((totalNoShow / total) * 100) : 0, avgConfirmationTime },
    }
  } catch (e) { dbLogger.error('Error getting clinic insights', e); return { appointmentTrends: [], hourlyDistribution: [], dayOfWeekDistribution: [], highRiskPatients: [], demandForecast: [], metrics: { avgAppointmentsPerDay: 0, peakHour: 9, peakDay: 'Seg', cancellationRate: 0, noShowRate: 0, avgConfirmationTime: 0 } } }
}
