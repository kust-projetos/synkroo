/**
 * Decision Logging Service — migrated to Drizzle.
 */
import { eq, and, gte, desc, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { decisionLogs } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

interface CreateDecisionLogParams {
  clinicId: string; conversationId?: string; patientId?: string
  intentClassified: string; confidenceScore: number; actionTaken: string
  riskLevel: 'LOW'|'MEDIUM'|'HIGH'; reasoning: string
  escalationTriggered?: boolean; humanOverride?: boolean
  messageSummary?: string; entitiesExtracted?: Record<string,unknown>
  ragSources?: Array<{source:string;similarity:number}>
  responseTimeMs?: number; tokensUsed?: number; llmModel?: string
}

export interface DecisionLog {
  id: string; clinic_id: string; conversation_id: string|null; patient_id: string|null
  intent_classified: string; confidence_score: number; action_taken: string
  risk_level: string; reasoning: string; escalation_triggered: boolean; human_override: boolean
  message_summary: string|null; entities_extracted: Record<string,unknown>
  rag_sources: Array<{source:string;similarity:number}>
  response_time_ms: number|null; tokens_used: number|null; llm_model: string|null; created_at: string
}

export interface EscalationStats {
  totalDecisions: number; escalations: number; escalationRate: number; avgConfidence: number
  topIntents: Array<{intent:string;count:number}>; riskDistribution: {LOW:number;MEDIUM:number;HIGH:number}
}

function toSnake(row: any): DecisionLog {
  return {
    id: row.id, clinic_id: row.clinicId, conversation_id: row.conversationId ?? null, patient_id: row.patientId ?? null,
    intent_classified: row.intentClassified, confidence_score: Number(row.confidenceScore??0), action_taken: row.actionTaken,
    risk_level: row.riskLevel, reasoning: row.reasoning, escalation_triggered: row.escalationTriggered??false, human_override: row.humanOverride??false,
    message_summary: row.messageSummary??null, entities_extracted: row.entitiesExtracted??{}, rag_sources: row.ragSources??[],
    response_time_ms: row.responseTimeMs??null, tokens_used: row.tokensUsed??null, llm_model: row.llmModel??null, created_at: row.createdAt?.toISOString?.() ?? ''
  }
}

class DecisionLogService {
  async logDecision(params: CreateDecisionLogParams): Promise<string> {
    try {
      const db = getDb()
      const [row] = await db.insert(decisionLogs).values({
        clinicId: params.clinicId, conversationId: params.conversationId??null, patientId: params.patientId??null,
        intentClassified: params.intentClassified, confidenceScore: String(params.confidenceScore), actionTaken: params.actionTaken,
        riskLevel: params.riskLevel, reasoning: params.reasoning,
        escalationTriggered: params.escalationTriggered??false, humanOverride: params.humanOverride??false,
        messageSummary: params.messageSummary??null, entitiesExtracted: params.entitiesExtracted??{}, ragSources: params.ragSources??[],
        responseTimeMs: params.responseTimeMs??null, tokensUsed: params.tokensUsed??null, llmModel: params.llmModel??null,
      } as any).returning({ id: decisionLogs.id })
      return row?.id ?? ''
    } catch (err) {
      dbLogger.error('Decision logging error (non-fatal)', err, { clinicId: params.clinicId })
      return ''
    }
  }

  async getRecentLogs(clinicId: string, limit = 50): Promise<DecisionLog[]> {
    try {
      const db = getDb()
      const rows = await db.select().from(decisionLogs).where(eq(decisionLogs.clinicId, clinicId)).orderBy(desc(decisionLogs.createdAt)).limit(limit)
      return rows.map(toSnake)
    } catch (err) { dbLogger.error('Error fetching recent logs', err, { clinicId }); return [] }
  }

  async getLogsByConversation(conversationId: string): Promise<DecisionLog[]> {
    try {
      const db = getDb()
      const rows = await db.select().from(decisionLogs).where(eq(decisionLogs.conversationId, conversationId)).orderBy(asc(decisionLogs.createdAt))
      return rows.map(toSnake)
    } catch (err) { dbLogger.error('Error fetching conversation logs', err, { conversationId }); return [] }
  }

  async getLogsByPatient(patientId: string, limit = 50): Promise<DecisionLog[]> {
    try {
      const db = getDb()
      const rows = await db.select().from(decisionLogs).where(eq(decisionLogs.patientId, patientId)).orderBy(desc(decisionLogs.createdAt)).limit(limit)
      return rows.map(toSnake)
    } catch (err) { dbLogger.error('Error fetching patient logs', err, { patientId }); return [] }
  }

  async getEscalationStats(clinicId: string, days = 30): Promise<EscalationStats> {
    const empty: EscalationStats = { totalDecisions:0, escalations:0, escalationRate:0, avgConfidence:0, topIntents:[], riskDistribution:{LOW:0,MEDIUM:0,HIGH:0} }
    try {
      const db = getDb(); const since = new Date(Date.now()-days*86400000)
      const rows = await db.select({ escalationTriggered: decisionLogs.escalationTriggered, confidenceScore: decisionLogs.confidenceScore, intentClassified: decisionLogs.intentClassified, riskLevel: decisionLogs.riskLevel })
        .from(decisionLogs).where(and(eq(decisionLogs.clinicId, clinicId), gte(decisionLogs.createdAt, since)))
      if (!rows.length) return empty
      const total = rows.length
      const escalations = rows.filter((r:any)=>r.escalationTriggered).length
      const confSum = rows.reduce((s:number,r:any)=>s+Number(r.confidenceScore??0),0)
      const intents = new Map<string,number>(); const risks = { LOW:0, MEDIUM:0, HIGH:0 }
      for (const r of rows) {
        intents.set(r.intentClassified, (intents.get(r.intentClassified)??0)+1)
        const rl = r.riskLevel as keyof typeof risks; if (rl in risks) risks[rl]++
      }
      return { totalDecisions:total, escalations, escalationRate:total>0?(escalations/total)*100:0, avgConfidence:total>0?confSum/total:0,
        topIntents: [...intents.entries()].map(([i,c])=>({intent:i,count:c})).sort((a,b)=>b.count-a.count).slice(0,10), riskDistribution:risks }
    } catch (err) { dbLogger.error('Error computing escalation stats', err, { clinicId }); return empty }
  }

  async flagForReview(logId: string, reason: string): Promise<void> {
    try { dbLogger.info('Decision flagged for review', { logId, reason }) } catch (err) { dbLogger.error('Error flagging decision', err, { logId }) }
  }
}

export const decisionLogService = new DecisionLogService()
