/**
 * Generalist Tools for Synkroo Agent
 * Tools for knowledge base search and FAQ answering
 */

import type { Tool } from './base.tools'
import { dbLogger } from '@/lib/logger'
import { BASE_TOOLS } from './base.tools'

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Generalist-specific tools (extends BASE_TOOLS)
 */
export const GENERALIST_TOOLS: Tool[] = [
  ...BASE_TOOLS,
  {
    name: 'search_knowledge',
    description: 'Busca informações na base de conhecimento da clínica',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Pergunta ou termo de busca' },
        clinicId: { type: 'string', description: 'ID da clínica' },
        patientId: { type: 'string', description: 'ID do paciente (opcional, para contexto)' },
        maxResults: { type: 'number', description: 'Número máximo de resultados (default 5)' },
      },
      required: ['query', 'clinicId'],
    },
  },
  {
    name: 'answer_faq',
    description: 'Busca e retorna resposta para uma pergunta frequente (FAQ)',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Pergunta do paciente' },
        clinicId: { type: 'string', description: 'ID da clínica' },
      },
      required: ['question', 'clinicId'],
    },
  },
]

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Search knowledge base for relevant information
 */
export async function searchKnowledgeTool(
  query: string,
  clinicId: string,
  patientId?: string,
  maxResults: number = 5
): Promise<{
  success: boolean
  data?: {
    results: Array<{
      id: string
      category: string
      question: string
      answer: string
      similarity: number
    }>
    combinedContext: string
  }
  error?: string
}> {
  try {
    const { l5RAGService } = await import('@/services/memory/L5-rag.service')

    const context = await l5RAGService.getContext(query, clinicId, patientId, {
      maxKnowledge: maxResults,
      maxMemories: 3,
      knowledgeThreshold: 0.6,
      memoryThreshold: 0.5,
    })

    // Transform to flat knowledge results
    const results = context.knowledge.map(k => ({
      id: k.id,
      category: k.category,
      question: k.question,
      answer: k.answer,
      similarity: k.similarity,
    }))

    const combinedContext = l5RAGService.buildCombinedContext(context.knowledge, context.memories)

    return {
      success: true,
      data: {
        results,
        combinedContext,
      },
    }
  } catch (error) {
    dbLogger.error('searchKnowledgeTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar conhecimento',
    }
  }
}

/**
 * Answer FAQ question
 */
export async function answerFaqTool(
  question: string,
  clinicId: string
): Promise<{
  success: boolean
  data?: {
    question: string
    answer: string
    category: string
    confidence: number
  }
  error?: string
}> {
  try {
    const { l5RAGService } = await import('@/services/memory/L5-rag.service')

    const context = await l5RAGService.getKnowledge(question, clinicId, {
      maxKnowledge: 3,
      knowledgeThreshold: 0.7,
    })

    if (context.length === 0) {
      return {
        success: true,
        data: {
          question,
          answer: 'Desculpe, não encontrei uma resposta para sua pergunta na nossa base de conhecimento. Posso ajudar com outras informações sobre a clínica, horários, procedimentos ou agendamentos.',
          category: 'unknown',
          confidence: 0,
        },
      }
    }

    // Get the best match
    const bestMatch = context[0]

    // Determine if we're confident enough
    const confidence = bestMatch.similarity

    if (confidence < 0.7) {
      return {
        success: true,
        data: {
          question,
          answer: `Com base na nossa base de conhecimento: ${bestMatch.answer}\n\nPosso fornecer mais detalhes se necessário.`,
          category: bestMatch.category,
          confidence,
        },
      }
    }

    return {
      success: true,
      data: {
        question,
        answer: bestMatch.answer,
        category: bestMatch.category,
        confidence,
      },
    }
  } catch (error) {
    dbLogger.error('answerFaqTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar FAQ',
    }
  }
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

/**
 * Registry mapping generalist tool names to their implementations
 */
export const GENERALIST_TOOL_IMPLEMENTATIONS: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  search_knowledge: async (args: {
    query: string
    clinicId: string
    patientId?: string
    maxResults?: number
  }) => searchKnowledgeTool(args.query, args.clinicId, args.patientId, args.maxResults),

  answer_faq: async (args: { question: string; clinicId: string }) =>
    answerFaqTool(args.question, args.clinicId),
}
