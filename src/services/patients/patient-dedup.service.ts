/**
 * Patient Deduplication Service
 * Detects and merges duplicate patient records
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface DuplicatePair {
  primary: {
    id: string
    name: string
    phone: string
    email: string | null
    cpf: string | null
    created_at: string
    appointment_count: number
  }
  secondary: {
    id: string
    name: string
    phone: string
    email: string | null
    cpf: string | null
    created_at: string
    appointment_count: number
  }
  match_reason: 'phone' | 'cpf' | 'name_phone'
  confidence: number // 0-1
}

/**
 * Detect duplicate patients for a clinic
 */
export async function detectDuplicates(clinicId: string): Promise<DuplicatePair[]> {
  const supabase = await createTypedClient()

  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, phone, email, cpf, created_at')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)

    if (error) throw error

    const duplicates: DuplicatePair[] = []
    const processed = new Set<string>()

    // Get appointment counts
    const { data: appointmentCounts } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('clinic_id', clinicId)

    const countMap = new Map<string, number>()
    for (const apt of appointmentCounts || []) {
      const pid = (apt as any).patient_id
      countMap.set(pid, (countMap.get(pid) || 0) + 1)
    }

    for (let i = 0; i < (patients || []).length; i++) {
      for (let j = i + 1; j < (patients || []).length; j++) {
        const a = (patients || [])[i] as any
        const b = (patients || [])[j] as any
        const pairKey = [a.id, b.id].sort().join('_')

        if (processed.has(pairKey)) continue

        let matchReason: DuplicatePair['match_reason'] | null = null
        let confidence = 0

        // CPF match (strongest)
        if (a.cpf && b.cpf && a.cpf === b.cpf) {
          matchReason = 'cpf'
          confidence = 0.95
        }
        // Phone match
        else if (a.phone && b.phone && normalizePhone(a.phone) === normalizePhone(b.phone)) {
          // Also check name similarity
          const nameSimilarity = calculateNameSimilarity(a.name, b.name)
          if (nameSimilarity > 0.6) {
            matchReason = 'name_phone'
            confidence = 0.9
          } else {
            matchReason = 'phone'
            confidence = 0.7
          }
        }

        if (matchReason) {
          processed.add(pairKey)

          // Determine primary (more data / older / more appointments)
          const aCount = countMap.get(a.id) || 0
          const bCount = countMap.get(b.id) || 0
          const aData = (a.email ? 1 : 0) + (a.cpf ? 1 : 0)
          const bData = (b.email ? 1 : 0) + (b.cpf ? 1 : 0)

          const aIsPrimary = aCount > bCount || (aCount === bCount && aData >= bData)

          const primary = aIsPrimary ? a : b
          const secondary = aIsPrimary ? b : a

          duplicates.push({
            primary: {
              id: primary.id,
              name: primary.name,
              phone: primary.phone,
              email: primary.email,
              cpf: primary.cpf,
              created_at: primary.created_at,
              appointment_count: countMap.get(primary.id) || 0,
            },
            secondary: {
              id: secondary.id,
              name: secondary.name,
              phone: secondary.phone,
              email: secondary.email,
              cpf: secondary.cpf,
              created_at: secondary.created_at,
              appointment_count: countMap.get(secondary.id) || 0,
            },
            match_reason: matchReason,
            confidence,
          })
        }
      }
    }

    return duplicates.sort((a, b) => b.confidence - a.confidence)
  } catch (error) {
    dbLogger.error('Error detecting duplicates', error)
    return []
  }
}

/**
 * Merge two patient records
 */
export async function mergePatients(
  primaryId: string,
  secondaryId: string,
  clinicId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  try {
    // Get both patients
    const { data: patients, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .in('id', [primaryId, secondaryId])
      .eq('clinic_id', clinicId)

    if (fetchError) throw fetchError

    const primary = (patients || []).find((p: any) => p.id === primaryId) as any
    const secondary = (patients || []).find((p: any) => p.id === secondaryId) as any

    if (!primary || !secondary) {
      return { success: false, error: 'Patient not found' }
    }

    // Merge data: keep most complete info
    const mergedData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Take secondary's data if primary's is empty
    if (!primary.email && secondary.email) mergedData.email = secondary.email
    if (!primary.cpf && secondary.cpf) mergedData.cpf = secondary.cpf
    if (!primary.birth_date && secondary.birth_date) mergedData.birth_date = secondary.birth_date
    if (!primary.address && secondary.address) mergedData.address = secondary.address

    // Merge tags
    const primaryTags: string[] = primary.tags || []
    const secondaryTags: string[] = secondary.tags || []
    mergedData.tags = [...new Set([...primaryTags, ...secondaryTags])]

    // Update primary patient with merged data
    const { error: updateError } = await (supabase
      .from('patients') as any)
      .update(mergedData)
      .eq('id', primaryId)

    if (updateError) throw updateError

    // Reassign all appointments from secondary to primary
    const { error: aptError } = await (supabase
      .from('appointments') as any)
      .update({ patient_id: primaryId })
      .eq('patient_id', secondaryId)

    if (aptError) throw aptError

    // Reassign conversations
    const { error: convError } = await (supabase
      .from('conversations') as any)
      .update({ patient_id: primaryId })
      .eq('patient_id', secondaryId)

    if (convError) {
      dbLogger.warn('Error reassigning conversations', { message: convError.message, code: convError.code })
    }

    // Reassign leads
    const { error: leadError } = await (supabase
      .from('leads') as any)
      .update({ patient_id: primaryId })
      .eq('patient_id', secondaryId)

    if (leadError) {
      dbLogger.warn('Error reassigning leads', { message: leadError.message, code: leadError.code })
    }

    // Soft-delete secondary patient
    const { error: deleteError } = await (supabase
      .from('patients') as any)
      .update({
        deleted_at: new Date().toISOString(),
        name: `[MERGED INTO ${primaryId}] ${secondary.name}`,
      })
      .eq('id', secondaryId)

    if (deleteError) throw deleteError

    dbLogger.info('Patients merged', { primaryId, secondaryId })

    return { success: true }
  } catch (error) {
    dbLogger.error('Error merging patients', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^55/, '')
}

/**
 * Calculate name similarity (Levenshtein-based ratio)
 */
function calculateNameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return 1

  // Check if one name contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.8

  // Simple character overlap ratio
  const setA = new Set(na.split(''))
  const setB = new Set(nb.split(''))
  const intersection = [...setA].filter((c) => setB.has(c)).length
  const union = new Set([...setA, ...setB]).size

  return union > 0 ? intersection / union : 0
}
