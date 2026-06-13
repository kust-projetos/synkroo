/**
 * RAG Service for Synkroo Agent
 * Provides Retrieval-Augmented Generation capabilities
 * Migrated from Supabase to Drizzle repositories
 */

import { embeddingService, EmbeddingService } from './embedding.service'
import { dbLogger } from '@/lib/logger'
import * as knowledgeRepo from '@/repositories/knowledge'
import * as memoryRepo from '@/repositories/memory'

export interface KnowledgeResult {
  id: string
  category: string
  question: string
  answer: string
  similarity: number
}

export interface MemoryResult {
  id: string
  conversationId: string
  patientId: string | undefined
  content: string
  contentType: string
  similarity: number
  createdAt: string
}

export interface RAGContext {
  knowledge: KnowledgeResult[]
  memories: MemoryResult[]
  combinedContext: string
}

/**
 * RAG Service
 * Handles semantic search and context retrieval for the AI agent
 */
export class RAGService {
  /**
   * Get relevant context for a query
   */
  async getContext(
    query: string,
    clinicId: string,
    patientId?: string,
    options: {
      knowledgeThreshold?: number
      memoryThreshold?: number
      maxKnowledge?: number
      maxMemories?: number
    } = {}
  ): Promise<RAGContext> {
    const {
      knowledgeThreshold = 0.7,
      memoryThreshold = 0.6,
      maxKnowledge = 5,
      maxMemories = 10,
    } = options

    // Run searches in parallel
    const [knowledge, memories] = await Promise.all([
      this.searchKnowledgeBase(query, clinicId, knowledgeThreshold, maxKnowledge),
      this.searchMemories(query, clinicId, patientId, memoryThreshold, maxMemories),
    ])

    // Build combined context string
    const combinedContext = this.buildCombinedContext(knowledge, memories)

    return {
      knowledge,
      memories,
      combinedContext,
    }
  }

  /**
   * Search knowledge base (keyword fallback when vector search unavailable)
   */
  async searchKnowledgeBase(
    query: string,
    clinicId: string,
    threshold = 0.7,
    limit = 5
  ): Promise<KnowledgeResult[]> {
    try {
      const results = await knowledgeRepo.searchKnowledgeBase(clinicId, query, limit)
      return results.map(r => ({
        id: r.id,
        category: r.category,
        question: r.question,
        answer: r.answer,
        similarity: r.relevance >= threshold ? r.relevance : 0,
      })).filter(r => r.similarity > 0)
    } catch (error) {
      dbLogger.error('Knowledge base search error', error)
      return []
    }
  }

  /**
   * Search conversation memories (keyword fallback when vector search unavailable)
   */
  async searchMemories(
    query: string,
    clinicId: string,
    patientId?: string,
    threshold = 0.6,
    limit = 10
  ): Promise<MemoryResult[]> {
    try {
      const results = await memoryRepo.searchMemories(clinicId, query, patientId, limit)
      return results.filter(r => r.similarity >= threshold)
    } catch (error) {
      dbLogger.error('Memory search error', error)
      return []
    }
  }

  /**
   * Store message with embedding for future retrieval
   */
  async storeMessage(
    conversationId: string,
    direction: 'inbound' | 'outbound',
    content: string,
    options: {
      intent?: string
      entities?: Record<string, unknown>
    } = {}
  ): Promise<string | null> {
    try {
      // Generate embedding
      const { embedding } = await embeddingService.generateEmbedding(content)

      return await memoryRepo.storeMessageWithEmbedding({
        conversationId,
        direction,
        content,
        embedding,
        intent: options.intent || null,
        entities: options.entities || {},
      })
    } catch (error) {
      dbLogger.error('Store message with embedding failed', error)
      return null
    }
  }

  /**
   * Store conversation summary for long-term memory
   */
  async storeSummary(
    conversationId: string,
    summary: string
  ): Promise<string | null> {
    try {
      return await memoryRepo.storeSummary(conversationId, summary)
    } catch (error) {
      dbLogger.error('Store summary failed', error)
      return null
    }
  }

  /**
   * Add knowledge base entry with embedding
   */
  async addKnowledgeEntry(
    clinicId: string,
    category: string,
    question: string,
    answer: string,
    keywords: string[] = []
  ): Promise<string | null> {
    try {
      const entry = await knowledgeRepo.createKnowledgeEntry({
        clinicId,
        category,
        question,
        answer,
        keywords,
      })
      return entry.id
    } catch (error) {
      dbLogger.error('Add knowledge entry failed', error)
      return null
    }
  }

  /**
   * Build combined context string for LLM
   */
  private buildCombinedContext(
    knowledge: KnowledgeResult[],
    memories: MemoryResult[]
  ): string {
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
        parts.push(`${i + 1}. [${date}] ${m.content.substring(0, 200)}...`)
      })
    }

    return parts.join('\n')
  }

  /**
   * Get embedding dimension for text-embedding-3-small (1536)
   */
  getEmbeddingDimension(): number {
    return 1536
  }
}

// Singleton
export const ragService = new RAGService()