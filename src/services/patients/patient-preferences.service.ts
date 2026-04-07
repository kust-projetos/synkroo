/**
 * Patient Preferences & Observations Service
 * Manages patient observations, preferences, and private notes
 */

import { createTypedClient } from '@/lib/supabase/typed'
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
  created_at: string
}

export interface PatientPreference {
  id: string
  patient_id: string
  clinic_id: string
  key: string
  value: string
  category: 'scheduling' | 'communication' | 'clinical' | 'general'
  updated_at: string
}

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
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('patient_observations')
      .insert({
        patient_id: params.patientId,
        clinic_id: params.clinicId,
        author_id: params.authorId,
        author_name: params.authorName,
        content: params.content,
        visibility: params.visibility || 'public',
      })
      .select()
      .single()

    if (error) throw error

    return data as PatientObservation
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
  const supabase = await createTypedClient()

  try {
    let query = supabase
      .from('patient_observations')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (options?.visibility) {
      query = query.eq('visibility', options.visibility)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []) as PatientObservation[]
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
  authorId: string
): Promise<boolean> {
  const supabase = await createTypedClient()

  try {
    const { error } = await supabase
      .from('patient_observations')
      .delete()
      .eq('id', observationId)
      .eq('author_id', authorId)

    if (error) throw error

    return true
  } catch (error) {
    dbLogger.error('Error deleting observation', error)
    return false
  }
}

/**
 * Set a patient preference
 */
export async function setPreference(params: {
  patientId: string
  clinicId: string
  key: string
  value: string
  category: PatientPreference['category']
}): Promise<PatientPreference | null> {
  const supabase = await createTypedClient()

  try {
    // Upsert: update if exists, insert if not
    const { data, error } = await supabase
      .from('patient_preferences')
      .upsert(
        {
          patient_id: params.patientId,
          clinic_id: params.clinicId,
          key: params.key,
          value: params.value,
          category: params.category,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'patient_id,key' }
      )
      .select()
      .single()

    if (error) throw error

    return data as PatientPreference
  } catch (error) {
    dbLogger.error('Error setting preference', error)
    return null
  }
}

/**
 * Get all preferences for a patient
 */
export async function getPreferences(
  patientId: string,
  category?: PatientPreference['category']
): Promise<PatientPreference[]> {
  const supabase = await createTypedClient()

  try {
    let query = supabase
      .from('patient_preferences')
      .select('*')
      .eq('patient_id', patientId)

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []) as PatientPreference[]
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
