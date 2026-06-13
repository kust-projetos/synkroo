/**
 * Synkroo Agent Service
 * Orchestrates message processing with MiniMax LLM
 * Enhanced with RAG (Retrieval-Augmented Generation) for persistent memory
 */

import { getLLMProvider } from '@/lib/llm'
import type { LLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'
import { ragService } from '@/services/rag'
import { processRegistrationFlow } from '@/services/agent/patient-registration.service'
import { riskScoringService } from '@/services/agent/risk-scoring.service'
import { pendingActionsService } from '@/services/agent/pending-actions.service'
import { decisionLogService } from '@/services/agent/decision-log.service'
import { findById, findMessagesByConversation, createMessage, updateConversation } from '@/repositories/conversations'

export interface AgentContext {
  conversationId: string
  clinicId: string
  patientId?: string
  intent?: string
  entities?: Record<string, string | null>
  history: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
  metadata?: Record<string, unknown>
  // RAG-enhanced context
  ragContext?: {
    knowledge: Array<{
      category: string
      question: string
      answer: string
      similarity: number
    }>
    memories: Array<{
      content: string
      contentType: string
      similarity: number
      createdAt: string
    }>
    combinedContext: string
  }
}

export interface AgentResponse {
  message: string
  intent: string
  confidence: number
  entities: Record<string, string | null>
  action: 'respond' | 'escalate' | 'schedule' | 'confirm'
  shouldEscalate: boolean
  reasoning: string
}

export class AgentService {
  private llm: LLMProvider

  constructor() {
    this.llm = getLLMProvider()
  }
  async processMessage(
    conversationId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentResponse> {
    // 1. Load conversation context
    const context = await this.loadContext(conversationId, metadata)

    // 1b. Patient registration for unknown numbers
    let registrationOverride: string | null = null
    if (!context.patientId && context.metadata?.phone && context.clinicId) {
      try {
        const registration = await processRegistrationFlow({
          phone: context.metadata.phone as string,
          clinicId: context.clinicId,
          message,
          conversationId,
        })
        if (registration.nextAction !== 'none' && registration.suggestedReply) {
          registrationOverride = registration.suggestedReply
          // Update conversation with new patient if created
          if (registration.patientId) {
            await updateConversation(conversationId, { patientId: registration.patientId })
          }
        }
        dbLogger.info('Patient registration flow', {
          isNew: registration.isNewPatient,
          action: registration.nextAction,
        })
      } catch (err) {
        dbLogger.warn('Patient registration failed, continuing', { error: String(err) })
      }
    }

    // 2. Classify intent
    const startTime = Date.now()
    const { intent, confidence, entities } = await this.llm.classifyIntent(message)

    // 3. Extract additional entities
    const extractedEntities = await this.llm.extractEntities(message)
    const allEntities = { ...entities, ...extractedEntities }

    // 4. Check for escalation
    const shouldEscalate = await this.llm.shouldEscalate(message, intent)

    // 4b. Risk assessment — determine confirmation requirements
    const action = this.determineAction(intent, shouldEscalate)
    const riskAssessment = riskScoringService.assessRisk(action, {
      isFirstInteraction: context.history.length === 0,
      patientHistoryCount: context.history.filter(h => h.role === 'user').length,
    })

    // 5. Determine action (already set above via determineAction)
    // Risk-based confirmation flow for medium/high risk
    let pendingActionId: string | null = null
    if (riskAssessment.confirmationRequired === 'double') {
      const pending = await pendingActionsService.createAction({
        clinicId: context.clinicId,
        conversationId,
        patientId: context.patientId,
        actionType: action,
        riskScore: riskAssessment.adjustedScore,
        riskLevel: riskAssessment.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
        maxConfirmations: 2,
        undoWindowMinutes: riskAssessment.undoWindowMinutes,
        reasoning: riskAssessment.reasoning,
        agentIntent: intent,
        confidence,
      })
      pendingActionId = pending.id
    } else if (riskAssessment.confirmationRequired === 'simple') {
      const pending = await pendingActionsService.createAction({
        clinicId: context.clinicId,
        conversationId,
        patientId: context.patientId,
        actionType: action,
        riskScore: riskAssessment.adjustedScore,
        riskLevel: riskAssessment.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
        maxConfirmations: 1,
        undoWindowMinutes: riskAssessment.undoWindowMinutes,
        reasoning: riskAssessment.reasoning,
        agentIntent: intent,
        confidence,
      })
      pendingActionId = pending.id
    }

    // 6. Generate response
    let response: string

    // If registration flow has a pending reply, use it instead of LLM
    if (registrationOverride) {
      response = registrationOverride
    } else if (shouldEscalate) {
      response = this.getEscalationMessage(intent)
      await this.updateConversationStatus(conversationId, 'escalated')
    } else {
      response = await this.llm.generateResponse(message, {
        intent,
        entities: allEntities,
        conversationHistory: context.history.map((h) => ({
          role: h.role,
          content: h.content,
        })),
        // Include RAG context for enhanced responses
        ragContext: context.ragContext?.combinedContext,
      })
    }

    // 7. Log decision for explainability (non-blocking)
    const responseTimeMs = Date.now() - startTime
    decisionLogService.logDecision({
      clinicId: context.clinicId,
      conversationId,
      patientId: context.patientId ?? undefined,
      intentClassified: intent,
      confidenceScore: confidence,
      actionTaken: action,
      riskLevel: riskAssessment.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
      reasoning: riskAssessment.reasoning,
      escalationTriggered: shouldEscalate,
      messageSummary: message.substring(0, 200),
      entitiesExtracted: allEntities as Record<string, unknown>,
      ragSources: context.ragContext?.knowledge.map(k => ({ source: k.question, similarity: k.similarity })),
      responseTimeMs,
    }).catch(err => {
      dbLogger.warn('Decision logging failed (non-fatal)', { error: String(err) })
    })

    return {
      message: response,
      intent,
      confidence,
      entities: allEntities,
      action,
      shouldEscalate,
      reasoning: this.buildReasoning(intent, action, shouldEscalate, registrationOverride ? 'registration_flow' : 'llm_generated', confidence),
    }
  }

  /**
   * Load conversation context with RAG-enhanced memory
   */
  private async loadContext(
    conversationId: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentContext> {
    // Get conversation
    const conversation = await findById(conversationId)
    if (!conversation) {
      dbLogger.error('Conversation not found', { conversationId })
      throw new Error(`Conversation not found: ${conversationId}`)
    }

    // Get recent messages
    const messageRows = await findMessagesByConversation(conversationId, { limit: 20 })

    const history = messageRows.map((msg) => ({
      role: (msg.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt),
    }))

    // Build context without RAG first
    const baseContext: AgentContext = {
      conversationId,
      clinicId: conversation.clinicId,
      patientId: conversation.patientId || undefined,
      history,
      metadata,
    }

    // Load RAG context if we have recent user message for query
    if (history.length > 0) {
      try {
        const lastUserMessage = [...history].reverse().find(h => h.role === 'user')
        if (lastUserMessage) {
          const ragContext = await ragService.getContext(
            lastUserMessage.content,
            conversation.clinicId,
            conversation.patientId || undefined
          )

          baseContext.ragContext = {
            knowledge: ragContext.knowledge.map(k => ({
              category: k.category,
              question: k.question,
              answer: k.answer,
              similarity: k.similarity,
            })),
            memories: ragContext.memories.map(m => ({
              content: m.content,
              contentType: m.contentType,
              similarity: m.similarity,
              createdAt: m.createdAt,
            })),
            combinedContext: ragContext.combinedContext,
          }

          dbLogger.debug('RAG context loaded', {
            knowledgeCount: ragContext.knowledge.length,
            memoriesCount: ragContext.memories.length,
          })
        }
      } catch (ragError: unknown) {
        // Log but don't fail - RAG is enhancement, not requirement
        dbLogger.warn('RAG context loading failed, continuing without', { error: String(ragError) })
      }
    }

    return baseContext
  }

  /**
   * Determine action based on intent
   */
  private determineAction(
    intent: string,
    shouldEscalate: boolean
  ): AgentResponse['action'] {
    if (shouldEscalate) return 'escalate'
    if (intent === 'agendamento') return 'schedule'
    if (intent === 'confirmacao') return 'confirm'
    return 'respond'
  }

  /**
   * Build human-readable reasoning for explainability
   */
  private buildReasoning(
    intent: string,
    action: string,
    shouldEscalate: boolean,
    source: string,
    confidence: number
  ): string {
    const parts: string[] = []

    if (shouldEscalate) {
      parts.push(`Escalado: intent "${intent}" requer atendente humano`)
    } else {
      parts.push(`Intent classificado: "${intent}" (confiança: ${(confidence * 100).toFixed(0)}%)`)
    }

    parts.push(`Ação: ${action}`)

    if (source === 'registration_flow') {
      parts.push('Resposta do fluxo de cadastro de paciente')
    } else if (source === 'llm_generated') {
      parts.push('Resposta gerada via LLM com contexto RAG')
    }

    return parts.join('. ') + '.'
  }

  /**
   * Get escalation message
   */
  private getEscalationMessage(intent: string): string {
    const messages: Record<string, string> = {
      emergencia:
        'Entendi que você está passando por uma emergência. Vou transferir você imediatamente para um atendente que pode ajudar melhor.',
      reclamacao:
        'Entendo sua insatisfação e peço desculpas pelo transtorno. Vou transferir você para nosso time que poderá resolver sua situação.',
      default:
        'Entendi! Vou transferir você para um atendente humano que pode ajudar melhor. Aguarde um momento, por favor.',
    }

    return messages[intent] || messages.default
  }

  /**
   * Update conversation status
   */
  private async updateConversationStatus(
    conversationId: string,
    status: string
  ): Promise<void> {
    await updateConversation(conversationId, { status })
  }

  /**
   * Store message in database with embedding for RAG
   */
  async storeMessage(
    conversationId: string,
    direction: 'inbound' | 'outbound',
    content: string,
    options: {
      intent?: string
      entities?: Record<string, unknown>
      confidence?: number
      isAi?: boolean
    } = {}
  ): Promise<{ id: string }> {
    // Try to store with embedding via RAG service (non-blocking)
    ragService.storeMessage(conversationId, direction, content, {
      intent: options.intent,
      entities: options.entities,
    }).catch(err => {
      dbLogger.warn('Failed to store message embedding', err)
    })

    // Store message in database
    const msg = await createMessage({
      conversationId,
      direction,
      content,
      messageType: 'text',
      intent: options.intent || null,
      entities: options.entities || {},
      confidence: options.confidence != null ? String(options.confidence) : null,
      isAi: options.isAi ?? direction === 'outbound',
    })

    return { id: msg.id }
  }
}

// Singleton
export const agent = new AgentService()