import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

/**
 * Inactive Patient Detection Service
 * Identifies and segments patients based on inactivity periods
 */

export interface InactivePatient {
  patientId: string
  patientName: string
  patientPhone: string
  lastVisit: Date | null
  daysSinceLastVisit: number
  inactivitySegment: 'inactive_30' | 'inactive_60' | 'inactive_90' | 'inactive_180'
  clinicId: string
  clinicName: string
  totalVisits: number
  lastProcedure?: string
  riskScore: number
}

export interface InactivitySegment {
  segment: string
  minDays: number
  maxDays: number
  label: string
  priority: number // Higher = more urgent
}

// Inactivity segments configuration
export const INACTIVITY_SEGMENTS: InactivitySegment[] = [
  { segment: 'inactive_30', minDays: 30, maxDays: 59, label: 'Inativo 30 dias', priority: 1 },
  { segment: 'inactive_60', minDays: 60, maxDays: 89, label: 'Inativo 60 dias', priority: 2 },
  { segment: 'inactive_90', minDays: 90, maxDays: 179, label: 'Inativo 90 dias', priority: 3 },
  { segment: 'inactive_180', minDays: 180, maxDays: 9999, label: 'Inativo 6 meses', priority: 4 },
]

/**
 * Calculate days since last visit
 */
export function calculateDaysSinceLastVisit(lastVisit: Date | null): number {
  if (!lastVisit) return 999 // No visits = very high

  const now = new Date()
  const diff = now.getTime() - new Date(lastVisit).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Get inactivity segment for a patient
 */
export function getInactivitySegment(daysSinceLastVisit: number): InactivitySegment | null {
  return INACTIVITY_SEGMENTS.find(
    segment => daysSinceLastVisit >= segment.minDays && daysSinceLastVisit <= segment.maxDays
  ) || null
}

/**
 * Identify inactive patients for a clinic
 */
export async function identifyInactivePatients(
  clinicId: string,
  minDaysInactive: number = 30
): Promise<InactivePatient[]> {
  const supabase = await createTypedClient()

  const now = new Date()
  const cutoffDate = new Date(now.getTime() - minDaysInactive * 24 * 60 * 60 * 1000)

  // Get patients with their last visit and appointment count
  const { data: patients, error } = await supabase
    .from('patients')
    .select(`
      id,
      name,
      phone,
      last_visit_at,
      risk_score,
      clinic_id,
      created_at,
      clinics (name),
      appointments (
        id,
        scheduled_at,
        status,
        procedures (name)
      )
    `)
    .eq('clinic_id', clinicId)
    .or(`last_visit_at.is.null,last_visit_at.lte.${cutoffDate.toISOString()}`) as any

  if (error) {
    dbLogger.error('Error identifying inactive patients', error)
    return []
  }

  const inactivePatients: InactivePatient[] = []

  for (const patient of (patients as any[]) || []) {
    const daysSince = calculateDaysSinceLastVisit((patient as any).last_visit_at)
    const segment = getInactivitySegment(daysSince)

    if (!segment) continue

    // Get last completed appointment procedure
    const lastCompletedAppointment = (patient as any).appointments
      ?.filter((a: any) => a.status === 'completed')
      .sort((a: any, b: any) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      )[0] as any

    // Count total visits
    const totalVisits = (patient as any).appointments?.filter((a: any) =>
      ['completed', 'confirmed'].includes(a.status)
    ).length || 0

    // Extract clinic name - handle both array and object from join
    const clinicData = (patient as any).clinics as any
    const clinicName = Array.isArray(clinicData) ? (clinicData[0]?.name || '') : (clinicData?.name || '')

    // Extract procedure name - handle both array and object from join
    const procedureData = lastCompletedAppointment?.procedures as any
    const lastProcedure = Array.isArray(procedureData) ? procedureData[0]?.name : procedureData?.name

    inactivePatients.push({
      patientId: (patient as any).id,
      patientName: (patient as any).name,
      patientPhone: (patient as any).phone,
      lastVisit: (patient as any).last_visit_at ? new Date((patient as any).last_visit_at) : null,
      daysSinceLastVisit: daysSince,
      inactivitySegment: segment.segment as InactivePatient['inactivitySegment'],
      clinicId: (patient as any).clinic_id,
      clinicName,
      totalVisits,
      lastProcedure,
      riskScore: (patient as any).risk_score || 0,
    })
  }

  // Sort by priority (most inactive first) then by risk score
  return inactivePatients.sort((a, b) => {
    const aPriority = INACTIVITY_SEGMENTS.find(s => s.segment === a.inactivitySegment)?.priority || 0
    const bPriority = INACTIVITY_SEGMENTS.find(s => s.segment === b.inactivitySegment)?.priority || 0
    if (aPriority !== bPriority) return bPriority - aPriority
    return b.riskScore - a.riskScore
  })
}

/**
 * Update patient tags with inactivity status
 */
export async function updateInactivePatientTags(
  clinicId: string
): Promise<{ updated: number; errors: number }> {
  const supabase = await createTypedClient()

  const inactivePatients = await identifyInactivePatients(clinicId, 30)

  let updated = 0
  let errors = 0

  for (const patient of inactivePatients) {
    const segment = INACTIVITY_SEGMENTS.find(s => s.segment === patient.inactivitySegment)
    if (!segment) continue

    // Get current tags
    const { data: currentPatient } = await supabase
      .from('patients')
      .select('tags')
      .eq('id', patient.patientId)
      .single() as any

    const currentTags = (currentPatient as any)?.tags || []

    // Remove old inactivity tags
    const cleanedTags = currentTags.filter((tag: string) =>
      !tag.startsWith('Inativo') && !tag.startsWith('inativo')
    )

    // Add new inactivity tag
    const newTags = [...cleanedTags, segment.label]

    // Update patient
    const { error } = await (supabase
      .from('patients') as any)
      .update({ tags: newTags })
      .eq('id', patient.patientId)

    if (error) {
      dbLogger.error(`Error updating tags for ${patient.patientName}`, error)
      errors++
    } else {
      updated++
    }
  }

  return { updated, errors }
}

/**
 * Get inactivity statistics for a clinic
 */
export async function getInactivityStats(clinicId: string): Promise<{
  totalInactive: number
  bySegment: Record<string, number>
  atRiskRevenue: number
}> {
  const inactivePatients = await identifyInactivePatients(clinicId, 30)

  const bySegment: Record<string, number> = {}
  let atRiskRevenue = 0

  // Average patient value per visit (could be from settings)
  const avgVisitValue = 250

  for (const patient of inactivePatients) {
    const segment = patient.inactivitySegment
    bySegment[segment] = (bySegment[segment] || 0) + 1

    // Calculate at-risk revenue based on average visits per year
    const expectedVisitsPerYear = patient.totalVisits > 0 ? 2 : 0
    const yearsSinceLastVisit = patient.daysSinceLastVisit / 365
    atRiskRevenue += expectedVisitsPerYear * yearsSinceLastVisit * avgVisitValue
  }

  return {
    totalInactive: inactivePatients.length,
    bySegment,
    atRiskRevenue: Math.round(atRiskRevenue),
  }
}

/**
 * Get patients for reactivation campaign
 */
export async function getPatientsForReactivation(
  clinicId: string,
  segment?: string
): Promise<InactivePatient[]> {
  let patients = await identifyInactivePatients(clinicId, 60)

  if (segment) {
    patients = patients.filter((p: InactivePatient) => p.inactivitySegment === segment)
  }

  // Filter out opted-out patients
  const supabase = await createTypedClient()
  const patientIds = patients.map((p: InactivePatient) => p.patientId)

  const { data: optedOut } = await supabase
    .from('patients')
    .select('id')
    .in('id', patientIds)
    .eq('opt_out_marketing', true)

  const optedOutIds = new Set(optedOut?.map((p: any) => p.id) || [])

  return patients.filter((p: any) => !optedOutIds.has(p.patientId))
}

/**
 * Run daily inactivity detection job
 */
export async function runInactivityDetection(): Promise<void> {
  dbLogger.info('Running inactivity detection...')

  const supabase = await createTypedClient()

  // Get all clinics
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id') as any

  for (const clinic of (clinics as any[]) || []) {
    const result = await updateInactivePatientTags(clinic.id)
    dbLogger.info(`Clinic ${clinic.id} updated`, { updated: result.updated, errors: result.errors })
  }

  dbLogger.info('Inactivity detection complete')
}