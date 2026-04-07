/**
 * Base Agent Abstract Class
 * Provides common functionality for all agent types
 */

import type { AgentConfig, AgentPayload, AgentType } from './types'
import { getLLMProvider } from '@/lib/llm'
import { dbLogger } from '@/lib/logger'
import type { LLMProvider } from '@/lib/llm'

// Lazy import to avoid circular dependencies
let queueService: unknown = null

async function getQueueService() {
  if (!queueService) {
    try {
      const module = await import('@/services/queue')
      queueService = module.queueService || module
    } catch {
      dbLogger.warn('Queue service not available')
    }
  }
  return queueService
}

export abstract class BaseAgent {
  protected config: AgentConfig
  protected llm: LLMProvider

  constructor(config: AgentConfig) {
    this.config = config
    this.llm = getLLMProvider()
  }

  /**
   * Process an agent payload - must be implemented by subclasses
   */
  abstract process(payload: AgentPayload): Promise<AgentPayload>

  /**
   * Send payload to another agent
   */
  protected async sendToAgent(
    fromAgent: AgentType,
    toAgent: AgentType,
    payload: AgentPayload
  ): Promise<void> {
    const queue = await getQueueService() as {
      enqueue?: (agent: AgentType, p: AgentPayload) => Promise<void>
    } | null

    if (queue?.enqueue) {
      await queue.enqueue(toAgent, {
        ...payload,
        metadata: {
          ...payload.metadata,
          // Add routing info via type coercion (routing metadata)
          routedFrom: fromAgent,
          routedTo: toAgent,
        } as AgentPayload['metadata'],
      })
    } else {
      dbLogger.warn('Queue service not available, agent dispatch skipped', {
        from: fromAgent,
        to: toAgent,
      })
    }
  }

  /**
   * Log agent decision for explainability
   */
  protected logDecision(
    agent: AgentType,
    action: string,
    input: string,
    output: string,
    reasoning: string,
    durationMs: number
  ): void {
    dbLogger.info('Agent decision', {
      agent,
      action,
      inputLength: input.length,
      outputLength: output.length,
      reasoning,
      durationMs,
    })
  }

  /**
   * Get agent ID
   */
  get id(): AgentType {
    return this.config.id
  }

  /**
   * Get agent timeout
   */
  get timeout(): number {
    return this.config.timeout
  }

  /**
   * Get agent config
   */
  get agentConfig(): AgentConfig {
    return this.config
  }

  /**
   * Build standard error response
   */
  protected buildErrorResponse(
    payload: AgentPayload,
    error: string
  ): AgentPayload {
    return {
      ...payload,
      response: {
        message: `Erro no processamento: ${error}`,
        confidence: 0,
        reasoning: `Agent ${this.config.id} encountered an error`,
      },
    }
  }
}
