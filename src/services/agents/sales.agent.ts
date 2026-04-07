/**
 * Sales Agent
 * Handles reactivation, follow-ups, promotions, and budget creation
 */

import { BaseAgent } from './base.agent'
import { SALES_SYSTEM_PROMPT, SALES_CONTEXT_TEMPLATE } from './prompts/sales.prompt'
import type { AgentPayload, SalesResult } from './types'
import { getLLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'

const SALES_TIMEOUT = 10000

type SalesAction = 'follow_up_quote' | 'reactivate_patient' | 'create_budget' | 'send_promotion'

/**
 * Sales Agent
 * LAZY activation (timeout 10000ms)
 * Handles sales-related actions: follow-up, reactivation, budgets, promotions
 */
export class SalesAgent extends BaseAgent {
  private static instance: SalesAgent

  /**
   * Get singleton instance
   */
  static getInstance(): SalesAgent {
    if (!SalesAgent.instance) {
      SalesAgent.instance = new SalesAgent()
    }
    return SalesAgent.instance
  }

  /**
   * Constructor
   */
  constructor() {
    super({
      id: 'sales',
      timeout: SALES_TIMEOUT,
      systemPrompt: SALES_SYSTEM_PROMPT,
      tools: ['follow_up_quote', 'reactivate_patient', 'create_budget', 'send_promotion'],
    })
  }

  /**
   * Process a sales request
   */
  async process(payload: AgentPayload): Promise<AgentPayload> {
    const startTime = Date.now()
    const { conversationId, originalMessage, entities, context } = payload

    dbLogger.info('Sales processing request', {
      conversationId,
      messageLength: originalMessage.length,
      entities,
    })

    try {
      // Build context for the LLM
      const contextStr = this.buildContext(payload)

      // Use LLM to generate response
      const response = await this.llm.generateResponse(originalMessage, {
        intent: payload.intent || 'REACTIVATION',
        entities: entities || {},
        conversationHistory: [],
        clinicInfo: context.clinic as { name: string; procedures: string[] },
        ragContext: context.ragKnowledge?.map(k => k.answer).join('\n'),
      })

      // Determine action based on message content
      const action = this.determineAction(originalMessage, entities, payload.intent)

      const result: SalesResult = {
        action,
        result: response,
        nextQuestion: this.generateNextQuestion(action, entities, context, payload.intent),
        confidence: 0.85, // TODO: Get actual confidence from LLM
      }

      const duration = Date.now() - startTime

      this.logDecision(
        'sales',
        action,
        originalMessage,
        JSON.stringify({ action: result.action, hasResponse: !!result.result }),
        `Processed ${action} in ${duration}ms`,
        duration
      )

      return {
        ...payload,
        response: {
          message: result.result,
          confidence: result.confidence,
          reasoning: `Executou ação ${action}`,
        },
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      dbLogger.error('Sales error', error, {
        conversationId,
        duration,
        message: originalMessage.substring(0, 100),
      })

      return this.buildErrorResponse(payload, errorMessage)
    }
  }

  /**
   * Build context string from payload
   */
  private buildContext(payload: AgentPayload): string {
    const { context, entities } = payload

    return SALES_CONTEXT_TEMPLATE
      .replace('{patientName}', (context.patient as { name?: string })?.name || '')
      .replace('{patientPhone}', (context.patient as { phone?: string })?.phone || '')
      .replace('{lastVisit}', (context.patient as { lastVisit?: string })?.lastVisit || '')
      .replace('{totalSpent}', String((context.patient as { totalSpent?: number })?.totalSpent || 0))
      .replace('{procedures}', (context.patient as { procedures?: string[] })?.procedures?.join(', ') || '')
      .replace('{budgetHistory}', '')
      .replace('{activePromotions}', '')
      .replace('{conversationHistory}', '')
      .replace('{ragContext}', context.ragKnowledge?.map(k => k.answer).join('\n') || '')
  }

  /**
   * Determine the sales action based on message content and intent
   */
  private determineAction(message: string, entities?: Record<string, string>, intent?: string): SalesAction {
    const lowerMessage = message.toLowerCase()

    // Check for follow-up keywords
    if (lowerMessage.includes('orçamento') || lowerMessage.includes('valor') || lowerMessage.includes('preço') || lowerMessage.includes('condição')) {
      if (entities?.budgetId) {
        return 'follow_up_quote'
      }
      return 'create_budget'
    }

    // Check for reactivation keywords
    if (lowerMessage.includes('voltar') || lowerMessage.includes('retomar') || lowerMessage.includes('retornei') || lowerMessage.includes('dor')) {
      return 'reactivate_patient'
    }

    // Check for promotion keywords
    if (lowerMessage.includes('promoção') || lowerMessage.includes('desconto') || lowerMessage.includes('oferta')) {
      return 'send_promotion'
    }

    // Check for budget creation
    if (lowerMessage.includes('ciente') || lowerMessage.includes('quanto custa') || lowerMessage.includes('falar sobre')) {
      return 'create_budget'
    }

    // Default based on intent if provided
    if (intent === 'REACTIVATION') {
      return 'reactivate_patient'
    }

    return 'follow_up_quote'
  }

  /**
   * Generate next question based on action and context
   */
  private generateNextQuestion(action: SalesAction, entities?: Record<string, string>, context?: AgentPayload['context'], intent?: string): string | undefined {
    switch (action) {
      case 'follow_up_quote':
        if (!entities?.budgetId) {
          return 'Qual orçamento você gostaria de acompanhar?'
        }
        return 'Tem alguma dúvida sobre o orçamento?'

      case 'reactivate_patient':
        if (!entities?.patientName && !(context?.patient as { name?: string })?.name) {
          return 'Qual é o seu nome para encontrarmos seu histórico?'
        }
        return 'Podemos ajudar você a retomar seu tratamento. Qual foi o motivo da pausa?'

      case 'create_budget':
        if (!entities?.procedure) {
          return 'Qual procedimento você gostaria de saber o valor?'
        }
        return 'Qual é o seu nome para criarmos o orçamento?'

      case 'send_promotion':
        return 'Temos promoções especiais disponíveis. Gostaria de conhecer?'

      default:
        return undefined
    }
  }
}

/**
 * Singleton instance
 */
export const salesAgent = SalesAgent.getInstance()
