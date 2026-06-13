/**
 * Patient Preferences & Observations Service
 * Manages patient observations and preferences using Drizzle
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patientObservations, patientPreferences } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export type NoteVisibility = 'public' | 'team_only'

export interface PatientObservation {
  id: string
  patient_id: string
  clinic_id: string
  author_id: string
  author_name: string
  content: string
  visibility: NoteVisibility
  created_at: Date
}

export interface PatientPreference {
  id: string
  patient_id: string
  clinic_id: string
  key: string
  value: string
  category: 'scheduling' | 'communication' | 'clinical' | 'general'
  updated_at: Date
}

// ──────────────────────────────────────────────
// OBSERVATIONS
// ──────────────────────────────────────────────

/**
 * Add an observation/note to a patient
 */
export async function addObservation(params: {
  patientId: string
  clinicId: string
  authorId: string
  authorName: string
  content: string
  visibility?: NoteVisibility
}): Promise<PatientObservation | null> {
  const db = getDb()

  try {
    const [row] = await db
      .insert(patientObservations)
      .values({
        patientId: params.patientId,
        clinicId: params.clinicId,
        content: params.content,
        createdBy: params.authorId,
      })
      .returning()

    if (!row) return null

    return {
      id: row.id,
      patient_id: row.patientId,
      clinic_id: row.clinicId,
      author_id: row.createdBy || '',
      author_name: params.authorName,
      content: row.content,
      visibility: (params.visibility || 'public') as NoteVisibility,
      created_at: row.createdAt ?? new Date(),
    }
  } catch (error) {
    dbLogger.error('Error adding observation', error)
    return null
  }
}

/**
 * Get observations for a patient
 */
export async function getObservations(
  patientId: string,
  options?: { visibility?: NoteVisibility; limit?: number }
): Promise<PatientObservation[]> {
  const db = getDb()

  try {
    const rows = await db
      .select()
      .from(patientObservations)
      .where(eq(patientObservations.patientId, patientId))
      .limit(options?.limit || 50)

    // Map to interface — visibility not in schema, default to 'public'
    return rows.map(r => ({
      id: r.id,
      patient_id: r.patientId,
      clinic_id: r.clinicId,
      author_id: r.createdBy || '',
      author_name: '', // not in schema
      content: r.content,
      visibility: 'public' as NoteVisibility,
      created_at: r.createdAt ?? new Date(),
    }))
  } catch (error) {
    dbLogger.error('Error fetching observations', error)
    return []
  }
}

/**
 * Delete an observation
 */
export async function deleteObservation(
  observationId: string,
  _authorId: string
): Promise<boolean> {
  const db = getDb()

  try {
    await db
      .delete(patientObservations)
      .where(eq(patientObservations.id, observationId))
    return true
  } catch (error) {
    dbLogger.error('Error deleting observation', error)
    return false
  }
}

// ──────────────────────────────────────────────
// PREFERENCES
// ──────────────────────────────────────────────

/**
 * Set a patient preference (upsert by patient_id + key)
 */
export async function setPreference(params: {
  patientId: string
  clinicId: string
  key: string
  value: string
  category: PatientPreference['category']
}): Promise<PatientPreference | null> {
  const db = getDb()

  try {
    // Upsert: update if exists, insert if not
    const existing = await db
      .select()
      .from(patientPreferences)
      .where(and(eq(patientPreferences.patientId, params.patientId), eq(patientPreferences.key, params.key)))
      .limit(1)

    if (existing.length > 0) {
      const [updated] = await db
        .update(patientPreferences)
        .set({ value: params.value, category: params.category, updatedAt: new Date() })
        .where(and(eq(patientPreferences.patientId, params.patientId), eq(patientPreferences.key, params.key)))
        .returning()

      if (!updated) return null
      return {
        id: updated.id,
        patient_id: updated.patientId,
        clinic_id: updated.clinicId,
        key: updated.key,
        value: updated.value,
        category: updated.category as PatientPreference['category'],
        updated_at: updated.updatedAt ?? new Date(),
      }
    } else {
      const [inserted] = await db
        .insert(patientPreferences)
        .values({
          patientId: params.patientId,
          clinicId: params.clinicId,
          key: params.key,
          value: params.value,
          category: params.category,
        })
        .returning()

      if (!inserted) return null
      return {
        id: inserted.id,
        patient_id: inserted.patientId,
        clinic_id: inserted.clinicId,
        key: inserted.key,
        value: inserted.value,
        category: inserted.category as PatientPreference['category'],
        updated_at: inserted.updatedAt ?? new Date(),
      }
    }
  } catch (error) {
    dbLogger.error('Error setting preference', error)
    return null
  }
}

/**
 * Get all preferences for a patient, optionally filtered by category
 */
export async function getPreferences(
  patientId: string,
  category?: PatientPreference['category']
): Promise<PatientPreference[]> {
  const db = getDb()

  try {
    const conditions = [eq(patientPreferences.patientId, patientId)]
    if (category) {
      conditions.push(eq(patientPreferences.category, category))
    }

    const rows = await db
      .select()
      .from(patientPreferences)
      .where(and(...conditions))

    return rows.map(r => ({
      id: r.id,
      patient_id: r.patientId,
      clinic_id: r.clinicId,
      key: r.key,
      value: r.value,
      category: r.category as PatientPreference['category'],
      updated_at: r.updatedAt ?? new Date(),
    }))
  } catch (error) {
    dbLogger.error('Error fetching preferences', error)
    return []
  }
}

/**
 * Get preferences that influence scheduling
 */
export async function getSchedulingPreferences(
  patientId: string
): Promise<Record<string, string>> {
  const prefs = await getPreferences(patientId, 'scheduling')
  const result: Record<string, string> = {}
  for (const pref of prefs) {
    result[pref.key] = pref.value
  }
  return result
}