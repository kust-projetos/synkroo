/**
 * Attendance Metrics Service
 * Tracks message volume, intent distribution, response time, and period comparison
 * Migrated from Supabase to Drizzle ORM.
 */

import { eq, and, gte, lte, lt, isNotNull, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { agentLogs, conversations } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface AttendanceMetrics {
  period: { start: string; end: string }
  messageVolume: {
    total: number
    byChannel: Record<string, number>
    byDay: Array<{ date: string; count: number }>
  }
  intentDistribution: Array<{ intent: string; count: number; percentage: number }>
  responseTime: {
    averageMs: number
    medianMs: number
    p95Ms: number
    byIntent: Record<string, number>
  }
  comparison?: {
    previousPeriod: {
      messageVolume: number
      avgResponseMs: number
    }
    volumeChange: number
    responseTimeChange: number
  }
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0
  return sorted[Math.floor(sorted.length / 2)]
}

function p95(sorted: number[]): number {
  if (!sorted.length) return 0
  return sorted[Math.floor(sorted.length * 0.95)]
}

export async function getAttendanceMetrics(params: {
  clinicId: string
  startDate: string
  endDate: string
  compareWithPrevious?: boolean
}): Promise<AttendanceMetrics | null> {
  const db = getDb()

  try {
    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)

    // Message volume by channel from conversations
    const convRows = await db.select({
      channel: conversations.channel,
      createdAt: conversations.createdAt,
    })
      .from(conversations)
      .where(and(
        eq(conversations.clinicId, params.clinicId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate),
      ))

    const byChannel: Record<string, number> = {}
    const byDayMap = new Map<string, number>()
    let totalMessages = 0

    for (const conv of convRows) {
      const channel = conv.channel ?? 'unknown'
      byChannel[channel] = (byChannel[channel] || 0) + 1
      totalMessages++

      const day = new Date(conv.createdAt!).toISOString().split('T')[0]
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1)
    }

    const byDay = [...byDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Intent distribution from agent classifications
    const intentRows = await db.select({
      intent: agentLogs.intent,
    })
      .from(agentLogs)
      .where(and(
        eq(agentLogs.clinicId, params.clinicId),
        gte(agentLogs.createdAt, startDate),
        lte(agentLogs.createdAt, endDate),
      ))

    const intentCounts: Record<string, number> = {}
    let totalIntents = 0

    for (const log of intentRows) {
      const intent = log.intent ?? 'unknown'
      intentCounts[intent] = (intentCounts[intent] || 0) + 1
      totalIntents++
    }

    const intentDistribution = Object.entries(intentCounts)
      .map(([intent, count]) => ({
        intent,
        count,
        percentage: totalIntents > 0 ? Math.round((count / totalIntents) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Response time from agent logs (only rows with response_time_ms)
    const responseRows = await db.select({
      responseTimeMs: agentLogs.responseTimeMs,
      intent: agentLogs.intent,
    })
      .from(agentLogs)
      .where(and(
        eq(agentLogs.clinicId, params.clinicId),
        gte(agentLogs.createdAt, startDate),
        lte(agentLogs.createdAt, endDate),
        isNotNull(agentLogs.responseTimeMs),
      ))

    const responseTimes: number[] = []
    const responseByIntent: Record<string, number[]> = {}

    for (const log of responseRows) {
      const rt = log.responseTimeMs
      if (rt && rt > 0) {
        responseTimes.push(rt)
        const intent = log.intent ?? 'unknown'
        if (!responseByIntent[intent]) responseByIntent[intent] = []
        responseByIntent[intent].push(rt)
      }
    }

    const sortedTimes = [...responseTimes].sort((a, b) => a - b)
    const avgResponseMs = avg(responseTimes)
    const medianMs = median(sortedTimes)
    const p95Ms = p95(sortedTimes)

    const byIntentAvg: Record<string, number> = {}
    for (const [intent, times] of Object.entries(responseByIntent)) {
      byIntentAvg[intent] = avg(times)
    }

    const result: AttendanceMetrics = {
      period: { start: params.startDate, end: params.endDate },
      messageVolume: { total: totalMessages, byChannel, byDay },
      intentDistribution,
      responseTime: {
        averageMs: avgResponseMs,
        medianMs,
        p95Ms,
        byIntent: byIntentAvg,
      },
    }

    // Period comparison
    if (params.compareWithPrevious) {
      const start = new Date(params.startDate)
      const end = new Date(params.endDate)
      const durationMs = end.getTime() - start.getTime()
      const prevStart = new Date(start.getTime() - durationMs)
      const prevEnd = new Date(params.startDate)

      const prevConvs = await db.select({ id: conversations.id })
        .from(conversations)
        .where(and(
          eq(conversations.clinicId, params.clinicId),
          gte(conversations.createdAt, prevStart),
          lt(conversations.createdAt, prevEnd),
        ))

      const prevVolume = prevConvs.length
      const volumeChange = prevVolume > 0
        ? Math.round(((totalMessages - prevVolume) / prevVolume) * 100)
        : 0

      result.comparison = {
        previousPeriod: {
          messageVolume: prevVolume,
          avgResponseMs: 0,
        },
        volumeChange,
        responseTimeChange: 0,
      }
    }

    return result
  } catch (error) {
    dbLogger.error('Error fetching attendance metrics', error)
    return null
  }
}
