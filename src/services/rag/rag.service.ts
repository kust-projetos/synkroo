/**
 * RAG Service for Synkroo Agent
 * Provides Retrieval-Augmented Generation capabilities
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { embeddingService, EmbeddingService } from './embedding.service'
import { dbLogger } from '@/lib/logger'

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
  patientId: string | null
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
  private serverClient: Promise<import('@/lib/supabase/typed').TypedSupabaseClient>

  constructor() {
    this.serverClient = createTypedClient()
  }

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

    // Generate embedding for query
    const { embedding } = await embeddingService.generateEmbedding(query)

    // Run searches in parallel
    const [knowledge, memories] = await Promise.all([
      this.searchKnowledgeBase(embedding, clinicId, knowledgeThreshold, maxKnowledge),
      this.searchMemories(embedding, clinicId, patientId, memoryThreshold, maxMemories),
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
   * Search knowledge base with semantic similarity
   */
  async searchKnowledgeBase(
    embedding: number[],
    clinicId: string,
    threshold: number = 0.7,
    limit: number = 5
  ): Promise<KnowledgeResult[]> {
    try {
      const { data, error } = await (await this.serverClient).rpc('search_knowledge_base', {
        query_embedding: embedding,
        p_clinic_id: clinicId,
        match_threshold: threshold,
        match_count: limit,
      } as any) as any

      if (error) {
        dbLogger.error('Knowledge base search error', error)
        return []
      }

      return data || []
    } catch (error) {
      dbLogger.error('Knowledge base search failed', error)
      return []
    }
  }

  /**
   * Search conversation memories with semantic similarity
   */
  async searchMemories(
    embedding: number[],
    clinicId: string,
    patientId?: string,
    threshold: number = 0.6,
    limit: number = 10
  ): Promise<MemoryResult[]> {
    try {
      const { data, error } = await (await this.serverClient).rpc('search_conversation_memories', {
        query_embedding: embedding,
        p_clinic_id: clinicId,
        p_patient_id: patientId || null,
        match_threshold: threshold,
        match_count: limit,
      } as any) as any

      if (error) {
        dbLogger.error('Memory search error', error)
        return []
      }

      return data || []
    } catch (error) {
      dbLogger.error('Memory search failed', error)
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

      // Store with embedding
      const { data, error } = await (await this.serverClient).rpc('store_message_with_embedding', {
        p_conversation_id: conversationId,
        p_direction: direction,
        p_content: content,
        p_embedding: embedding,
        p_intent: options.intent || null,
        p_entities: options.entities || {},
      } as any) as any

      if (error) {
        dbLogger.error('Store message with embedding error', error)
        return null
      }

      return data
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
      // Generate embedding for summary
      const { embedding } = await embeddingService.generateEmbedding(summary)

      const { data, error } = await (await this.serverClient).rpc('summarize_conversation', {
        p_conversation_id: conversationId,
        p_summary: summary,
        p_embedding: embedding,
      } as any) as any

      if (error) {
        dbLogger.error('Store summary error', error)
        return null
      }

      return data
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
      // Generate embedding from question + answer
      const text = `${question}\n${answer}`
      const { embedding } = await embeddingService.generateEmbedding(text)

      const { data, error } = await ((await this.serverClient).from('knowledge_base') as any)
        .insert({
          clinic_id: clinicId,
          category,
          question,
          answer,
          keywords,
          embedding,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        dbLogger.error('Add knowledge entry error', error)
        return null
      }

      return data.id
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
   * Get embedding dimension
   */
  static getEmbeddingDimension(): number {
    return 1536
  }
}

// Singleton instance
export const ragService = new RAGService()