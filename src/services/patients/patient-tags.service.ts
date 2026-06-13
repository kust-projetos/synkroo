/**
 * Patient Tags Service
 * Manages tags for patient segmentation and filtering using Drizzle
 */

import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients } from '@/lib/db/schema'
import * as patientRepo from '@/repositories/patients'
import { dbLogger } from '@/lib/logger'

export const DEFAULT_TAGS = [
  'Novo',
  'VIP',
  'Inadimplente',
  'Retorno',
  'Convênio',
  'Particular',
  'Emergência',
  'Alta Prioridade',
  'Baixa Prioridade',
  'Potencial',
] as const

export interface PatientTag {
  id: string
  clinic_id: string
  name: string
  color: string | null
  patient_count: number
  created_at: string
}

export interface PatientWithTags {
  patient_id: string
  tags: string[]
}

/**
 * Get all tags used in a clinic
 */
export async function getClinicTags(clinicId: string): Promise<string[]> {
  const db = getDb()

  try {
    const rows = await db
      .select({ tags: patients.tags })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), sql`${patients.deletedAt} IS NULL`))

    const tagSet = new Set<string>()
    for (const row of rows) {
      if (row.tags) {
        for (const tag of row.tags) {
          tagSet.add(tag)
        }
      }
    }

    return [...tagSet].sort()
  } catch (error) {
    dbLogger.error('Error fetching clinic tags', error)
    return []
  }
}

/**
 * Get suggested tags (defaults + existing clinic tags)
 */
export async function getSuggestedTags(clinicId: string): Promise<string[]> {
  const existingTags = await getClinicTags(clinicId)
  const allTags = new Set([...DEFAULT_TAGS, ...existingTags])
  return [...allTags].sort()
}

/**
 * Add a tag to a patient
 */
export async function addPatientTag(
  patientId: string,
  tag: string
): Promise<boolean> {
  try {
    const patient = await patientRepo.findById(patientId)
    if (!patient) return false

    const currentTags = patient.tags || []
    if (currentTags.includes(tag)) return true

    await patientRepo.update(patientId, { tags: [...currentTags, tag] })
    return true
  } catch (error) {
    dbLogger.error('Error adding patient tag', error)
    return false
  }
}

/**
 * Remove a tag from a patient
 */
export async function removePatientTag(
  patientId: string,
  tag: string
): Promise<boolean> {
  try {
    const patient = await patientRepo.findById(patientId)
    if (!patient) return false

    const currentTags = patient.tags || []
    await patientRepo.update(patientId, { tags: currentTags.filter((t) => t !== tag) })
    return true
  } catch (error) {
    dbLogger.error('Error removing patient tag', error)
    return false
  }
}

/**
 * Set all tags for a patient
 */
export async function setPatientTags(
  patientId: string,
  tags: string[]
): Promise<boolean> {
  try {
    await patientRepo.update(patientId, { tags })
    return true
  } catch (error) {
    dbLogger.error('Error setting patient tags', error)
    return false
  }
}

/**
 * Find patients by tag
 */
export async function getPatientsByTag(
  clinicId: string,
  tag: string
): Promise<Array<{ id: string; name: string; phone: string; tags: string[] }>> {
  const db = getDb()

  try {
    const rows = await db
      .select({ id: patients.id, name: patients.name, phone: patients.phone, tags: patients.tags })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), sql`${patients.deletedAt} IS NULL`))

    // Filter in-memory since Drizzle doesn't have a native array contains for PG
    return rows
      .filter(r => r.tags && r.tags.includes(tag))
      .map(r => ({ id: r.id, name: r.name, phone: r.phone, tags: r.tags || [] }))
  } catch (error) {
    dbLogger.error('Error fetching patients by tag', error)
    return []
  }
}