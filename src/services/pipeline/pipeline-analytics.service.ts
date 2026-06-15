/**
 * Pipeline Analytics Service — migrated to Drizzle
 * Aggregation functions for pipeline conversion analytics
 */

import { eq, and, asc, isNotNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { pipelineStages, leads } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface StageConversion {
  stageId: string
  stageName: string
  stageColor: string
  sortOrder: number
  totalLeads: number
  convertedLeads: number
  conversionRate: number
}

export async function getConversionByStage(clinicId: string): Promise<StageConversion[]> {
  const db = getDb()

  try {
    const stages = await db
      .select({
        id: pipelineStages.id,
        name: pipelineStages.name,
        color: pipelineStages.color,
        position: pipelineStages.position,
      })
      .from(pipelineStages)
      .where(eq(pipelineStages.clinicId, clinicId))
      .orderBy(asc(pipelineStages.position))

    if (!stages.length) return []

    const leadRows = await db
      .select({ stageId: leads.stageId, convertedAt: leads.convertedAt })
      .from(leads)
      .where(eq(leads.clinicId, clinicId))

    const stageMap = new Map<string, { total: number; converted: number }>()
    for (const s of stages) {
      stageMap.set(s.id, { total: 0, converted: 0 })
    }
    for (const l of leadRows) {
      if (l.stageId) {
        const cur = stageMap.get(l.stageId)
        if (cur) {
          cur.total++
          if (l.convertedAt) cur.converted++
        }
      }
    }

    return stages.map((s) => {
      const counts = stageMap.get(s.id) || { total: 0, converted: 0 }
      const conversionRate = counts.total > 0 ? Math.round((counts.converted / counts.total) * 10000) / 100 : 0
      return {
        stageId: s.id,
        stageName: s.name,
        stageColor: s.color || '#6366f1',
        sortOrder: s.position ?? 0,
        totalLeads: counts.total,
        convertedLeads: counts.converted,
        conversionRate,
      }
    })
  } catch (error) {
    dbLogger.error('Error in getConversionByStage', error)
    return []
  }
}

export async function getAvgConversionTime(clinicId: string): Promise<number> {
  const db = getDb()

  try {
    const convertedLeads = await db
      .select({ createdAt: leads.createdAt, convertedAt: leads.convertedAt })
      .from(leads)
      .where(and(eq(leads.clinicId, clinicId), isNotNull(leads.convertedAt)))

    if (!convertedLeads.length) return 0

    const times: number[] = []
    for (const l of convertedLeads) {
      if (l.createdAt && l.convertedAt) {
        const diffMs = Math.abs(l.convertedAt.getTime() - l.createdAt.getTime())
        times.push(diffMs / 86400000)
      }
    }

    if (!times.length) return 0
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    return Math.round(avg * 10) / 10
  } catch (error) {
    dbLogger.error('Error in getAvgConversionTime', error)
    return 0
  }
}
