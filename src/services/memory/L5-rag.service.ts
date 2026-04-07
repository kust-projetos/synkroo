/**
 * L5 RAG Memory Service
 * Wrapper around existing rag.service for semantic search
 * Provides knowledge base and conversation memory retrieval
 */

import { ragService, KnowledgeResult, MemoryResult } from '@/services/rag/rag.service'
import { dbLogger } from '@/lib/logger'

// L5 Knowledge entry interface
export interface L5Knowledge {
  id: string
  category: string
  question: string
  answer: string
  similarity: number
}

// L5 Memory result interface
export interface L5MemoryResult {
  id: string
  conversationId: string
  patientId?: string
  content: string
  contentType: string
  similarity: number
  createdAt: string
}

// RAG search options
export interface L5SearchOptions {
  knowledgeThreshold?: number
  memoryThreshold?: number
  maxKnowledge?: number
  maxMemories?: number
}

// L5 Context result
export interface L5Context {
  knowledge: L5Knowledge[]
  memories: L5MemoryResult[]
}

/**
 * L5 RAG Service
 * Wraps rag.service with adapted interfaces
 */
export class L5RAGService {
  /**
   * Get context (knowledge + memories) for a query
   */
  async getContext(
    query: string,
    clinicId: string,
    patientId?: string,
    options?: L5SearchOptions
  ): Promise<L5Context> {
    try {
      const ragContext = await ragService.getContext(query, clinicId, patientId, {
        knowledgeThreshold: options?.knowledgeThreshold ?? 0.7,
        memoryThreshold: options?.memoryThreshold ?? 0.6,
        maxKnowledge: options?.maxKnowledge ?? 5,
        maxMemories: options?.maxMemories ?? 10,
      })

      // Adapt knowledge results
      const knowledge: L5Knowledge[] = ragContext.knowledge.map((k: KnowledgeResult) => ({
        id: k.id,
        category: k.category,
        question: k.question,
        answer: k.answer,
        similarity: k.similarity,
      }))

      // Adapt memory results
      const memories: L5MemoryResult[] = ragContext.memories.map((m: MemoryResult) => ({
        id: m.id,
        conversationId: m.conversationId,
        patientId: m.patientId || undefined,
        content: m.content,
        contentType: m.contentType,
        similarity: m.similarity,
        createdAt: m.createdAt,
      }))

      dbLogger.debug('L5 context retrieved', {
        clinicId,
        patientId: patientId || 'none',
        knowledgeCount: knowledge.length,
        memoriesCount: memories.length,
      })

      return { knowledge, memories }
    } catch (error) {
      dbLogger.error('Error getting L5 context', error, { query, clinicId, patientId })
      return { knowledge: [], memories: [] }
    }
  }

  /**
   * Get only knowledge base results
   */
  async getKnowledge(
    query: string,
    clinicId: string,
    options?: Pick<L5SearchOptions, 'knowledgeThreshold' | 'maxKnowledge'>
  ): Promise<L5Knowledge[]> {
    try {
      const ragContext = await ragService.getContext(query, clinicId, undefined, {
        knowledgeThreshold: options?.knowledgeThreshold ?? 0.7,
        maxKnowledge: options?.maxKnowledge ?? 5,
        memoryThreshold: 0, // Disable memory search
        maxMemories: 0,
      })

      return ragContext.knowledge.map((k: KnowledgeResult) => ({
        id: k.id,
        category: k.category,
        question: k.question,
        answer: k.answer,
        similarity: k.similarity,
      }))
    } catch (error) {
      dbLogger.error('Error getting knowledge', error, { query, clinicId })
      return []
    }
  }

  /**
   * Get only conversation memory results
   */
  async getMemories(
    query: string,
    clinicId: string,
    patientId?: string,
    options?: Pick<L5SearchOptions, 'memoryThreshold' | 'maxMemories'>
  ): Promise<L5MemoryResult[]> {
    try {
      const ragContext = await ragService.getContext(query, clinicId, patientId, {
        knowledgeThreshold: 0, // Disable knowledge search
        maxKnowledge: 0,
        memoryThreshold: options?.memoryThreshold ?? 0.6,
        maxMemories: options?.maxMemories ?? 10,
      })

      return ragContext.memories.map((m: MemoryResult) => ({
        id: m.id,
        conversationId: m.conversationId,
        patientId: m.patientId || undefined,
        content: m.content,
        contentType: m.contentType,
        similarity: m.similarity,
        createdAt: m.createdAt,
      }))
    } catch (error) {
      dbLogger.error('Error getting memories', error, { query, clinicId, patientId })
      return []
    }
  }

  /**
   * Build combined context string for LLM consumption
   */
  buildCombinedContext(knowledge: L5Knowledge[], memories: L5MemoryResult[]): string {
    const parts: string[] = []

    if (knowledge.length > 0) {
      parts.push('### Conhecimento da Clínica:')
      knowledge.forEach((k, i) => {
        parts.push(`${i + 1}. [${k.category}] P: ${k.question}\n   R: ${k.answer}`)
      })
    }

    if (memories.length > 0) {
      parts.push('\n### Contexto de Conversas Anteriores:')
      memories.forEach((m, i) => {
        const date = new Date(m.createdAt).toLocaleDateString('pt-BR')
        const preview = m.content.length > 200 ? m.content.substring(0, 200) + '...' : m.content
        parts.push(`${i + 1}. [${date}] ${preview}`)
      })
    }

    return parts.join('\n')
  }
}

// Singleton instance
export const l5RAGService = new L5RAGService()
