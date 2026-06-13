/**
 * Patient Deduplication Service
 * Detects and merges duplicate patient records using Drizzle
 */

import { eq, and, inArray, sql, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients, appointments, conversations, leads } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface DuplicatePair {
  primary: {
    id: string
    name: string
    phone: string
    email: string | null
    cpf: string | null
    created_at: Date
    appointment_count: number
  }
  secondary: {
    id: string
    name: string
    phone: string
    email: string | null
    cpf: string | null
    created_at: Date
    appointment_count: number
  }
  match_reason: 'phone' | 'cpf' | 'name_phone'
  confidence: number
}

/**
 * Detect duplicate patients for a clinic
 */
export async function detectDuplicates(clinicId: string): Promise<DuplicatePair[]> {
  const db = getDb()

  try {
    // Get active patients for the clinic
    const patientRows = await db
      .select({
        id: patients.id,
        name: patients.name,
        phone: patients.phone,
        email: patients.email,
        cpf: patients.cpf,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), sql`${patients.deletedAt} IS NULL`))

    // Get appointment counts
    const aptRows = await db
      .select({ patientId: appointments.patientId })
      .from(appointments)
      .where(eq(appointments.clinicId, clinicId))

    const countMap = new Map<string, number>()
    for (const apt of aptRows) {
      if (apt.patientId) {
        countMap.set(apt.patientId, (countMap.get(apt.patientId) || 0) + 1)
      }
    }

    const duplicates: DuplicatePair[] = []
    const processed = new Set<string>()

    for (let i = 0; i < patientRows.length; i++) {
      for (let j = i + 1; j < patientRows.length; j++) {
        const a = patientRows[i]
        const b = patientRows[j]
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
              created_at: primary.createdAt ?? new Date(0),
              appointment_count: countMap.get(primary.id) || 0,
            },
            secondary: {
              id: secondary.id,
              name: secondary.name,
              phone: secondary.phone,
              email: secondary.email,
              cpf: secondary.cpf,
              created_at: secondary.createdAt ?? new Date(0),
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
  const db = getDb()

  try {
    // Get both patients
    const patientRows = await db
      .select()
      .from(patients)
      .where(and(inArray(patients.id, [primaryId, secondaryId]), eq(patients.clinicId, clinicId)))

    const primary = patientRows.find(p => p.id === primaryId)
    const secondary = patientRows.find(p => p.id === secondaryId)

    if (!primary || !secondary) {
      return { success: false, error: 'Patient not found' }
    }

    // Merge data: keep most complete info
    const mergedData: Record<string, unknown> = { updatedAt: new Date() }
    if (!primary.email && secondary.email) mergedData.email = secondary.email
    if (!primary.cpf && secondary.cpf) mergedData.cpf = secondary.cpf
    if (!primary.birthDate && secondary.birthDate) mergedData.birthDate = secondary.birthDate

    // Merge tags
    const primaryTags = primary.tags || []
    const secondaryTags = secondary.tags || []
    mergedData.tags = [...new Set([...primaryTags, ...secondaryTags])]

    // Update primary patient with merged data
    await db.update(patients).set(mergedData as any).where(eq(patients.id, primaryId))

    // Reassign all appointments from secondary to primary
    await db
      .update(appointments)
      .set({ patientId: primaryId, updatedAt: new Date() })
      .where(eq(appointments.patientId, secondaryId))

    // Reassign conversations (non-fatal on failure)
    try {
      await db
        .update(conversations)
        .set({ patientId: primaryId, updatedAt: new Date() })
        .where(eq(conversations.patientId, secondaryId))
    } catch (warn) {
      dbLogger.warn('Error reassigning conversations', { message: (warn as Error).message })
    }

    // Reassign leads (non-fatal on failure)
    try {
      await db
        .update(leads)
        .set({ patientId: primaryId })
        .where(eq(leads.patientId, secondaryId))
    } catch (warn) {
      dbLogger.warn('Error reassigning leads', { message: (warn as Error).message })
    }

    // Soft-delete secondary patient
    await db
      .update(patients)
      .set({
        deletedAt: new Date(),
        name: `[MERGED INTO ${primaryId}] ${secondary.name}`,
        updatedAt: new Date(),
      } as any)
      .where(eq(patients.id, secondaryId))

    dbLogger.info('Patients merged', { primaryId, secondaryId })

    return { success: true }
  } catch (error) {
    dbLogger.error('Error merging patients', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^55/, '')
}

function calculateNameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8

  const setA = new Set(na.split(''))
  const setB = new Set(nb.split(''))
  const intersection = [...setA].filter((c) => setB.has(c)).length
  const union = new Set([...setA, ...setB]).size

  return union > 0 ? intersection / union : 0
}