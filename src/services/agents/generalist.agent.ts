/**
 * Generalist Agent
 * Handles FAQ, knowledge base queries, and general clinic information
 */

import { BaseAgent } from './base.agent'
import { GENERALIST_SYSTEM_PROMPT, GENERALIST_CONTEXT_TEMPLATE, GENERALIST_ESCALATION_TRIGGERS } from './prompts/generalist.prompt'
import type { AgentPayload, GeneralistResult } from './types'
import { getLLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'

const GENERALIST_TIMEOUT = 5000

/**
 * Generalist Agent
 * LAZY activation (timeout 5000ms)
 * Handles FAQ, knowledge base queries, and general clinic info
 */
export class GeneralistAgent extends BaseAgent {
  private static instance: GeneralistAgent

  /**
   * Get singleton instance
   */
  static getInstance(): GeneralistAgent {
    if (!GeneralistAgent.instance) {
      GeneralistAgent.instance = new GeneralistAgent()
    }
    return GeneralistAgent.instance
  }

  /**
   * Constructor
   */
  constructor() {
    super({
      id: 'generalist',
      timeout: GENERALIST_TIMEOUT,
      systemPrompt: GENERALIST_SYSTEM_PROMPT,
      tools: ['answer_faq', 'search_knowledge', 'provide_clinic_info'],
    })
  }

  /**
   * Process a general inquiry
   */
  async process(payload: AgentPayload): Promise<AgentPayload> {
    const startTime = Date.now()
    const { conversationId, originalMessage, context } = payload

    dbLogger.info('Generalist processing request', {
      conversationId,
      messageLength: originalMessage.length,
    })

    try {
      // Determine if escalation is needed
      const needsEscalation = this.checkEscalation(originalMessage)

      // Build context for the LLM
      const contextStr = this.buildContext(payload)

      // Use LLM to generate response
      const response = await this.llm.generateResponse(originalMessage, {
        intent: payload.intent || 'GENERAL',
        entities: payload.entities || {},
        conversationHistory: [],
        clinicInfo: context.clinic as { name: string; procedures: string[] },
        ragContext: context.ragKnowledge?.map(k => k.answer).join('\n'),
      })

      // Determine source of the answer
      const source = this.determineSource(context)

      const result: GeneralistResult = {
        response,
        source,
        needsEscalation,
        confidence: needsEscalation ? 0.5 : 0.85,
      }

      const duration = Date.now() - startTime

      this.logDecision(
        'generalist',
        'answer',
        originalMessage,
        JSON.stringify({ source: result.source, needsEscalation: result.needsEscalation }),
        `Answered from ${source} in ${duration}ms`,
        duration
      )

      return {
        ...payload,
        response: {
          message: result.response,
          confidence: result.confidence,
          reasoning: needsEscalation ? 'Escalação recomendada' : `Resposta de ${source}`,
        },
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      dbLogger.error('Generalist error', error, {
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
    const { context } = payload

    return GENERALIST_CONTEXT_TEMPLATE
      .replace('{faqItems}', '')
      .replace('{knowledgeBase}', context.ragKnowledge?.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n') || '')
      .replace('{clinicInfo}', this.formatClinicInfo(context.clinic))
      .replace('{conversationHistory}', '')
      .replace('{memory}', context.patient ? JSON.stringify(context.patient) : '')
  }

  /**
   * Format clinic info from context
   */
  private formatClinicInfo(clinic: Record<string, unknown>): string {
    if (!clinic) return ''

    const parts: string[] = []

    if (clinic.name) parts.push(`Nome: ${clinic.name}`)
    if (clinic.address) parts.push(`Endereço: ${clinic.address}`)
    if (clinic.phone) parts.push(`Telefone: ${clinic.phone}`)
    if (clinic.openingHours) parts.push(`Horário: ${clinic.openingHours}`)

    return parts.join('\n')
  }

  /**
   * Determine the source of the answer
   */
  private determineSource(context: AgentPayload['context']): 'faq' | 'knowledge_base' | 'clinic_context' | 'combined' {
    const hasRagKnowledge = context.ragKnowledge && context.ragKnowledge.length > 0
    const hasClinicInfo = context.clinic && Object.keys(context.clinic).length > 0

    if (hasRagKnowledge && hasClinicInfo) {
      return 'combined'
    }
    if (hasRagKnowledge) {
      return 'knowledge_base'
    }
    if (hasClinicInfo) {
      return 'clinic_context'
    }
    return 'faq'
  }

  /**
   * Check if the message requires escalation to human
   */
  private checkEscalation(message: string): boolean {
    const lowerMessage = message.toLowerCase()

    return GENERALIST_ESCALATION_TRIGGERS.some(trigger =>
      lowerMessage.includes(trigger.toLowerCase())
    )
  }
}

/**
 * Singleton instance
 */
export const generalistAgent = GeneralistAgent.getInstance()
