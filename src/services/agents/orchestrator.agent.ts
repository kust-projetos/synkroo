/**
 * Orchestrator Agent
 * Main coordinator that loads context and dispatches to specialized agents
 */

import { BaseAgent } from './base.agent'
import { ORCHESTRATOR_SYSTEM_PROMPT } from './prompts/orchestrator.prompt'
import { memoryManager } from '@/services/memory/memory.manager'
import { queueService } from '@/services/queue'
import { dbLogger } from '@/lib/logger'
import type { AgentPayload } from './types'

const ORCHESTRATOR_TIMEOUT = 30000

/**
 * Orchestrator Agent
 * Coordinates the multi-agent system by:
 * 1. Loading context via memory manager
 * 2. Dispatching to Router for intent classification
 * 3. Waiting for the full flow to complete
 * 4. Returning aggregated response
 */
export class OrchestratorAgent extends BaseAgent {
  private static instance: OrchestratorAgent

  /**
   * Get singleton instance
   */
  static getInstance(): OrchestratorAgent {
    if (!OrchestratorAgent.instance) {
      OrchestratorAgent.instance = new OrchestratorAgent()
    }
    return OrchestratorAgent.instance
  }

  /**
   * Constructor - initializes with orchestrator config
   */
  constructor() {
    super({
      id: 'orchestrator',
      timeout: ORCHESTRATOR_TIMEOUT,
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
      tools: [],
    })
  }

  /**
   * Process a message through the multi-agent system
   * 
   * Flow:
   * 1. Load context from memory layers (L1-L5 based on flags)
   * 2. Enrich payload with loaded context
   * 3. Send to Router for intent classification
   * 4. Wait for response via queue correlation
   * 5. Log decision and return response
   */
  async process(payload: AgentPayload): Promise<AgentPayload> {
    const startTime = Date.now()
    const payloadId = payload.id

    dbLogger.info('Orchestrator processing message', {
      payloadId,
      clinicId: payload.clinicId,
      visitorId: payload.visitorId,
      messageLength: payload.originalMessage.length,
    })

    try {
      // 1. Load context intelligently (L1 always, L2-L5 based on flags)
      const context = await memoryManager.loadContext({
        clinicId: payload.clinicId,
        visitorId: payload.visitorId,
        patientId: (payload.context?.patient as unknown as string) || undefined,
        conversationId: payload.conversationId,
        patientRequired: payload.metadata.patientRequired,
        historyNeeded: payload.metadata.historyNeeded,
        faqOrMedical: payload.metadata.faqOrMedical,
      })

      // Update payload with loaded context
      // context has: conversationId, clinicId, patientId, intent, entities, history, metadata, ragContext
      const enrichedPayload: AgentPayload = {
        ...payload,
        context: {
          // L1 session data
          session: (context.metadata?.sessionEntities || {}) as AgentPayload['context']['session'],
          // L2 patient data (stored in metadata)
          patient: context.metadata?.patientPreferences ? { preferencias: context.metadata.patientPreferences, riskScore: context.metadata.riskScore } as AgentPayload['context']['patient'] : undefined,
          // L3 clinic data (stored in metadata)
          clinic: context.metadata?.clinicName ? { nome: context.metadata.clinicName, cancelamentoPolicy: context.metadata.cancellationPolicy } as AgentPayload['context']['clinic'] : { nome: '', cancelamentoPolicy: { horasAntecedencia: 24, permiteOnline: true } } as AgentPayload['context']['clinic'],
          // L4 conversation history
          conversation: { messages: context.history } as AgentPayload['context']['conversation'],
          // L5 RAG knowledge
          ragKnowledge: context.ragContext?.knowledge as AgentPayload['context']['ragKnowledge'],
        } as AgentPayload['context'],
      }

      // 2. Dispatch to router for classification
      // The router will classify the intent and dispatch to the appropriate specialist agent
      await this.sendToAgent('orchestrator', 'router', enrichedPayload)

      // 3. Wait for response from the full flow (Router -> Specialist -> back)
      // Allow 5 seconds buffer for timeout handling within the 30s total
      const response = await this.waitForResponse(
        payloadId,
        ORCHESTRATOR_TIMEOUT - 5000
      )

      const duration = Date.now() - startTime
      this.logDecision(
        'orchestrator',
        'process',
        payload.originalMessage,
        JSON.stringify({
          intent: response.intent,
          targetAgent: response.targetAgent,
          hasResponse: !!response.response,
        }),
        `Orchestrated to ${response.targetAgent} in ${duration}ms`,
        duration
      )

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      dbLogger.error('Orchestrator error', error, {
        payloadId,
        duration,
        message: payload.originalMessage.substring(0, 100),
      })

      // Return error payload with user-friendly message
      return {
        ...payload,
        response: {
          message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
          confidence: 0,
          reasoning: errorMessage,
        },
      }
    }
  }

  /**
   * Wait for a response from another agent via the queue
   * Uses replyTo correlation ID to match responses to requests
   * 
   * @param payloadId - The original payload ID to match against replyTo
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns Promise that resolves with the response payload
   * @throws Error on timeout
   */
  private waitForResponse(payloadId: string, timeoutMs: number): Promise<AgentPayload> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        dbLogger.warn('Orchestrator timeout waiting for response', {
          payloadId,
          timeoutMs,
        })
        reject(new Error(`Timeout waiting for response to ${payloadId} after ${timeoutMs}ms`))
      }, timeoutMs)

      // Listen for responses on the orchestrator queue
      queueService.startListening('orchestrator', async (entry) => {
        try {
          const responsePayload = entry.payload as unknown as AgentPayload

          // Check if this is the response we're waiting for
          if (responsePayload.metadata?.replyTo === payloadId) {
            clearTimeout(timeout)
            resolve(responsePayload)
          }
        } catch (error) {
          clearTimeout(timeout)
          dbLogger.error('Error processing queue response', error)
          reject(error)
        }
      })
    })
  }
}

/**
 * Singleton instance of the Orchestrator Agent
 */
export const orchestratorAgent = OrchestratorAgent.getInstance()
