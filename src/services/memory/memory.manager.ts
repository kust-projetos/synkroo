/**
 * Memory Manager Service
 * Orchestrates loading from all 5 memory layers
 * Implements smart loading strategy based on context flags
 */

import { dbLogger } from '@/lib/logger'
import { l1SessionService, L1Session } from './L1-session.service'
import { l2PatientService, L2Patient } from './L2-patient.service'
import { l3ClinicService, L3Clinic } from './L3-clinic.service'
import { l4ConversationService, L4Conversation } from './L4-conversation.service'
import { l5RAGService, L5Knowledge, L5MemoryResult } from './L5-rag.service'
import type { AgentContext } from '@/services/agent/agent.service'

// Context load options
export interface ContextLoadOptions {
  patientRequired: boolean
  historyNeeded: boolean
  faqOrMedical: boolean
  patientId?: string
  conversationId?: string
  clinicId: string
  visitorId: string
}

// Memory manager result (what was loaded)
export interface MemoryLoadResult {
  l1: L1Session | null
  l2: L2Patient | null
  l3: L3Clinic | null
  l4: L4Conversation | null
  l5: {
    knowledge: L5Knowledge[]
    memories: L5MemoryResult[]
    combinedContext: string
  }
  loadedLayers: string[]
}

// Conversation message for AgentContext
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

/**
 * Memory Manager
 * Orchestrates smart loading from L1-L5 memory layers
 */
export class MemoryManager {
  /**
   * Load context from all relevant memory layers
   * Smart loading strategy based on options
   */
  async loadContext(options: ContextLoadOptions): Promise<AgentContext> {
    const startTime = Date.now()
    const loadedLayers: string[] = []

    dbLogger.debug('Memory manager loading context', {
      patientRequired: options.patientRequired,
      historyNeeded: options.historyNeeded,
      faqOrMedical: options.faqOrMedical,
      hasPatientId: !!options.patientId,
      hasConversationId: !!options.conversationId,
    })

    // Initialize result containers
    let l1Session: L1Session | null = null
    let l2Patient: L2Patient | null = null
    let l3Clinic: L3Clinic | null = null
    let l4Conversation: L4Conversation | null = null
    let l5Knowledge: L5Knowledge[] = []
    let l5Memories: L5MemoryResult[] = []
    let l5CombinedContext = ''

    // Track errors per layer
    const errors: Record<string, unknown> = {}

    // ─── L1: Always load ────────────────────────────────────────────────
    try {
      l1Session = l1SessionService.getOrCreate(options.conversationId || options.visitorId, options.visitorId)
      loadedLayers.push('L1')
    } catch (error) {
      errors.L1 = error
      dbLogger.warn('L1 load failed', { error })
    }

    // ─── L2: Load if patientId provided or patientRequired ─────────────
    if (options.patientId) {
      try {
        l2Patient = await l2PatientService.getById(options.patientId)
        if (l2Patient) {
          loadedLayers.push('L2')
        }
      } catch (error) {
        errors.L2 = error
        dbLogger.warn('L2 load failed', { error, patientId: options.patientId })
      }
    } else if (options.patientRequired) {
      // Try to find patient by visitor info
      try {
        // Try to get patient from conversation
        if (options.conversationId) {
          const conv = await l4ConversationService.getBasicById(options.conversationId)
          if (conv?.patientId) {
            l2Patient = await l2PatientService.getById(conv.patientId)
            if (l2Patient) {
              loadedLayers.push('L2')
            }
          }
        }
      } catch (error) {
        errors.L2 = error
        dbLogger.warn('L2 load failed (patientRequired)', { error })
      }
    }

    // ─── L3: Always load ───────────────────────────────────────────────
    try {
      l3Clinic = await l3ClinicService.getById(options.clinicId)
      if (l3Clinic) {
        loadedLayers.push('L3')
      }
    } catch (error) {
      errors.L3 = error
      dbLogger.warn('L3 load failed', { error, clinicId: options.clinicId })
    }

    // ─── L4: Load if historyNeeded && conversationId ──────────────────
    if (options.historyNeeded && options.conversationId) {
      try {
        l4Conversation = await l4ConversationService.getById(options.conversationId)
        if (l4Conversation) {
          loadedLayers.push('L4')
        }
      } catch (error) {
        errors.L4 = error
        dbLogger.warn('L4 load failed', { error, conversationId: options.conversationId })
      }
    }

    // ─── L5: Load if faqOrMedical && L1 has messages ───────────────────
    if (options.faqOrMedical && l1Session && l1Session.messages.length > 0) {
      try {
        // Use last user message as query
        const lastUserMessage = [...l1Session.messages]
          .reverse()
          .find(m => m.role === 'user')

        if (lastUserMessage) {
          const l5Context = await l5RAGService.getContext(
            lastUserMessage.content,
            options.clinicId,
            options.patientId,
            {
              knowledgeThreshold: 0.7,
              memoryThreshold: 0.6,
              maxKnowledge: 5,
              maxMemories: 10,
            }
          )

          l5Knowledge = l5Context.knowledge
          l5Memories = l5Context.memories
          l5CombinedContext = l5RAGService.buildCombinedContext(l5Knowledge, l5Memories)

          if (l5Knowledge.length > 0 || l5Memories.length > 0) {
            loadedLayers.push('L5')
          }
        }
      } catch (error) {
        errors.L5 = error
        dbLogger.warn('L5 load failed', { error })
      }
    }

    // ─── Build AgentContext ────────────────────────────────────────────
    const loadTimeMs = Date.now() - startTime

    // Build conversation history from L1 and L4
    const history: ConversationMessage[] = []

    // Add L4 conversation history if available
    if (l4Conversation) {
      for (const msg of l4Conversation.messages) {
        history.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
        })
      }
    }

    // Add L1 session messages on top
    if (l1Session) {
      for (const msg of l1Session.messages) {
        history.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
        })
      }
    }

    // Build RAG context
    const ragContext = (l5Knowledge.length > 0 || l5Memories.length > 0)
      ? {
          knowledge: l5Knowledge.map(k => ({
            category: k.category,
            question: k.question,
            answer: k.answer,
            similarity: k.similarity,
          })),
          memories: l5Memories.map(m => ({
            content: m.content,
            contentType: m.contentType,
            similarity: m.similarity,
            createdAt: m.createdAt,
          })),
          combinedContext: l5CombinedContext,
        }
      : undefined

    // Build metadata
    const metadata: Record<string, unknown> = {
      _memory: {
        loadedLayers,
        loadTimeMs,
        layerErrors: Object.keys(errors).length > 0 ? Object.keys(errors) : undefined,
      },
    }

    // Add L2 patient preferences if loaded
    if (l2Patient) {
      metadata.patientPreferences = l2Patient.preferencias
      metadata.riskScore = l2Patient.riskScore
      metadata.inactiveDays = l2Patient.inactiveDays
    }

    // Add L3 clinic info if loaded
    if (l3Clinic) {
      metadata.clinicName = l3Clinic.nome
      metadata.cancellationPolicy = l3Clinic.cancelamentoPolicy
    }

    // Add L1 session entities
    if (l1Session && Object.keys(l1Session.entities).length > 0) {
      metadata.sessionEntities = l1Session.entities
    }

    const agentContext: AgentContext = {
      conversationId: options.conversationId || options.visitorId,
      clinicId: options.clinicId,
      patientId: l2Patient?.patientId || options.patientId,
      intent: l1Session?.currentIntent,
      entities: l1Session?.entities as Record<string, string | null> | undefined,
      history,
      metadata,
      ragContext,
    }

    dbLogger.info('Memory context loaded', {
      loadedLayers,
      loadTimeMs,
      historyLength: history.length,
      hasRagContext: !!ragContext,
      patientFound: !!l2Patient,
    })

    return agentContext
  }

  /**
   * Get load result details (for debugging/analytics)
   */
  async getLoadResult(options: ContextLoadOptions): Promise<MemoryLoadResult> {
    const l1 = options.conversationId
      ? l1SessionService.get(options.conversationId) || l1SessionService.get(options.visitorId)
      : l1SessionService.get(options.visitorId)

    const l2 = options.patientId ? await l2PatientService.getById(options.patientId) : null
    const l3 = await l3ClinicService.getById(options.clinicId)
    const l4 = options.conversationId ? await l4ConversationService.getById(options.conversationId) : null

    let l5Knowledge: L5Knowledge[] = []
    let l5Memories: L5MemoryResult[] = []
    let l5CombinedContext = ''

    if (l1 && l1.messages.length > 0) {
      const lastUserMessage = [...l1.messages].reverse().find(m => m.role === 'user')
      if (lastUserMessage) {
        const l5Context = await l5RAGService.getContext(
          lastUserMessage.content,
          options.clinicId,
          options.patientId
        )
        l5Knowledge = l5Context.knowledge
        l5Memories = l5Context.memories
        l5CombinedContext = l5RAGService.buildCombinedContext(l5Knowledge, l5Memories)
      }
    }

    return {
      l1,
      l2,
      l3,
      l4,
      l5: { knowledge: l5Knowledge, memories: l5Memories, combinedContext: l5CombinedContext },
      loadedLayers: ['L1', 'L2', 'L3', 'L4', 'L5'].filter(layer => {
        switch (layer) {
          case 'L1': return !!l1
          case 'L2': return !!l2
          case 'L3': return !!l3
          case 'L4': return !!l4
          case 'L5': return l5Knowledge.length > 0 || l5Memories.length > 0
          default: return false
        }
      }),
    }
  }
}

// Singleton instance
export const memoryManager = new MemoryManager()
