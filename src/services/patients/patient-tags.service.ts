/**
 * Patient Tags Service
 * Manages tags for patient segmentation and filtering
 */

import { createTypedClient } from '@/lib/supabase/typed'
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
  const supabase = await createTypedClient()

  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('tags')
      .eq('clinic_id', clinicId)

    if (error) throw error

    const tagSet = new Set<string>()
    for (const patient of patients || []) {
      const tags = (patient as any).tags as string[] | null
      if (tags) {
        for (const tag of tags) {
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
  const supabase = await createTypedClient()

  try {
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('tags')
      .eq('id', patientId)
      .single()

    if (fetchError) throw fetchError

    const currentTags: string[] = (patient as any).tags || []
    if (currentTags.includes(tag)) return true

    const newTags = [...currentTags, tag]

    const { error: updateError } = await supabase
      .from('patients')
      .update({ tags: newTags, updated_at: new Date().toISOString() })
      .eq('id', patientId)

    if (updateError) throw updateError

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
  const supabase = await createTypedClient()

  try {
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('tags')
      .eq('id', patientId)
      .single()

    if (fetchError) throw fetchError

    const currentTags: string[] = (patient as any).tags || []
    const newTags = currentTags.filter((t) => t !== tag)

    const { error: updateError } = await supabase
      .from('patients')
      .update({ tags: newTags, updated_at: new Date().toISOString() })
      .eq('id', patientId)

    if (updateError) throw updateError

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
  const supabase = await createTypedClient()

  try {
    const { error } = await supabase
      .from('patients')
      .update({ tags, updated_at: new Date().toISOString() })
      .eq('id', patientId)

    if (error) throw error

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
  const supabase = await createTypedClient()

  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, phone, tags')
      .eq('clinic_id', clinicId)
      .contains('tags', [tag])

    if (error) throw error

    return (patients || []) as any[]
  } catch (error) {
    dbLogger.error('Error fetching patients by tag', error)
    return []
  }
}
