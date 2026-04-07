/**
 * Analytics Service
 * Provides advanced metrics, insights, and predictions for clinic management
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface AppointmentTrend {
  date: string
  total: number
  confirmed: number
  cancelled: number
  no_show: number
  completed: number
}

export interface HourlyDistribution {
  hour: number
  count: number
  percentage: number
}

export interface DayOfWeekDistribution {
  day: string
  dayIndex: number
  count: number
  percentage: number
}

export interface PatientRiskAnalysis {
  patient_id: string
  patient_name: string
  phone: string
  risk_score: number
  risk_factors: string[]
  last_visit: string | null
  total_visits: number
  cancelled_count: number
  no_show_count: number
}

export interface DemandForecast {
  date: string
  predicted_appointments: number
  confidence: number
  based_on: string
}

export interface ClinicInsights {
  appointmentTrends: AppointmentTrend[]
  hourlyDistribution: HourlyDistribution[]
  dayOfWeekDistribution: DayOfWeekDistribution[]
  highRiskPatients: PatientRiskAnalysis[]
  demandForecast: DemandForecast[]
  metrics: {
    avgAppointmentsPerDay: number
    peakHour: number
    peakDay: string
    cancellationRate: number
    noShowRate: number
    avgConfirmationTime: number // hours
  }
}

/**
 * Get appointment trends for the last N days
 */
export async function getAppointmentTrends(
  clinicId: string,
  days: number = 30
): Promise<AppointmentTrend[]> {
  const supabase = await createTypedClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  try {
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('scheduled_at, status')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', startDate.toISOString())
      .order('scheduled_at', { ascending: true }) as any

    if (error) throw error

    // Group by date
    const trends: Map<string, AppointmentTrend> = new Map()

    for (const apt of (appointments as Array<{ scheduled_at: string; status: string }>) || []) {
      const date = apt.scheduled_at.split('T')[0]
      const existing = trends.get(date) || {
        date,
        total: 0,
        confirmed: 0,
        cancelled: 0,
        no_show: 0,
        completed: 0,
      }

      existing.total++
      if (apt.status === 'confirmed') existing.confirmed++
      else if (apt.status === 'cancelled') existing.cancelled++
      else if (apt.status === 'no_show') existing.no_show++
      else if (apt.status === 'completed') existing.completed++

      trends.set(date, existing)
    }

    return Array.from(trends.values())
  } catch (error) {
    dbLogger.error('Error fetching appointment trends', error)
    return []
  }
}

/**
 * Get hourly distribution of appointments
 */
export async function getHourlyDistribution(
  clinicId: string,
  days: number = 90
): Promise<HourlyDistribution[]> {
  const supabase = await createTypedClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  try {
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', startDate.toISOString()) as any

    if (error) throw error

    // Count by hour
    const hourCounts: number[] = new Array(24).fill(0)
    let total = 0

    for (const apt of (appointments as Array<{ scheduled_at: string }>) || []) {
      const hour = new Date(apt.scheduled_at).getHours()
      hourCounts[hour]++
      total++
    }

    return hourCounts.map((count, hour) => ({
      hour,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
  } catch (error) {
    dbLogger.error('Error fetching hourly distribution', error)
    return []
  }
}

/**
 * Get day of week distribution
 */
export async function getDayOfWeekDistribution(
  clinicId: string,
  days: number = 90
): Promise<DayOfWeekDistribution[]> {
  const supabase = await createTypedClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  try {
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', startDate.toISOString()) as any

    if (error) throw error

    // Count by day of week
    const dayCounts: number[] = new Array(7).fill(0)
    let total = 0

    for (const apt of (appointments as Array<{ scheduled_at: string }>) || []) {
      const dayOfWeek = new Date(apt.scheduled_at).getDay()
      dayCounts[dayOfWeek]++
      total++
    }

    return dayCounts.map((count, dayIndex) => ({
      day: dayNames[dayIndex],
      dayIndex,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
  } catch (error) {
    dbLogger.error('Error fetching day of week distribution', error)
    return []
  }
}

/**
 * Analyze patients at risk of churning or no-show
 */
export async function getHighRiskPatients(
  clinicId: string,
  limit: number = 20
): Promise<PatientRiskAnalysis[]> {
  const supabase = await createTypedClient()

  try {
    // Get patients with their appointment history
    const { data: patients, error } = await supabase
      .from('patients')
      .select(`
        id,
        name,
        phone,
        last_visit,
        risk_score,
        appointments (
          id,
          status
        )
      `)
      .eq('clinic_id', clinicId)
      .order('risk_score', { ascending: false })
      .limit(limit) as any

    if (error) throw error

    return ((patients as any) || []).map((patient: any) => {
      const appointments = (patient.appointments as Array<{ status: string }>) || []
      const totalVisits = appointments.length
      const cancelledCount = appointments.filter((a: any) => a.status === 'cancelled').length
      const noShowCount = appointments.filter((a: any) => a.status === 'no_show').length

      // Calculate risk factors
      const riskFactors: string[] = []

      if (!patient.last_visit) {
        riskFactors.push('Nunca visitou')
      } else {
        const daysSinceVisit = Math.floor(
          (Date.now() - new Date(patient.last_visit).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceVisit > 180) {
          riskFactors.push(`Sem visita há ${daysSinceVisit} dias`)
        }
      }

      if (noShowCount > 0) {
        riskFactors.push(`${noShowCount} no-show(s)`)
      }

      if (cancelledCount > 2) {
        riskFactors.push(`${cancelledCount} cancelamentos`)
      }

      const cancellationRate = totalVisits > 0 ? cancelledCount / totalVisits : 0
      if (cancellationRate > 0.3) {
        riskFactors.push('Alta taxa de cancelamento')
      }

      return {
        patient_id: patient.id,
        patient_name: patient.name,
        phone: patient.phone,
        risk_score: patient.risk_score || 0,
        risk_factors: riskFactors,
        last_visit: patient.last_visit,
        total_visits: totalVisits,
        cancelled_count: cancelledCount,
        no_show_count: noShowCount,
      }
    })
  } catch (error) {
    dbLogger.error('Error analyzing high risk patients', error)
    return []
  }
}

/**
 * Predict demand for upcoming days
 */
export async function getDemandForecast(
  clinicId: string,
  days: number = 14
): Promise<DemandForecast[]> {
  const supabase = await createTypedClient()

  try {
    // Get historical data for the same day of week in past weeks
    const historicalWeeks = 8 // Look at last 8 weeks
    const forecasts: DemandForecast[] = []

    for (let i = 0; i < days; i++) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + i)
      const dayOfWeek = targetDate.getDay()
      const dateStr = targetDate.toISOString().split('T')[0]

      // Get appointments for same day of week in historical period
      const historicalCounts: number[] = []

      for (let week = 1; week <= historicalWeeks; week++) {
        const historicalDate = new Date(targetDate)
        historicalDate.setDate(historicalDate.getDate() - week * 7)

        const { count } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .gte('scheduled_at', historicalDate.toISOString())
          .lt('scheduled_at', new Date(historicalDate.getTime() + 86400000).toISOString())

        if (count) historicalCounts.push(count)
      }

      // Calculate average and confidence
      const avg =
        historicalCounts.length > 0
          ? historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length
          : 0

      const variance =
        historicalCounts.length > 1
          ? historicalCounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
            (historicalCounts.length - 1)
          : 0

      const stdDev = Math.sqrt(variance)
      const confidence = avg > 0 ? Math.max(0.5, 1 - stdDev / avg) : 0.5

      forecasts.push({
        date: dateStr,
        predicted_appointments: Math.round(avg),
        confidence: Math.round(confidence * 100) / 100,
        based_on: `${historicalCounts.length} semanas de dados`,
      })
    }

    return forecasts
  } catch (error) {
    dbLogger.error('Error generating demand forecast', error)
    return []
  }
}

/**
 * Calculate average confirmation time in hours
 * Measures how many hours before the appointment patients confirm on average
 */
async function calculateAvgConfirmationTime(clinicId: string): Promise<number> {
  const supabase = await createTypedClient()

  try {
    // Get appointments with confirmation timestamps from last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('scheduled_at, confirmation_sent_at')
      .eq('clinic_id', clinicId)
      .not('confirmation_sent_at', 'is', null)
      .gte('scheduled_at', ninetyDaysAgo.toISOString()) as any

    if (error || !appointments || (appointments as any[]).length === 0) {
      return 0
    }

    // Calculate average hours between scheduled time and confirmation sent time
    const totalHours = (appointments as any[]).reduce((sum, apt) => {
      const scheduled = new Date(apt.scheduled_at).getTime()
      const confirmed = new Date(apt.confirmation_sent_at!).getTime()
      const hoursBeforeAppointment = (scheduled - confirmed) / (1000 * 60 * 60)
      // Only count if confirmation was sent before the appointment
      return hoursBeforeAppointment > 0 ? sum + hoursBeforeAppointment : sum
    }, 0)

    const avgHours = totalHours / (appointments as any[]).length
    return Math.round(avgHours * 10) / 10 // Round to 1 decimal
  } catch (error) {
    dbLogger.error('Error calculating avg confirmation time', error)
    return 0
  }
}

/**
 * Get comprehensive clinic insights
 */
export async function getClinicInsights(
  clinicId: string,
  options: { trendDays?: number; forecastDays?: number } = {}
): Promise<ClinicInsights> {
  const { trendDays = 30, forecastDays = 14 } = options

  try {
    // Run all analytics in parallel
    const [trends, hourly, dayOfWeek, riskPatients, forecast] = await Promise.all([
      getAppointmentTrends(clinicId, trendDays),
      getHourlyDistribution(clinicId, 90),
      getDayOfWeekDistribution(clinicId, 90),
      getHighRiskPatients(clinicId, 20),
      getDemandForecast(clinicId, forecastDays),
    ])

    // Calculate metrics
    const totalAppointments = trends.reduce((sum, t) => sum + t.total, 0)
    const totalCancelled = trends.reduce((sum, t) => sum + t.cancelled, 0)
    const totalNoShow = trends.reduce((sum, t) => sum + t.no_show, 0)
    const totalCompleted = trends.reduce((sum, t) => sum + t.completed, 0)

    const avgAppointmentsPerDay = trends.length > 0 ? totalAppointments / trends.length : 0

    // Find peak hour
    const peakHourData = hourly.reduce((max, h) => (h.count > max.count ? h : max), hourly[0] || { hour: 9, count: 0 })

    // Find peak day
    const peakDayData = dayOfWeek.reduce(
      (max, d) => (d.count > max.count ? d : max),
      dayOfWeek[0] || { day: 'Seg', dayIndex: 1, count: 0 }
    )

    const cancellationRate = totalAppointments > 0 ? totalCancelled / totalAppointments : 0
    const noShowRate = totalAppointments > 0 ? totalNoShow / totalAppointments : 0

    // Calculate average confirmation time
    const avgConfirmationTime = await calculateAvgConfirmationTime(clinicId)

    return {
      appointmentTrends: trends,
      hourlyDistribution: hourly,
      dayOfWeekDistribution: dayOfWeek,
      highRiskPatients: riskPatients,
      demandForecast: forecast,
      metrics: {
        avgAppointmentsPerDay: Math.round(avgAppointmentsPerDay * 10) / 10,
        peakHour: peakHourData.hour,
        peakDay: peakDayData.day,
        cancellationRate: Math.round(cancellationRate * 100),
        noShowRate: Math.round(noShowRate * 100),
        avgConfirmationTime,
      },
    }
  } catch (error) {
    dbLogger.error('Error getting clinic insights', error)
    return {
      appointmentTrends: [],
      hourlyDistribution: [],
      dayOfWeekDistribution: [],
      highRiskPatients: [],
      demandForecast: [],
      metrics: {
        avgAppointmentsPerDay: 0,
        peakHour: 9,
        peakDay: 'Seg',
        cancellationRate: 0,
        noShowRate: 0,
        avgConfirmationTime: 0,
      },
    }
  }
}