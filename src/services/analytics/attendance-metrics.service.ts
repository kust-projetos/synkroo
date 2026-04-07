/**
 * Attendance Metrics Service
 * Tracks message volume, intent distribution, response time, and period comparison
 */

import { createTypedClient } from '@/lib/supabase/typed'
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
    volumeChange: number // percentage
    responseTimeChange: number // percentage
  }
}

/**
 * Get attendance metrics for a clinic
 */
export async function getAttendanceMetrics(params: {
  clinicId: string
  startDate: string
  endDate: string
  compareWithPrevious?: boolean
}): Promise<AttendanceMetrics | null> {
  const supabase = await createTypedClient()

  try {
    // Message volume by channel
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('channel, created_at, metadata')
      .eq('clinic_id', params.clinicId)
      .gte('created_at', params.startDate)
      .lte('created_at', params.endDate)

    if (convError) throw convError

    // Calculate message volume
    const byChannel: Record<string, number> = {}
    const byDayMap = new Map<string, number>()
    let totalMessages = 0

    for (const conv of conversations || []) {
      const channel = (conv as any).channel || 'unknown'
      byChannel[channel] = (byChannel[channel] || 0) + 1
      totalMessages++

      const day = new Date(conv.created_at).toISOString().split('T')[0]
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1)
    }

    const byDay = [...byDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Intent distribution from agent classifications
    const { data: agentLogs } = await supabase
      .from('agent_logs')
      .select('intent, confidence')
      .eq('clinic_id', params.clinicId)
      .gte('created_at', params.startDate)
      .lte('created_at', params.endDate)

    const intentCounts: Record<string, number> = {}
    let totalIntents = 0

    for (const log of agentLogs || []) {
      const intent = (log as any).intent || 'unknown'
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

    // Response time from agent logs
    const { data: responseLogs } = await supabase
      .from('agent_logs')
      .select('response_time_ms, intent')
      .eq('clinic_id', params.clinicId)
      .gte('created_at', params.startDate)
      .lte('created_at', params.endDate)
      .not('response_time_ms', 'is', null)

    const responseTimes: number[] = []
    const responseByIntent: Record<string, number[]> = {}

    for (const log of responseLogs || []) {
      const rt = (log as any).response_time_ms
      if (rt && rt > 0) {
        responseTimes.push(rt)
        const intent = (log as any).intent || 'unknown'
        if (!responseByIntent[intent]) responseByIntent[intent] = []
        responseByIntent[intent].push(rt)
      }
    }

    const avgResponseMs = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0

    const sortedTimes = [...responseTimes].sort((a, b) => a - b)
    const medianMs = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0
    const p95Ms = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
      : 0

    const byIntentAvg: Record<string, number> = {}
    for (const [intent, times] of Object.entries(responseByIntent)) {
      byIntentAvg[intent] = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
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
      const prevStart = new Date(start.getTime() - durationMs).toISOString()
      const prevEnd = params.startDate

      const { data: prevConvs } = await supabase
        .from('conversations')
        .select('id')
        .eq('clinic_id', params.clinicId)
        .gte('created_at', prevStart)
        .lt('created_at', prevEnd)

      const prevVolume = (prevConvs || []).length
      const volumeChange = prevVolume > 0
        ? Math.round(((totalMessages - prevVolume) / prevVolume) * 100)
        : 0

      result.comparison = {
        previousPeriod: {
          messageVolume: prevVolume,
          avgResponseMs: 0, // Would need separate query
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
