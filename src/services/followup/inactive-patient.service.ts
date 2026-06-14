import { eq, and, lt, lte, or, isNull, inArray, desc, asc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients, appointments, procedures, clinics } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

/**
 * Inactive Patient Detection Service — migrated to Drizzle.
 * Identifies and segments patients based on inactivity periods.
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
  priority: number
}

export const INACTIVITY_SEGMENTS: InactivitySegment[] = [
  { segment: 'inactive_30', minDays: 30, maxDays: 59, label: 'Inativo 30 dias', priority: 1 },
  { segment: 'inactive_60', minDays: 60, maxDays: 89, label: 'Inativo 60 dias', priority: 2 },
  { segment: 'inactive_90', minDays: 90, maxDays: 179, label: 'Inativo 90 dias', priority: 3 },
  { segment: 'inactive_180', minDays: 180, maxDays: 9999, label: 'Inativo 6 meses', priority: 4 },
]

export function calculateDaysSinceLastVisit(lastVisit: Date | null): number {
  if (!lastVisit) return 999
  const now = new Date()
  const diff = now.getTime() - new Date(lastVisit).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function getInactivitySegment(daysSinceLastVisit: number): InactivitySegment | null {
  return INACTIVITY_SEGMENTS.find(
    segment => daysSinceLastVisit >= segment.minDays && daysSinceLastVisit <= segment.maxDays
  ) || null
}

/**
 * Identify inactive patients for a clinic — Drizzle.
 * Queries patients with lastVisitAt < cutoff or NULL, then batch-fetches
 * their appointments + procedures for grouping.
 */
export async function identifyInactivePatients(
  clinicId: string,
  minDaysInactive: number = 30
): Promise<InactivePatient[]> {
  const db = getDb()
  const now = new Date()
  const cutoffDate = new Date(now.getTime() - minDaysInactive * 24 * 60 * 60 * 1000)

  // 1. Find patients matching the inactivity condition
  const patientRows = await db
    .select({
      id: patients.id,
      name: patients.name,
      phone: patients.phone,
      lastVisitAt: patients.lastVisitAt,
      riskScore: patients.riskScore,
      clinicId: patients.clinicId,
    })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        or(
          isNull(patients.lastVisitAt),
          lt(patients.lastVisitAt, cutoffDate),
        ),
      ),
    )

  if (!patientRows.length) return []

  const patientIds = patientRows.map(p => p.id)

  // 2. Fetch clinic name
  const [clinicRow] = await db
    .select({ name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
  const clinicName = clinicRow?.name ?? ''

  // 3. Batch-fetch appointments for these patients
  const apptRows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      procedureId: appointments.procedureId,
      procedureName: procedures.name,
    })
    .from(appointments)
    .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
    .where(
      and(
        inArray(appointments.patientId, patientIds),
        inArray(appointments.status as any, ['completed', 'confirmed']),
      ),
    )
    .orderBy(desc(appointments.scheduledAt))

  // Group appointments by patient
  const apptsByPatient = new Map<string, typeof apptRows>()
  for (const a of apptRows) {
    const list = apptsByPatient.get(a.patientId) || []
    list.push(a)
    apptsByPatient.set(a.patientId, list)
  }

  // 4. Compute InactivePatient for each patient
  const results: InactivePatient[] = []
  for (const p of patientRows) {
    const visits = apptsByPatient.get(p.id) || []
    const daysSince = calculateDaysSinceLastVisit(p.lastVisitAt)
    const segment = getInactivitySegment(daysSince)
    if (!segment) continue

    const completed = visits.filter(a => a.status === 'completed')
    const lastProcedure = completed.length > 0 ? completed[0].procedureName ?? undefined : undefined

    results.push({
      patientId: p.id,
      patientName: p.name,
      patientPhone: p.phone,
      lastVisit: p.lastVisitAt,
      daysSinceLastVisit: daysSince,
      inactivitySegment: segment.segment as InactivePatient['inactivitySegment'],
      clinicId: p.clinicId,
      clinicName,
      totalVisits: visits.length,
      lastProcedure,
      riskScore: Number(p.riskScore ?? 0),
    })
  }

  return results.sort((a, b) => {
    const aPriority = INACTIVITY_SEGMENTS.find(s => s.segment === a.inactivitySegment)?.priority || 0
    const bPriority = INACTIVITY_SEGMENTS.find(s => s.segment === b.inactivitySegment)?.priority || 0
    if (aPriority !== bPriority) return bPriority - aPriority
    return b.riskScore - a.riskScore
  })
}

/**
 * Update patient tags with inactivity status — Drizzle.
 */
export async function updateInactivePatientTags(
  clinicId: string
): Promise<{ updated: number; errors: number }> {
  const db = getDb()
  const inactivePatients = await identifyInactivePatients(clinicId, 30)

  let updated = 0
  let errors = 0

  for (const patient of inactivePatients) {
    const segment = INACTIVITY_SEGMENTS.find(s => s.segment === patient.inactivitySegment)
    if (!segment) continue

    try {
      // Get current tags
      const [row] = await db
        .select({ tags: patients.tags })
        .from(patients)
        .where(eq(patients.id, patient.patientId))

      const currentTags: string[] = (row?.tags as string[]) || []

      const cleanedTags = currentTags.filter((tag: string) =>
        !tag.startsWith('Inativo') && !tag.startsWith('inativo')
      )

      const newTags = [...cleanedTags, segment.label]

      await db
        .update(patients)
        .set({ tags: newTags as any })
        .where(eq(patients.id, patient.patientId))

      updated++
    } catch (err) {
      dbLogger.error(`Error updating tags for ${patient.patientName}`, err)
      errors++
    }
  }

  return { updated, errors }
}

/**
 * Get inactivity statistics for a clinic — Drizzle.
 * Cumulative counts per cutoff: inactive_30 = lastVisitAt < now-30d OR NULL, etc.
 */
export async function getInactivityStats(clinicId: string): Promise<{
  totalInactive: number
  bySegment: Record<string, number>
  atRiskRevenue: number
}> {
  const db = getDb()
  const now = new Date()
  const cutoffs = [30, 60, 90, 180] as const
  const bySegment: Record<string, number> = {}
  let atRiskRevenue = 0
  const avgVisitValue = 250

  for (const days of cutoffs) {
    const cutoff = new Date(now.getTime() - days * 24 * 3600 * 1000)
    const [cnt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          or(
            isNull(patients.lastVisitAt),
            lt(patients.lastVisitAt, cutoff),
          ),
        ),
      )
    const segment = `inactive_${days}`
    bySegment[segment] = cnt?.count ?? 0
    atRiskRevenue += (cnt?.count ?? 0) * 2 * avgVisitValue
  }

  return {
    totalInactive: bySegment['inactive_30'] ?? 0,
    bySegment,
    atRiskRevenue: Math.round(atRiskRevenue),
  }
}

/**
 * Get patients for reactivation campaign — Drizzle.
 * Filters out opted-out patients.
 */
export async function getPatientsForReactivation(
  clinicId: string,
  segment?: string
): Promise<InactivePatient[]> {
  let list = await identifyInactivePatients(clinicId, 60)

  if (segment) {
    list = list.filter((p: InactivePatient) => p.inactivitySegment === segment)
  }

  // Filter out opted-out patients
  const db = getDb()
  const patientIds = list.map(p => p.patientId)
  if (!patientIds.length) return []

  const optedOutRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        inArray(patients.id, patientIds),
        eq(patients.optOutMarketing, true),
      ),
    )

  const optedOutIds = new Set(optedOutRows.map(r => r.id))
  return list.filter(p => !optedOutIds.has(p.patientId))
}

/**
 * Run daily inactivity detection job — Drizzle.
 */
export async function runInactivityDetection(): Promise<void> {
  dbLogger.info('Running inactivity detection...')

  const db = getDb()
  const clinicRows = await db
    .select({ id: clinics.id })
    .from(clinics)

  for (const c of clinicRows) {
    const result = await updateInactivePatientTags(c.id)
    dbLogger.info(`Clinic ${c.id} updated`, { updated: result.updated, errors: result.errors })
  }

  dbLogger.info('Inactivity detection complete')
}
