import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import type { DecisionLog } from '@/lib/supabase/database.types'

/**
 * GET /api/agent/decisions
 * Get agent decision logs for the dashboard
 *
 * Query params:
 *   patient_id: filter by patient
 *   conversation_id: filter by conversation
 *   limit: max results (default 50)
 *   days: lookback period (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const conversationId = searchParams.get('conversation_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const days = parseInt(searchParams.get('days') || '7')

    const supabase = await createTypedClient()

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('decision_logs')
      .select('*')
      .eq('clinic_id', clinicId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (patientId) query = query.eq('patient_id', patientId)
    if (conversationId) query = query.eq('conversation_id', conversationId)

    const { data: logs, error } = await query as { data: DecisionLog[] | null; error: null }

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch decision logs' }, { status: 500 })
    }

    // Compute summary stats
    const totalDecisions = logs?.length || 0
    const escalations = logs?.filter((l) => l.escalation_triggered).length || 0
    const avgConfidence = totalDecisions > 0
      ? logs!.reduce((sum: number, l) => sum + (l.confidence_score || 0), 0) / totalDecisions
      : 0

    const intentCounts: Record<string, number> = {}
    for (const log of logs || []) {
      const intent = log.intent_classified
      intentCounts[intent] = (intentCounts[intent] || 0) + 1
    }

    const riskDist = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    for (const log of logs || []) {
      const level = log.risk_level as keyof typeof riskDist
      if (level in riskDist) riskDist[level]++
    }

    return NextResponse.json({
      logs: logs || [],
      stats: {
        totalDecisions,
        escalations,
        escalationRate: totalDecisions > 0 ? Math.round((escalations / totalDecisions) * 100) : 0,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        topIntents: Object.entries(intentCounts)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([intent, count]) => ({ intent, count })),
        riskDistribution: riskDist,
      },
    })
  } catch (error) {
    console.error('Error fetching decision logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
