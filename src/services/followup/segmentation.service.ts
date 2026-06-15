/**
 * Campaign Segmentation Service
 * Create segments combining multiple criteria for targeted campaigns
 * Migrated from Supabase to Drizzle ORM.
 *
 * Uses patients.status (Schema Batch 2) for active/inactive filtering.
 * totalSpentMin/Max preserved in API but no DB filter (appointments.total_value
 * does not exist in Drizzle schema — matches original behavior where these were
 * only used to gate the appointment-based query block, not to filter by amount).
 */

import { eq, and, gte, lte, isNull, ne, inArray, arrayOverlaps, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { campaignSegments } from '@/lib/db/schema/crm'
import { patients, clinics } from '@/lib/db/schema/core'
import { appointments } from '@/lib/db/schema/appointments'
import { procedures } from '@/lib/db/schema/core'
import { dbLogger } from '@/lib/logger'

export interface SegmentCriteria {
  lastVisitMin?: number
  lastVisitMax?: number
  procedures?: string[]
  tags?: string[]
  ageMin?: number
  ageMax?: number
  totalSpentMin?: number
  totalSpentMax?: number
  source?: string[]
  status?: 'active' | 'inactive' | 'all'
}

export interface Segment {
  id: string
  clinic_id: string
  name: string
  description: string | null
  criteria: SegmentCriteria
  patient_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

function toSnake(row: any): Segment {
  return {
    id: row.id,
    clinic_id: row.clinicId,
    name: row.name,
    description: row.description ?? null,
    criteria: row.criteria as SegmentCriteria,
    patient_count: row.patientCount ?? 0,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt?.toISOString?.() ?? '',
    updated_at: row.updatedAt?.toISOString?.() ?? '',
  }
}

function buildPatientConditions(clinicId: string, criteria: SegmentCriteria) {
  const conditions: any[] = [
    eq(patients.clinicId, clinicId),
    isNull(patients.deletedAt),
  ]

  // patients.status now available (Schema Batch 2)
  if (criteria.status === 'inactive') {
    conditions.push(eq(patients.status, 'inactive'))
  } else if (criteria.status === 'active') {
    conditions.push(ne(patients.status, 'inactive'))
  }

  if (criteria.ageMin) {
    const maxBirth = new Date()
    maxBirth.setFullYear(maxBirth.getFullYear() - criteria.ageMin)
    conditions.push(lte(patients.birthDate, maxBirth.toISOString().split('T')[0]))
  }
  if (criteria.ageMax) {
    const minBirth = new Date()
    minBirth.setFullYear(minBirth.getFullYear() - criteria.ageMax)
    conditions.push(gte(patients.birthDate, minBirth.toISOString().split('T')[0]))
  }

  if (criteria.tags && criteria.tags.length > 0) {
    conditions.push(arrayOverlaps(patients.tags, criteria.tags))
  }

  return conditions
}

export async function createSegment(params: {
  clinicId: string
  name: string
  description?: string
  criteria: SegmentCriteria
  createdBy?: string
}): Promise<Segment | null> {
  const db = getDb()

  try {
    const patientCount = await previewSegmentSize(params.clinicId, params.criteria)

    const [row] = await db.insert(campaignSegments).values({
      clinicId: params.clinicId,
      name: params.name,
      description: params.description ?? null,
      criteria: params.criteria as any,
      patientCount,
      createdBy: params.createdBy ?? null,
    }).returning()

    if (!row) return null
    return toSnake(row)
  } catch (error) {
    dbLogger.error('Error creating segment', error)
    return null
  }
}

export async function previewSegmentSize(
  clinicId: string,
  criteria: SegmentCriteria
): Promise<number> {
  const db = getDb()

  try {
    const conditions = buildPatientConditions(clinicId, criteria)

    const rows = await db.select({ id: patients.id })
      .from(patients)
      .where(and(...conditions))

    let patientCount = rows.length

    // For criteria requiring appointment data, do additional filtering
    // Note: totalSpentMin/Max only gate this block (no actual value filter —
    // appointments.total_value does not exist in Drizzle). This matches original behavior.
    const needsAppointmentFilter = !!(
      criteria.procedures ||
      criteria.lastVisitMin != null ||
      criteria.lastVisitMax != null ||
      criteria.totalSpentMin != null
    )

    if (needsAppointmentFilter) {
      const patientIds = rows.map((p) => p.id)
      if (!patientIds.length) return 0

      const aptRows = await db.select({
        patientId: appointments.patientId,
        scheduledAt: appointments.scheduledAt,
        procedureName: procedures.name,
      })
        .from(appointments)
        .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
        .where(and(
          inArray(appointments.patientId, patientIds),
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'completed' as any),
        ))

      const patientMatchSet = new Set<string>()
      for (const apt of aptRows) {
        let matches = true

        if (criteria.lastVisitMin != null || criteria.lastVisitMax != null) {
          const aptDate = apt.scheduledAt
          if (!aptDate) { matches = false; continue }
          const daysSince = Math.floor(
            (Date.now() - new Date(aptDate).getTime()) / (1000 * 60 * 60 * 24),
          )
          if (criteria.lastVisitMin != null && daysSince < criteria.lastVisitMin) matches = false
          if (criteria.lastVisitMax != null && daysSince > criteria.lastVisitMax) matches = false
        }

        if (criteria.procedures && criteria.procedures.length > 0) {
          const procName = apt.procedureName ?? ''
          if (!criteria.procedures.some((p) => procName.toLowerCase().includes(p.toLowerCase()))) {
            matches = false
          }
        }

        if (matches) patientMatchSet.add(apt.patientId)
      }

      patientCount = patientMatchSet.size
    }

    return patientCount
  } catch (error) {
    dbLogger.error('Error previewing segment', error)
    return 0
  }
}

export async function getSegmentPatients(
  clinicId: string,
  criteria: SegmentCriteria,
  limit: number = 100
): Promise<Array<{ id: string; name: string; phone: string }>> {
  const db = getDb()

  try {
    const conditions = buildPatientConditions(clinicId, criteria)

    const rows = await db.select({
      id: patients.id,
      name: patients.name,
      phone: patients.phone,
    })
      .from(patients)
      .where(and(...conditions))
      .limit(limit)

    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? '' }))
  } catch (error) {
    dbLogger.error('Error getting segment patients', error)
    return []
  }
}

export async function listSegments(clinicId: string): Promise<Segment[]> {
  const db = getDb()

  try {
    const rows = await db.select()
      .from(campaignSegments)
      .where(eq(campaignSegments.clinicId, clinicId))
      .orderBy(desc(campaignSegments.createdAt))

    return rows.map(toSnake)
  } catch (error) {
    dbLogger.error('Error listing segments', error)
    return []
  }
}
