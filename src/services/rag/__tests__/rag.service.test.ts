import { RAGService } from '../rag.service'
import { EmbeddingService } from '../embedding.service'

// Mock the supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: () => ({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  })
}))

describe('RAGService', () => {
  let service: RAGService

  beforeEach(() => {
    service = new RAGService()
    jest.clearAllMocks()
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
        { id: '1', conversationId: 'conv-1', patientId: 'pat-1', content: 'Paciente quer agendar limpeza', contentType: 'message', similarity: 0.75, createdAt: '2026-03-27T10:00:00Z' }
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
        { id: '1', conversationId: 'conv-1', patientId: 'pat-1', content: 'Paciente preferiu horário da manhã', contentType: 'message', similarity: 0.8, createdAt: '2026-03-27T10:00:00Z' }
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
          patientId: 'pat-1',
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

  describe('getEmbeddingDimension', () => {
    it('should return 1536 for text-embedding-3-small', () => {
      expect(RAGService.getEmbeddingDimension()).toBe(1536)
    })
  })

  describe('searchKnowledgeBase', () => {
    it('should return empty array on error', async () => {
      const embedding = new Array(1536).fill(0)
      const result = await service.searchKnowledgeBase(embedding, 'clinic-1')

      // With mocked RPC that doesn't return data
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('searchMemories', () => {
    it('should return empty array on error', async () => {
      const embedding = new Array(1536).fill(0)
      const result = await service.searchMemories(embedding, 'clinic-1')

      expect(Array.isArray(result)).toBe(true)
    })
  })
})