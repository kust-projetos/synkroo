/**
 * RAG Service Tests
 * Migrated from Supabase to Drizzle repositories
 */

// Mock the embedding service
jest.mock('@/services/rag/embedding.service', () => ({
  embeddingService: {
    generateEmbedding: jest.fn().mockResolvedValue({ embedding: new Array(1536).fill(0) }),
  },
}))

// Mock repositories
jest.mock('@/repositories/knowledge', () => ({
  searchKnowledgeBase: jest.fn(),
}))

jest.mock('@/repositories/memory', () => ({
  searchMemories: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { RAGService } from '../rag.service'
import * as knowledgeRepo from '@/repositories/knowledge'
import * as memoryRepo from '@/repositories/memory'

describe('RAGService', () => {
  let service: RAGService

  beforeEach(() => {
    service = new RAGService()
    jest.clearAllMocks()
  })

  describe('getEmbeddingDimension', () => {
    it('should return 1536 for text-embedding-3-small', () => {
      expect(service.getEmbeddingDimension()).toBe(1536)
    })
  })

  describe('buildCombinedContext', () => {
    it('should build context with knowledge only', () => {
      const knowledge = [
        { id: '1', category: 'procedimentos', question: 'Qual o valor do clareamento?', answer: 'A partir de R$ 500', similarity: 0.85 }
      ]
      const memories: any[] = []

      const result = (service as any).buildCombinedContext(knowledge, memories)

      expect(result).toContain('### Conhecimento da Clínica:')
      expect(result).toContain('clareamento')
      expect(result).toContain('R$ 500')
      expect(result).not.toContain('### Contexto de Conversas Anteriores:')
    })

    it('should build context with memories only', () => {
      const knowledge: any[] = []
      const memories = [
        { id: '1', conversationId: 'conv-1', patientId: undefined, content: 'Paciente quer agendar limpeza', contentType: 'message', similarity: 0.75, createdAt: '2026-03-27T10:00:00Z' }
      ]

      const result = (service as any).buildCombinedContext(knowledge, memories)

      expect(result).not.toContain('### Conhecimento da Clínica:')
      expect(result).toContain('### Contexto de Conversas Anteriores:')
      expect(result).toContain('Paciente quer agendar limpeza')
    })

    it('should build context with both knowledge and memories', () => {
      const knowledge = [
        { id: '1', category: 'horarios', question: 'Qual o horário?', answer: '8h às 18h', similarity: 0.9 }
      ]
      const memories = [
        { id: '1', conversationId: 'conv-1', patientId: undefined, content: 'Paciente preferiu horário da manhã', contentType: 'message', similarity: 0.8, createdAt: '2026-03-27T10:00:00Z' }
      ]

      const result = (service as any).buildCombinedContext(knowledge, memories)

      expect(result).toContain('### Conhecimento da Clínica:')
      expect(result).toContain('### Contexto de Conversas Anteriores:')
      expect(result).toContain('horário')
      expect(result).toContain('manhã')
    })

    it('should return empty string when no knowledge or memories', () => {
      const result = (service as any).buildCombinedContext([], [])
      expect(result).toBe('')
    })

    it('should truncate long memory content', () => {
      const memories = [
        {
          id: '1',
          conversationId: 'conv-1',
          patientId: undefined,
          content: 'a'.repeat(300),
          contentType: 'message',
          similarity: 0.8,
          createdAt: '2026-03-27T10:00:00Z'
        }
      ]

      const result = (service as any).buildCombinedContext([], memories)

      // Content should be truncated to 200 chars + '...'
      expect(result).toContain('a'.repeat(200) + '...')
    })
  })

  describe('searchKnowledgeBase', () => {
    it('should return empty array on error', async () => {
      ;(knowledgeRepo.searchKnowledgeBase as jest.Mock).mockRejectedValue(new Error('DB error'))
      const result = await service.searchKnowledgeBase('test query', 'clinic-1')
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('should return results from repository', async () => {
      const mockResults = [
        { id: '1', category: 'test', question: 'Test?', answer: 'Answer', relevance: 0.9 }
      ]
      ;(knowledgeRepo.searchKnowledgeBase as jest.Mock).mockResolvedValue(mockResults)
      const result = await service.searchKnowledgeBase('test query', 'clinic-1', 0.7, 5)
      expect(result).toHaveLength(1)
      expect(result[0].similarity).toBe(0.9)
    })

    it('should filter by threshold', async () => {
      const mockResults = [
        { id: '1', category: 'test', question: 'Test?', answer: 'Answer', relevance: 0.5 }
      ]
      ;(knowledgeRepo.searchKnowledgeBase as jest.Mock).mockResolvedValue(mockResults)
      const result = await service.searchKnowledgeBase('test query', 'clinic-1', 0.7, 5)
      expect(result).toHaveLength(0) // below threshold
    })
  })

  describe('searchMemories', () => {
    it('should return empty array on error', async () => {
      ;(memoryRepo.searchMemories as jest.Mock).mockRejectedValue(new Error('DB error'))
      const result = await service.searchMemories('test query', 'clinic-1')
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('should return results from repository', async () => {
      const mockResults = [
        { id: '1', conversationId: 'conv-1', patientId: undefined, content: 'Test memory', contentType: 'message', similarity: 0.8, createdAt: '2026-03-27T10:00:00Z' }
      ]
      ;(memoryRepo.searchMemories as jest.Mock).mockResolvedValue(mockResults)
      const result = await service.searchMemories('test query', 'clinic-1', undefined, 0.6, 10)
      expect(result).toHaveLength(1)
    })
  })
})