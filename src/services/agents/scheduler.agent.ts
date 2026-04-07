/**
 * Scheduler Agent
 * Handles appointment-related actions: check_availability, book_appointment, cancel_appointment, reschedule_appointment
 */

import { BaseAgent } from './base.agent'
import { SCHEDULER_SYSTEM_PROMPT, SCHEDULER_CONTEXT_TEMPLATE } from './prompts/scheduler.prompt'
import type { AgentPayload, SchedulerResult } from './types'
import { getLLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'

const SCHEDULER_TIMEOUT = 10000

type SchedulerAction = 'check_availability' | 'book_appointment' | 'cancel_appointment' | 'reschedule_appointment'

/**
 * Scheduler Agent
 * LAZY activation (timeout 10000ms)
 * Handles appointment scheduling and management
 */
export class SchedulerAgent extends BaseAgent {
  private static instance: SchedulerAgent

  /**
   * Get singleton instance
   */
  static getInstance(): SchedulerAgent {
    if (!SchedulerAgent.instance) {
      SchedulerAgent.instance = new SchedulerAgent()
    }
    return SchedulerAgent.instance
  }

  /**
   * Constructor
   */
  constructor() {
    super({
      id: 'scheduler',
      timeout: SCHEDULER_TIMEOUT,
      systemPrompt: SCHEDULER_SYSTEM_PROMPT,
      tools: ['check_availability', 'book_appointment', 'cancel_appointment', 'reschedule_appointment'],
    })
  }

  /**
   * Process a scheduling request
   */
  async process(payload: AgentPayload): Promise<AgentPayload> {
    const startTime = Date.now()
    const { conversationId, originalMessage, entities, context } = payload

    dbLogger.info('Scheduler processing request', {
      conversationId,
      messageLength: originalMessage.length,
      entities,
    })

    try {
      // Build context for the LLM
      const contextStr = this.buildContext(payload)

      // Use LLM to determine the appropriate action and generate response
      const response = await this.llm.generateResponse(originalMessage, {
        intent: payload.intent || 'SCHEDULING',
        entities: entities || {},
        conversationHistory: [],
        clinicInfo: context.clinic as { name: string; procedures: string[] },
        ragContext: context.ragKnowledge?.map(k => k.answer).join('\n'),
      })

      // Determine action based on entities and message content
      const action = this.determineAction(originalMessage, entities)

      const result: SchedulerResult = {
        action,
        result: response,
        nextQuestion: this.generateNextQuestion(action, entities),
        confidence: 0.85, // TODO: Get actual confidence from LLM
      }

      const duration = Date.now() - startTime

      this.logDecision(
        'scheduler',
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

      dbLogger.error('Scheduler error', error, {
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

    return SCHEDULER_CONTEXT_TEMPLATE
      .replace('{clinicName}', (context.clinic as { name?: string })?.name || 'Clínica')
      .replace('{openingHours}', (context.clinic as { openingHours?: string })?.openingHours || '08:00 - 18:00')
      .replace('{procedures}', (context.clinic as { procedures?: string[] })?.procedures?.join(', ') || '')
      .replace('{dentists}', (context.clinic as { dentists?: string[] })?.dentists?.join(', ') || '')
      .replace('{patientName}', (context.patient as { name?: string })?.name || '')
      .replace('{patientPhone}', (context.patient as { phone?: string })?.phone || '')
      .replace('{lastVisit}', (context.patient as { lastVisit?: string })?.lastVisit || '')
      .replace('{patientHistory}', (context.patient as { history?: string })?.history || '')
      .replace('{conversationHistory}', '')
      .replace('{ragContext}', context.ragKnowledge?.map(k => k.answer).join('\n') || '')
  }

  /**
   * Determine the scheduling action based on message content
   */
  private determineAction(message: string, entities?: Record<string, string>): SchedulerAction {
    const lowerMessage = message.toLowerCase()

    // Check for cancellation keywords
    if (lowerMessage.includes('cancelar') || lowerMessage.includes('cancela') || lowerMessage.includes('desmarc')) {
      return 'cancel_appointment'
    }

    // Check for reschedule keywords
    if (lowerMessage.includes('remarcar') || lowerMessage.includes('alterar horário') || lowerMessage.includes('mudar data')) {
      return 'reschedule_appointment'
    }

    // Check for availability keywords
    if (lowerMessage.includes('disponível') || lowerMessage.includes('horário') || lowerMessage.includes('tem horário') || lowerMessage.includes('disponibilidade')) {
      return 'check_availability'
    }

    // Check for booking keywords
    if (lowerMessage.includes('marcar') || lowerMessage.includes('agendar') || lowerMessage.includes('confirmar') || lowerMessage.includes('agend')) {
      return 'book_appointment'
    }

    // Default to check_availability if date/time is mentioned
    if (entities?.date || entities?.time) {
      return 'book_appointment'
    }

    return 'check_availability'
  }

  /**
   * Generate next question based on action and available entities
   */
  private generateNextQuestion(action: SchedulerAction, entities?: Record<string, string>): string | undefined {
    switch (action) {
      case 'check_availability':
        if (!entities?.date) {
          return 'Para qual data você gostaria de verificar a disponibilidade?'
        }
        break
      case 'book_appointment':
        if (!entities?.date) {
          return 'Qual data e horário você gostaria de agendar?'
        } else if (!entities?.procedure) {
          return 'Qual procedimento você gostaria de realizar?'
        } else if (!entities?.patientName) {
          return 'Qual é o seu nome completo?'
        }
        break
      case 'cancel_appointment':
        if (!entities?.patientName) {
          return 'Qual é o seu nome para localizarmos sua consulta?'
        }
        break
      case 'reschedule_appointment':
        if (!entities?.date) {
          return 'Qual é a nova data e horário que você gostaria?'
        }
        break
    }
    return undefined
  }
}

/**
 * Singleton instance
 */
export const schedulerAgent = SchedulerAgent.getInstance()
