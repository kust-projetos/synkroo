/**
 * Pipeline Analytics Service
 * Provides aggregation functions for pipeline conversion analytics
 *
 * Supports REPORT-01: Conversion rates by stage
 * Supports REPORT-02: Average lead-to-patient conversion time
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StageConversion {
  stageId: string
  stageName: string
  stageColor: string
  position: number
  totalLeads: number
  convertedLeads: number
  conversionRate: number // 0-100
}

// ─── Conversion by Stage ──────────────────────────────────────────────────────

/**
 * Get lead conversion rates grouped by pipeline stage
 *
 * Aggregates leads per stage, counting total and converted leads
 * to calculate per-stage conversion rates.
 *
 * @param clinicId - The clinic's UUID
 * @returns Array of StageConversion sorted by stage position
 */
export async function getConversionByStage(clinicId: string): Promise<StageConversion[]> {
  const supabase = await createTypedClient()

  try {
    // Get all pipeline stages for the clinic
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('id, name, color, position')
      .eq('clinic_id', clinicId)
      .order('position', { ascending: true })

    if (stagesError) {
      dbLogger.error('Error fetching pipeline stages', stagesError)
      return []
    }

    if (!stages || stages.length === 0) {
      return []
    }

    // Get lead counts per stage
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('stage_id, converted_at')
      .eq('clinic_id', clinicId)

    if (leadsError) {
      dbLogger.error('Error fetching leads for conversion', leadsError)
      return []
    }

    // Group leads by stage and calculate conversions
    const stageMap = new Map<string, { total: number; converted: number }>()

    // Initialize all stages with zero counts
    for (const stage of stages) {
      stageMap.set(stage.id, { total: 0, converted: 0 })
    }

    // Count leads per stage
    for (const lead of leads || []) {
      if (lead.stage_id) {
        const current = stageMap.get(lead.stage_id)
        if (current) {
          current.total++
          if (lead.converted_at) {
            current.converted++
          }
        }
      }
    }

    // Build result array with conversion rates
    const result: StageConversion[] = stages.map((stage) => {
      const counts = stageMap.get(stage.id) || { total: 0, converted: 0 }
      const conversionRate = counts.total > 0
        ? Math.round((counts.converted / counts.total) * 10000) / 100 // 2 decimal places
        : 0

      return {
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color || '#6366f1',
        position: stage.position,
        totalLeads: counts.total,
        convertedLeads: counts.converted,
        conversionRate,
      }
    })

    return result
  } catch (error) {
    dbLogger.error('Error in getConversionByStage', error)
    return []
  }
}

// ─── Average Conversion Time ───────────────────────────────────────────────────

/**
 * Calculate average lead-to-patient conversion time
 *
 * @param clinicId - The clinic's UUID
 * @returns Average days from lead creation to conversion, rounded to 1 decimal
 */
export async function getAvgConversionTime(clinicId: string): Promise<number> {
  const supabase = await createTypedClient()

  try {
    // Get leads that have been converted
    const { data: convertedLeads, error } = await supabase
      .from('leads')
      .select('created_at, converted_at')
      .eq('clinic_id', clinicId)
      .not('converted_at', 'is', null)

    if (error) {
      dbLogger.error('Error fetching converted leads', error)
      return 0
    }

    if (!convertedLeads || convertedLeads.length === 0) {
      return 0
    }

    // Calculate conversion time for each lead
    const conversionTimes: number[] = []

    for (const lead of convertedLeads) {
      if (lead.created_at && lead.converted_at) {
        const created = new Date(lead.created_at)
        const converted = new Date(lead.converted_at)
        const diffTime = Math.abs(converted.getTime() - created.getTime())
        const diffDays = diffTime / (1000 * 60 * 60 * 24)
        conversionTimes.push(diffDays)
      }
    }

    if (conversionTimes.length === 0) {
      return 0
    }

    // Calculate average
    const sum = conversionTimes.reduce((acc, val) => acc + val, 0)
    const avg = sum / conversionTimes.length

    // Round to 1 decimal place
    return Math.round(avg * 10) / 10
  } catch (error) {
    dbLogger.error('Error in getAvgConversionTime', error)
    return 0
  }
}
