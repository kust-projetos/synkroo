/**
 * Shared Types for Agent System
 * Defines the contract between all agent types
 */

export type Intent = 'SCHEDULING' | 'BILLING' | 'REACTIVATION' | 'MEDICAL_INFO' | 'GENERAL'

export type AgentType = 'orchestrator' | 'router' | 'scheduler' | 'sales' | 'generalist'

export type Channel = 'widget' | 'whatsapp' | 'instagram'

export interface AgentPayload {
  id: string
  conversationId: string
  clinicId: string
  visitorId: string
  channel: Channel
  originalMessage: string
  intent?: Intent
  entities?: Record<string, string>
  targetAgent?: AgentType
  context: {
    session?: Record<string, unknown>
    patient?: Record<string, unknown>
    clinic: Record<string, unknown>
    conversation?: Record<string, unknown>
    ragKnowledge?: Array<{
      category: string
      question: string
      answer: string
      similarity: number
    }>
  }
  response?: {
    message: string
    confidence: number
    reasoning: string
  }
  metadata: {
    patientRequired: boolean
    historyNeeded: boolean
    faqOrMedical: boolean
    timestamp: string
    replyTo?: string
    routedFrom?: string
    routedTo?: string
  }
}

export interface AgentConfig {
  id: AgentType
  timeout: number
  systemPrompt: string
  tools: string[]
}

/**
 * Result from an agent processing a payload
 */
export interface AgentResult {
  success: boolean
  payload: AgentPayload
  error?: string
  durationMs: number
}

/**
 * Router-specific intent classification result
 */
export interface RouterResult {
  intent: Intent
  confidence: number
  entities: Record<string, string>
  targetAgent: AgentType
  reasoning: string
  contextFlags: {
    patientRequired: boolean
    historyNeeded: boolean
    faqOrMedical: boolean
  }
}

/**
 * Scheduler action result
 */
export interface SchedulerResult {
  action: 'check_availability' | 'book_appointment' | 'cancel_appointment' | 'reschedule_appointment'
  result: string
  nextQuestion?: string
  confidence: number
}

/**
 * Sales action result
 */
export interface SalesResult {
  action: 'follow_up_quote' | 'reactivate_patient' | 'create_budget' | 'send_promotion'
  result: string
  nextQuestion?: string
  confidence: number
}

/**
 * Generalist response result
 */
export interface GeneralistResult {
  response: string
  source?: string
  needsEscalation: boolean
  confidence: number
}
