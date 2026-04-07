/**
 * Router Agent
 * Always active agent that classifies user intent and routes to appropriate specialist
 */

import { BaseAgent } from './base.agent'
import { ROUTER_SYSTEM_PROMPT, ROUTER_EXAMPLES } from './prompts/router.prompt'
import type { AgentPayload, RouterResult, Intent, AgentType } from './types'
import { getLLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'

const ROUTER_TIMEOUT = 5000

/**
 * Router Agent
 * Always active (timeout 5000ms)
 * Takes AgentPayload, classifies intent via LLM, extracts entities
 * Maps intent to target agent and sets context flags
 */
export class RouterAgent extends BaseAgent {
  private static instance: RouterAgent

  /**
   * Get singleton instance
   */
  static getInstance(): RouterAgent {
    if (!RouterAgent.instance) {
      RouterAgent.instance = new RouterAgent()
    }
    return RouterAgent.instance
  }

  /**
   * Constructor
   */
  constructor() {
    super({
      id: 'router',
      timeout: ROUTER_TIMEOUT,
      systemPrompt: `${ROUTER_SYSTEM_PROMPT}\n\n${ROUTER_EXAMPLES}`,
      tools: ['search_patient', 'get_clinic_info', 'send_message', 'log_decision', 'classify_intent', 'extract_entities'],
    })
  }

  /**
   * Process a message - classify intent and route to appropriate agent
   */
  async process(payload: AgentPayload): Promise<AgentPayload> {
    const startTime = Date.now()
    const { originalMessage, clinicId, conversationId } = payload

    dbLogger.info('Router processing message', {
      conversationId,
      clinicId,
      messageLength: originalMessage.length,
    })

    try {
      // 1. Classify intent using LLM
      const intentResult = await this.llm.classifyIntent(originalMessage)

      // 2. Extract entities using LLM
      const entities = await this.llm.extractEntities(originalMessage)

      // 3. Map intent to target agent
      const { targetAgent, contextFlags, reasoning } = this.mapIntentToAgent(
        intentResult.intent as Intent,
        intentResult.confidence
      )

      const result: RouterResult = {
        intent: intentResult.intent as Intent,
        confidence: intentResult.confidence,
        entities: entities as Record<string, string>,
        targetAgent,
        reasoning,
        contextFlags,
      }

      const duration = Date.now() - startTime

      // 4. Log the routing decision
      this.logDecision(
        'router',
        'classify_and_route',
        originalMessage,
        JSON.stringify({
          intent: result.intent,
          targetAgent: result.targetAgent,
          confidence: result.confidence,
        }),
        result.reasoning,
        duration
      )

      // 5. Dispatch to target agent
      await this.sendToAgent('router', targetAgent, {
        ...payload,
        intent: result.intent,
        entities: result.entities,
        targetAgent: result.targetAgent,
        context: {
          ...payload.context,
          ragKnowledge: payload.context.ragKnowledge,
        },
        metadata: {
          ...payload.metadata,
          patientRequired: contextFlags.patientRequired,
          historyNeeded: contextFlags.historyNeeded,
          faqOrMedical: contextFlags.faqOrMedical,
        },
      })

      // 6. Return enriched payload
      return {
        ...payload,
        intent: result.intent,
        entities: result.entities,
        targetAgent: result.targetAgent,
        response: {
          message: `Mensagem classificada como ${result.intent} e enviada para ${result.targetAgent}`,
          confidence: result.confidence,
          reasoning: result.reasoning,
        },
        metadata: {
          ...payload.metadata,
          patientRequired: contextFlags.patientRequired,
          historyNeeded: contextFlags.historyNeeded,
          faqOrMedical: contextFlags.faqOrMedical,
        },
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      dbLogger.error('Router error', error, {
        conversationId,
        duration,
        message: originalMessage.substring(0, 100),
      })

      // On error, route to generalist as fallback
      await this.sendToAgent('router', 'generalist', {
        ...payload,
        intent: 'GENERAL',
        targetAgent: 'generalist',
        metadata: {
          ...payload.metadata,
          patientRequired: false,
          historyNeeded: false,
          faqOrMedical: true,
        },
      })

      return {
        ...payload,
        intent: 'GENERAL',
        targetAgent: 'generalist',
        response: {
          message: 'Erro na classificação. Encaminhando para atendimento generalista.',
          confidence: 0,
          reasoning: errorMessage,
        },
      }
    }
  }

  /**
   * Map intent to target agent and determine context flags
   */
  private mapIntentToAgent(
    intent: Intent,
    confidence: number
  ): {
    targetAgent: AgentType
    contextFlags: { patientRequired: boolean; historyNeeded: boolean; faqOrMedical: boolean }
    reasoning: string
  } {
    // Intent to agent mapping
    const intentMap: Record<Intent, AgentType> = {
      SCHEDULING: 'scheduler',
      BILLING: 'scheduler',
      REACTIVATION: 'sales',
      MEDICAL_INFO: 'generalist',
      GENERAL: 'generalist',
    }

    // Default context flags based on intent
    const defaultFlags: Record<Intent, { patientRequired: boolean; historyNeeded: boolean; faqOrMedical: boolean }> = {
      SCHEDULING: { patientRequired: true, historyNeeded: false, faqOrMedical: false },
      BILLING: { patientRequired: false, historyNeeded: false, faqOrMedical: false },
      REACTIVATION: { patientRequired: true, historyNeeded: true, faqOrMedical: true },
      MEDICAL_INFO: { patientRequired: false, historyNeeded: false, faqOrMedical: true },
      GENERAL: { patientRequired: false, historyNeeded: false, faqOrMedical: false },
    }

    const targetAgent = intentMap[intent] || 'generalist'
    const baseFlags = defaultFlags[intent] || { patientRequired: false, historyNeeded: false, faqOrMedical: false }

    // Adjust flags based on confidence
    const contextFlags = {
      ...baseFlags,
      // Low confidence requires history to make better decision
      historyNeeded: baseFlags.historyNeeded || confidence < 0.6,
    }

    const reasoning = this.generateReasoning(intent, targetAgent, confidence)

    return { targetAgent, contextFlags, reasoning }
  }

  /**
   * Generate reasoning text for the routing decision
   */
  private generateReasoning(intent: Intent, targetAgent: AgentType, confidence: number): string {
    const confidenceLevel = confidence >= 0.8 ? 'alta' : confidence >= 0.6 ? 'média' : 'baixa'
    return `Intenção ${intent} com confiança ${confidenceLevel} -> agente ${targetAgent}`
  }
}

/**
 * Singleton instance
 */
export const routerAgent = RouterAgent.getInstance()
