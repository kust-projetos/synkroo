import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, desc } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { decisionLogs } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const conversationId = searchParams.get('conversation_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90)
    const since = new Date(Date.now() - days * 86400000)

    const db = getDb()
    const conditions = [
      eq(decisionLogs.clinicId, clinicId),
      gte(decisionLogs.createdAt, since),
    ]
    if (patientId) conditions.push(eq(decisionLogs.patientId, patientId))
    if (conversationId) conditions.push(eq(decisionLogs.conversationId, conversationId))

    const rows = await db
      .select()
      .from(decisionLogs)
      .where(and(...conditions))
      .orderBy(desc(decisionLogs.createdAt))
      .limit(limit)

    const logs = rows.map(r => ({
      id: r.id,
      clinic_id: r.clinicId,
      patient_id: r.patientId,
      conversation_id: r.conversationId,
      intent_classified: r.intentClassified,
      confidence_score: Number(r.confidenceScore ?? 0),
      action_taken: r.actionTaken,
      risk_level: r.riskLevel,
      reasoning: r.reasoning,
      escalation_triggered: r.escalationTriggered,
      human_override: r.humanOverride,
      message_summary: r.messageSummary,
      entities_extracted: r.entitiesExtracted,
      rag_sources: r.ragSources,
      response_time_ms: r.responseTimeMs,
      tokens_used: r.tokensUsed,
      llm_model: r.llmModel,
      created_at: r.createdAt?.toISOString?.() ?? null,
    }))

    const total = logs.length
    const escalations = logs.filter(l => l.escalation_triggered).length
    const avg = total > 0 ? logs.reduce((s, l) => s + l.confidence_score, 0) / total : 0

    const intents: Record<string, number> = {}
    const risks: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    for (const l of logs) {
      intents[l.intent_classified] = (intents[l.intent_classified] || 0) + 1
      if (l.risk_level && l.risk_level in risks) risks[l.risk_level]++
    }

    return NextResponse.json({
      logs,
      stats: {
        totalDecisions: total,
        escalations,
        escalationRate: total > 0 ? Math.round((escalations / total) * 100) : 0,
        avgConfidence: Math.round(avg * 100) / 100,
        topIntents: Object.entries(intents).sort(([,a],[,b])=>b-a).slice(0,5).map(([intent,count])=>({intent,count})),
        riskDistribution: risks,
      },
    })
  } catch (e) {
    console.error('Error fetching decision logs:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
