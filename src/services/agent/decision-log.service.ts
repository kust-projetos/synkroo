/**
 * Decision Logging Service
 * Provides explainability by logging all agent decisions
 * for audit, compliance, and dashboard visibility.
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

interface CreateDecisionLogParams {
  clinicId: string
  conversationId?: string
  patientId?: string
  intentClassified: string
  confidenceScore: number
  actionTaken: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  reasoning: string
  escalationTriggered?: boolean
  humanOverride?: boolean
  messageSummary?: string
  entitiesExtracted?: Record<string, unknown>
  ragSources?: Array<{ source: string; similarity: number }>
  responseTimeMs?: number
  tokensUsed?: number
  llmModel?: string
}

export interface DecisionLog {
  id: string
  clinic_id: string
  conversation_id: string | null
  patient_id: string | null
  intent_classified: string
  confidence_score: number
  action_taken: string
  risk_level: string
  reasoning: string
  escalation_triggered: boolean
  human_override: boolean
  message_summary: string | null
  entities_extracted: Record<string, unknown>
  rag_sources: Array<{ source: string; similarity: number }>
  response_time_ms: number | null
  tokens_used: number | null
  llm_model: string | null
  created_at: string
}

export interface EscalationStats {
  totalDecisions: number
  escalations: number
  escalationRate: number
  avgConfidence: number
  topIntents: Array<{ intent: string; count: number }>
  riskDistribution: { LOW: number; MEDIUM: number; HIGH: number }
}

class DecisionLogService {
  private client: Promise<import('@/lib/supabase/typed').TypedSupabaseClient>

  constructor() {
    this.client = createTypedClient()
  }

  async logDecision(params: CreateDecisionLogParams): Promise<string> {
    try {
      const { data, error } = await (await this.client)
        .from('decision_logs')
        .insert({
          clinic_id: params.clinicId,
          conversation_id: params.conversationId ?? null,
          patient_id: params.patientId ?? null,
          intent_classified: params.intentClassified,
          confidence_score: params.confidenceScore,
          action_taken: params.actionTaken,
          risk_level: params.riskLevel,
          reasoning: params.reasoning,
          escalation_triggered: params.escalationTriggered ?? false,
          human_override: params.humanOverride ?? false,
          message_summary: params.messageSummary ?? null,
          entities_extracted: params.entitiesExtracted ?? {},
          rag_sources: params.ragSources ?? [],
          response_time_ms: params.responseTimeMs ?? null,
          tokens_used: params.tokensUsed ?? null,
          llm_model: params.llmModel ?? null,
        })
        .select('id')
        .single()

      if (error) {
        dbLogger.error('Failed to insert decision log', error, {
          clinicId: params.clinicId,
          intent: params.intentClassified,
        })
        return ''
      }

      return data?.id ?? ''
    } catch (err) {
      dbLogger.error('Decision logging error (non-fatal)', err, {
        clinicId: params.clinicId,
      })
      return ''
    }
  }

  async getRecentLogs(clinicId: string, limit = 50): Promise<DecisionLog[]> {
    try {
      const { data, error } = await (await this.client)
        .from('decision_logs')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        dbLogger.error('Failed to fetch recent decision logs', error, { clinicId })
        return []
      }
      return (data as DecisionLog[]) ?? []
    } catch (err) {
      dbLogger.error('Error fetching recent logs', err, { clinicId })
      return []
    }
  }

  async getLogsByConversation(conversationId: string): Promise<DecisionLog[]> {
    try {
      const { data, error } = await (await this.client)
        .from('decision_logs')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) {
        dbLogger.error('Failed to fetch conversation logs', error, { conversationId })
        return []
      }
      return (data as DecisionLog[]) ?? []
    } catch (err) {
      dbLogger.error('Error fetching conversation logs', err, { conversationId })
      return []
    }
  }

  async getLogsByPatient(patientId: string, limit = 50): Promise<DecisionLog[]> {
    try {
      const { data, error } = await (await this.client)
        .from('decision_logs')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        dbLogger.error('Failed to fetch patient logs', error, { patientId })
        return []
      }
      return (data as DecisionLog[]) ?? []
    } catch (err) {
      dbLogger.error('Error fetching patient logs', err, { patientId })
      return []
    }
  }

  async getEscalationStats(clinicId: string, days = 30): Promise<EscalationStats> {
    const empty: EscalationStats = {
      totalDecisions: 0,
      escalations: 0,
      escalationRate: 0,
      avgConfidence: 0,
      topIntents: [],
      riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    }

    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data, error } = await (await this.client)
        .from('decision_logs')
        .select('escalation_triggered, confidence_score, intent_classified, risk_level')
        .eq('clinic_id', clinicId)
        .gte('created_at', since.toISOString())

      if (error || !data || data.length === 0) {
        if (error) dbLogger.error('Failed to fetch stats', error, { clinicId })
        return empty
      }

      const totalDecisions = data.length
      const escalations = data.filter((r: { escalation_triggered: boolean }) => r.escalation_triggered).length
      const confidenceSum = data.reduce(
        (sum: number, r: { confidence_score: number }) => sum + Number(r.confidence_score),
        0
      )

      const intentCounts = new Map<string, number>()
      const riskDist = { LOW: 0, MEDIUM: 0, HIGH: 0 }

      for (const row of data as Array<{ intent_classified: string; risk_level: string }>) {
        intentCounts.set(row.intent_classified, (intentCounts.get(row.intent_classified) ?? 0) + 1)
        const rl = row.risk_level as keyof typeof riskDist
        if (rl in riskDist) riskDist[rl]++
      }

      const topIntents = [...intentCounts.entries()]
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalDecisions,
        escalations,
        escalationRate: totalDecisions > 0 ? (escalations / totalDecisions) * 100 : 0,
        avgConfidence: totalDecisions > 0 ? confidenceSum / totalDecisions : 0,
        topIntents,
        riskDistribution: riskDist,
      }
    } catch (err) {
      dbLogger.error('Error computing escalation stats', err, { clinicId })
      return empty
    }
  }

  async flagForReview(logId: string, reason: string): Promise<void> {
    try {
      dbLogger.info('Decision flagged for review', { logId, reason })
    } catch (err) {
      dbLogger.error('Error flagging decision', err, { logId })
    }
  }
}

export const decisionLogService = new DecisionLogService()
