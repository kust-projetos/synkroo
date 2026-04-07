/**
 * Campaign Segmentation Service
 * Create segments combining multiple criteria for targeted campaigns
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface SegmentCriteria {
  lastVisitMin?: number // days since last visit (minimum)
  lastVisitMax?: number // days since last visit (maximum)
  procedures?: string[] // procedure names
  tags?: string[] // patient tags
  ageMin?: number
  ageMax?: number
  totalSpentMin?: number
  totalSpentMax?: number
  source?: string[] // acquisition source
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

/**
 * Create a segment with criteria
 */
export async function createSegment(params: {
  clinicId: string
  name: string
  description?: string
  criteria: SegmentCriteria
  createdBy?: string
}): Promise<Segment | null> {
  const supabase = await createTypedClient()

  try {
    // Preview patient count first
    const patientCount = await previewSegmentSize(params.clinicId, params.criteria)

    const { data, error } = await (supabase
      .from('campaign_segments') as any)
      .insert({
        clinic_id: params.clinicId,
        name: params.name,
        description: params.description || null,
        criteria: params.criteria,
        patient_count: patientCount,
        created_by: params.createdBy || null,
      })
      .select()
      .single()

    if (error) throw error

    return data as Segment
  } catch (error) {
    dbLogger.error('Error creating segment', error)
    return null
  }
}

/**
 * Preview how many patients match criteria
 */
export async function previewSegmentSize(
  clinicId: string,
  criteria: SegmentCriteria
): Promise<number> {
  const supabase = await createTypedClient()

  try {
    let query = supabase
      .from('patients')
      .select('id, birth_date, tags, created_at', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)

    if (criteria.status === 'inactive') {
      query = query.eq('status', 'inactive')
    } else if (criteria.status === 'active') {
      query = query.neq('status', 'inactive')
    }

    if (criteria.tags && criteria.tags.length > 0) {
      query = query.overlaps('tags', criteria.tags)
    }

    if (criteria.ageMin) {
      const maxBirth = new Date()
      maxBirth.setFullYear(maxBirth.getFullYear() - criteria.ageMin)
      query = query.lte('birth_date', maxBirth.toISOString().split('T')[0])
    }

    if (criteria.ageMax) {
      const minBirth = new Date()
      minBirth.setFullYear(minBirth.getFullYear() - criteria.ageMax)
      query = query.gte('birth_date', minBirth.toISOString().split('T')[0])
    }

    const { count, error } = await query

    if (error) throw error

    // For criteria requiring appointment data, do additional filtering
    let patientCount = count || 0

    if (criteria.procedures || criteria.lastVisitMin || criteria.lastVisitMax || criteria.totalSpentMin) {
      const { data: patients } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)

      if (patients && patients.length > 0) {
        const patientIds = patients.map((p: any) => p.id)

        const aptQuery = supabase
          .from('appointments')
          .select('patient_id, scheduled_at, procedures (name), total_value')
          .in('patient_id', patientIds)
          .eq('clinic_id', clinicId)
          .eq('status', 'completed')

        const { data: appointments } = await aptQuery

        const patientMatchSet = new Set<string>()
        for (const apt of appointments || []) {
          const pid = (apt as any).patient_id
          let matches = true

          if (criteria.lastVisitMin || criteria.lastVisitMax) {
            const aptDate = new Date((apt as any).scheduled_at)
            const daysSince = Math.floor(
              (Date.now() - aptDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            if (criteria.lastVisitMin && daysSince < criteria.lastVisitMin) matches = false
            if (criteria.lastVisitMax && daysSince > criteria.lastVisitMax) matches = false
          }

          if (criteria.procedures && criteria.procedures.length > 0) {
            const procName = ((apt as any).procedures as any)?.name || ''
            if (!criteria.procedures.some((p) => procName.toLowerCase().includes(p.toLowerCase()))) {
              matches = false
            }
          }

          if (matches) patientMatchSet.add(pid)
        }

        patientCount = patientMatchSet.size
      }
    }

    return patientCount
  } catch (error) {
    dbLogger.error('Error previewing segment', error)
    return 0
  }
}

/**
 * Get patients matching a segment's criteria
 */
export async function getSegmentPatients(
  clinicId: string,
  criteria: SegmentCriteria,
  limit: number = 100
): Promise<Array<{ id: string; name: string; phone: string }>> {
  const supabase = await createTypedClient()

  try {
    let query = supabase
      .from('patients')
      .select('id, name, phone, tags')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)

    if (criteria.tags && criteria.tags.length > 0) {
      query = query.overlaps('tags', criteria.tags)
    }

    const { data: patients } = await query.limit(limit)

    return (patients || []) as any[]
  } catch (error) {
    dbLogger.error('Error getting segment patients', error)
    return []
  }
}

/**
 * List saved segments for a clinic
 */
export async function listSegments(clinicId: string): Promise<Segment[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('campaign_segments')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []) as Segment[]
  } catch (error) {
    dbLogger.error('Error listing segments', error)
    return []
  }
}
