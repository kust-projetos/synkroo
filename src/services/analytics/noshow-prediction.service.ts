/**
 * No-Show Prediction Service
 * Predicts the likelihood of a patient not showing up for an appointment
 * Uses historical data and multiple risk factors
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface NoShowPrediction {
  patient_id: string
  patient_name: string
  appointment_id?: string
  scheduled_at: string
  risk_score: number // 0-100
  riskLevel: 'low' | 'medium' | 'high'
  factors: RiskFactor[]
  recommendations: string[]
}

export interface RiskFactor {
  name: string
  impact: number // 0-1 scale
  description: string
}

interface PatientHistory {
  total_appointments: number
  completed: number
  cancelled: number
  no_shows: number
  last_visit: string | null
  average_confirmation_time: number | null // hours before appointment
}

/**
 * Get patient's appointment history
 */
async function getPatientHistory(patientId: string): Promise<PatientHistory> {
  const supabase = await createTypedClient()

  try {
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('status, scheduled_at, confirmation_sent_at')
      .eq('patient_id', patientId) as any

    if (error) throw error

    const total = (appointments as any[])?.length || 0
    const completed = (appointments as any[])?.filter((a) => a.status === 'completed').length || 0
    const cancelled = (appointments as any[])?.filter((a) => a.status === 'cancelled').length || 0
    const no_shows = (appointments as any[])?.filter((a) => a.status === 'no_show').length || 0

    // Get last visit
    const completedAppointments = (appointments as any[])?.filter((a) => a.status === 'completed') || []
    const lastVisit =
      completedAppointments.length > 0
        ? completedAppointments.sort(
            (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
          )[0].scheduled_at
        : null

    // Calculate average confirmation time from actual confirmation timestamps
    const confirmedAppointments = (appointments as any[])?.filter(
      (a) => a.confirmation_sent_at && new Date(a.scheduled_at) > new Date(a.confirmation_sent_at)
    ) || []

    let avgConfirmationTime: number | null = null
    if (confirmedAppointments.length > 0) {
      const totalHours = confirmedAppointments.reduce((sum, apt) => {
        const scheduled = new Date(apt.scheduled_at).getTime()
        const confirmed = new Date(apt.confirmation_sent_at!).getTime()
        return sum + (scheduled - confirmed) / (1000 * 60 * 60)
      }, 0)
      avgConfirmationTime = Math.round((totalHours / confirmedAppointments.length) * 10) / 10
    }

    return {
      total_appointments: total,
      completed,
      cancelled,
      no_shows,
      last_visit: lastVisit,
      average_confirmation_time: avgConfirmationTime,
    }
  } catch (error) {
    dbLogger.error('Error fetching patient history', error)
    return {
      total_appointments: 0,
      completed: 0,
      cancelled: 0,
      no_shows: 0,
      last_visit: null,
      average_confirmation_time: null,
    }
  }
}

/**
 * Calculate no-show risk based on patient history
 */
function calculateHistoryRisk(history: PatientHistory): RiskFactor {
  const { total_appointments, no_shows, cancelled } = history

  if (total_appointments === 0) {
    return {
      name: 'new_patient',
      impact: 0.2,
      description: 'Paciente novo sem histórico',
    }
  }

  const noShowRate = no_shows / total_appointments
  const cancelRate = cancelled / total_appointments

  let impact = 0
  let description = ''

  if (noShowRate >= 0.3) {
    impact = 0.5
    description = `Alta taxa de no-show: ${Math.round(noShowRate * 100)}%`
  } else if (noShowRate >= 0.15) {
    impact = 0.3
    description = `Taxa moderada de no-show: ${Math.round(noShowRate * 100)}%`
  } else if (cancelRate >= 0.3) {
    impact = 0.25
    description = `Alta taxa de cancelamento: ${Math.round(cancelRate * 100)}%`
  } else {
    impact = 0
    description = 'Histórico bom de comparecimento'
  }

  return {
    name: 'patient_history',
    impact,
    description,
  }
}

/**
 * Calculate risk based on appointment timing
 */
function calculateTimingRisk(scheduledAt: string): RiskFactor {
  const scheduled = new Date(scheduledAt)
  const now = new Date()
  const hour = scheduled.getHours()
  const dayOfWeek = scheduled.getDay()

  let impact = 0
  const factors: string[] = []

  // Early morning appointments (before 9am) have higher no-show rate
  if (hour < 9) {
    impact += 0.15
    factors.push('Horário muito cedo')
  }

  // Late afternoon (after 5pm) also has higher rate
  if (hour >= 17) {
    impact += 0.1
    factors.push('Horário tardio')
  }

  // Monday and Friday have higher no-show rates
  if (dayOfWeek === 1 || dayOfWeek === 5) {
    impact += 0.1
    factors.push(dayOfWeek === 1 ? 'Segunda-feira' : 'Sexta-feira')
  }

  // Days until appointment
  const daysUntil = Math.floor((scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil > 14) {
    impact += 0.15
    factors.push('Agendamento muito antecipado')
  } else if (daysUntil < 1) {
    impact += 0.1
    factors.push('Agendamento de última hora')
  }

  return {
    name: 'timing',
    impact: Math.min(impact, 0.5),
    description: factors.length > 0 ? factors.join(', ') : 'Horário favorável',
  }
}

/**
 * Calculate risk based on patient inactivity
 */
function calculateInactivityRisk(lastVisit: string | null): RiskFactor {
  if (!lastVisit) {
    return {
      name: 'inactivity',
      impact: 0.2,
      description: 'Paciente nunca compareceu',
    }
  }

  const daysSinceVisit = Math.floor(
    (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceVisit > 365) {
    return {
      name: 'inactivity',
      impact: 0.35,
      description: `Sem visita há ${Math.floor(daysSinceVisit / 30)} meses`,
    }
  } else if (daysSinceVisit > 180) {
    return {
      name: 'inactivity',
      impact: 0.2,
      description: `Sem visita há ${Math.floor(daysSinceVisit / 30)} meses`,
    }
  } else if (daysSinceVisit > 90) {
    return {
      name: 'inactivity',
      impact: 0.1,
      description: 'Paciente um pouco inativo',
    }
  }

  return {
    name: 'inactivity',
    impact: 0,
    description: 'Paciente ativo',
  }
}

/**
 * Generate recommendations based on risk factors
 */
function generateRecommendations(factors: RiskFactor[], riskScore: number): string[] {
  const recommendations: string[] = []

  if (riskScore >= 50) {
    recommendations.push('Considerar ligação de confirmação 24h antes')
    recommendations.push('Enviar lembrete por WhatsApp no dia anterior')
  } else if (riskScore >= 30) {
    recommendations.push('Enviar lembrete por WhatsApp 24h antes')
  }

  // Check specific factors
  const historyFactor = factors.find((f) => f.name === 'patient_history')
  if (historyFactor && historyFactor.impact > 0.3) {
    recommendations.push('Pedir confirmação por mensagem')
  }

  const timingFactor = factors.find((f) => f.name === 'timing')
  if (timingFactor && timingFactor.impact > 0.2) {
    recommendations.push('Oferecer opção de reagendamento se necessário')
  }

  const inactivityFactor = factors.find((f) => f.name === 'inactivity')
  if (inactivityFactor && inactivityFactor.impact > 0.2) {
    recommendations.push('Considerar taxa de reagendamento flexível')
  }

  // Remove duplicates
  return [...new Set(recommendations)]
}

/**
 * Predict no-show risk for a specific appointment
 */
export async function predictNoShowRisk(
  patientId: string,
  scheduledAt: string,
  procedureId?: string
): Promise<NoShowPrediction> {
  const supabase = await createTypedClient()

  try {
    // Get patient info
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, risk_score')
      .eq('id', patientId)
      .single() as any

    if (patientError) throw patientError

    // Get patient history
    const history = await getPatientHistory(patientId)

    // Calculate risk factors
    const factors: RiskFactor[] = [
      calculateHistoryRisk(history),
      calculateTimingRisk(scheduledAt),
      calculateInactivityRisk(history.last_visit),
    ]

    // Add base risk score from patient
    if ((patient as any).risk_score && (patient as any).risk_score > 0) {
      factors.push({
        name: 'base_risk',
        impact: (patient as any).risk_score / 100,
        description: `Score de risco base: ${(patient as any).risk_score}`,
      })
    }

    // Calculate total risk score (0-100)
    const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0)
    const riskScore = Math.min(Math.round(totalImpact * 100), 100)

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high'
    if (riskScore >= 50) {
      riskLevel = 'high'
    } else if (riskScore >= 30) {
      riskLevel = 'medium'
    } else {
      riskLevel = 'low'
    }

    // Generate recommendations
    const recommendations = generateRecommendations(factors, riskScore)

    return {
      patient_id: patientId,
      patient_name: (patient as any).name,
      scheduled_at: scheduledAt,
      risk_score: riskScore,
      riskLevel,
      factors,
      recommendations,
    }
  } catch (error) {
    dbLogger.error('Error predicting no-show risk', error)
    return {
      patient_id: patientId,
      patient_name: 'Unknown',
      scheduled_at: scheduledAt,
      risk_score: 50,
      riskLevel: 'medium',
      factors: [{ name: 'error', impact: 0.5, description: 'Erro ao calcular risco' }],
      recommendations: ['Verificar dados do paciente'],
    }
  }
}

/**
 * Build a PatientHistory map from batch-fetched appointment data.
 * Groups all historical appointments by patient_id and computes
 * the same metrics as getPatientHistory but without per-patient queries.
 */
function buildPatientHistoryMap(
  rawAppointments: { status: string; scheduled_at: string; confirmation_sent_at: string | null; patient_id: string }[]
): Map<string, PatientHistory> {
  // Group appointments by patient_id
  const grouped = new Map<string, typeof rawAppointments>()
  for (const apt of rawAppointments) {
    const existing = grouped.get(apt.patient_id)
    if (existing) {
      existing.push(apt)
    } else {
      grouped.set(apt.patient_id, [apt])
    }
  }

  const historyMap = new Map<string, PatientHistory>()

  for (const [patientId, appointments] of grouped) {
    const total = appointments.length
    const completed = appointments.filter((a) => a.status === 'completed').length
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length
    const no_shows = appointments.filter((a) => a.status === 'no_show').length

    // Get last visit
    const completedAppointments = appointments.filter((a) => a.status === 'completed')
    const lastVisit =
      completedAppointments.length > 0
        ? completedAppointments.sort(
            (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
          )[0].scheduled_at
        : null

    // Calculate average confirmation time from actual confirmation timestamps
    const confirmedAppointments = appointments.filter(
      (a) => a.confirmation_sent_at && new Date(a.scheduled_at) > new Date(a.confirmation_sent_at)
    )

    let avgConfirmationTime: number | null = null
    if (confirmedAppointments.length > 0) {
      const totalHours = confirmedAppointments.reduce((sum, apt) => {
        const scheduled = new Date(apt.scheduled_at).getTime()
        const confirmed = new Date(apt.confirmation_sent_at!).getTime()
        return sum + (scheduled - confirmed) / (1000 * 60 * 60)
      }, 0)
      avgConfirmationTime = Math.round((totalHours / confirmedAppointments.length) * 10) / 10
    }

    historyMap.set(patientId, {
      total_appointments: total,
      completed,
      cancelled,
      no_shows,
      last_visit: lastVisit,
      average_confirmation_time: avgConfirmationTime,
    })
  }

  return historyMap
}

/**
 * Get no-show risk predictions for all upcoming appointments.
 * Uses batch queries to avoid N+1 pattern: fetches all patient data
 * and appointment history in 3 queries total instead of 2N+1.
 */
export async function getUpcomingAppointmentRisks(
  clinicId: string,
  days: number = 7
): Promise<NoShowPrediction[]> {
  const supabase = await createTypedClient()

  try {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)

    // Query 1: Get upcoming appointments with patient data (join)
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(
        `
        id,
        scheduled_at,
        patient_id,
        patients (id, name, risk_score)
      `
      )
      .eq('clinic_id', clinicId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString())
      .order('scheduled_at', { ascending: true }) as any

    if (error) throw error

    const validAppointments = ((appointments as any[]) || []).filter((apt) => {
      const patientData = apt.patients as { id: string; name: string; risk_score: number } | { id: string; name: string; risk_score: number }[] | null
      return patientData && !Array.isArray(patientData)
    })

    if (validAppointments.length === 0) {
      return []
    }

    // Extract unique patient IDs for batch queries
    const patientIdSet = new Set<string>()
    for (const apt of validAppointments) {
      patientIdSet.add(apt.patient_id)
    }
    const patientIds = [...patientIdSet]

    // Query 2: Batch-fetch all appointment history for these patients
    const { data: historyAppointments, error: historyError } = await supabase
      .from('appointments')
      .select('status, scheduled_at, confirmation_sent_at, patient_id')
      .in('patient_id', patientIds) as any

    if (historyError) throw historyError

    // Build patient history map from batch data
    const historyMap = buildPatientHistoryMap((historyAppointments as any[]) || [])

    // Build patient info map from the join data already fetched in Query 1
    const patientInfoMap = new Map<string, { name: string; risk_score: number }>()
    for (const apt of validAppointments) {
      const patientData = apt.patients as { id: string; name: string; risk_score: number }
      if (!patientInfoMap.has(patientData.id)) {
        patientInfoMap.set(patientData.id, { name: patientData.name, risk_score: patientData.risk_score })
      }
    }

    // Calculate predictions using pre-fetched batch data (no additional queries)
    const predictions: NoShowPrediction[] = []

    for (const apt of validAppointments) {
      const patientData = apt.patients as { id: string; name: string; risk_score: number }
      const patientId = patientData.id
      const history = historyMap.get(patientId) || {
        total_appointments: 0,
        completed: 0,
        cancelled: 0,
        no_shows: 0,
        last_visit: null,
        average_confirmation_time: null,
      }
      const patientInfo = patientInfoMap.get(patientId) || { name: 'Unknown', risk_score: 0 }

      // Calculate risk factors using existing pure functions
      const factors: RiskFactor[] = [
        calculateHistoryRisk(history),
        calculateTimingRisk(apt.scheduled_at),
        calculateInactivityRisk(history.last_visit),
      ]

      // Add base risk score from patient
      if (patientInfo.risk_score && patientInfo.risk_score > 0) {
        factors.push({
          name: 'base_risk',
          impact: patientInfo.risk_score / 100,
          description: `Score de risco base: ${patientInfo.risk_score}`,
        })
      }

      // Calculate total risk score (0-100)
      const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0)
      const riskScore = Math.min(Math.round(totalImpact * 100), 100)

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high'
      if (riskScore >= 50) {
        riskLevel = 'high'
      } else if (riskScore >= 30) {
        riskLevel = 'medium'
      } else {
        riskLevel = 'low'
      }

      // Generate recommendations
      const recommendations = generateRecommendations(factors, riskScore)

      predictions.push({
        patient_id: patientId,
        patient_name: patientInfo.name,
        appointment_id: apt.id,
        scheduled_at: apt.scheduled_at,
        risk_score: riskScore,
        riskLevel,
        factors,
        recommendations,
      })
    }

    // Sort by risk score descending
    return predictions.sort((a, b) => b.risk_score - a.risk_score)
  } catch (error) {
    dbLogger.error('Error getting upcoming appointment risks', error)
    return []
  }
}