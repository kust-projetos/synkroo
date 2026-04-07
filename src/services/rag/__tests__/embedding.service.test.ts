import { EmbeddingService } from '../embedding.service'

describe('EmbeddingService', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService()
  })

  describe('cosineSimilarity', () => {
    it('should return 1 for identical embeddings', () => {
      const embedding = [1, 0, 0, 1, 0]
      const similarity = EmbeddingService.cosineSimilarity(embedding, embedding)
      expect(similarity).toBeCloseTo(1, 5)
    })

    it('should return 0 for orthogonal embeddings', () => {
      const a = [1, 0, 0, 0]
      const b = [0, 1, 0, 0]
      const similarity = EmbeddingService.cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(0, 5)
    })

    it('should return -1 for opposite embeddings', () => {
      const a = [1, 0, 0]
      const b = [-1, 0, 0]
      const similarity = EmbeddingService.cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(-1, 5)
    })

    it('should calculate partial similarity correctly', () => {
      const a = [1, 1, 0]
      const b = [1, 0, 0]
      // a . b = 1, |a| = sqrt(2), |b| = 1
      // similarity = 1 / sqrt(2) ≈ 0.707
      const similarity = EmbeddingService.cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(0.707, 2)
    })

    it('should return 0 for zero vectors', () => {
      const a = [0, 0, 0]
      const b = [1, 1, 1]
      const similarity = EmbeddingService.cosineSimilarity(a, b)
      expect(similarity).toBe(0)
    })

    it('should throw for different dimensions', () => {
      const a = [1, 0, 0]
      const b = [1, 0]
      expect(() => EmbeddingService.cosineSimilarity(a, b)).toThrow('same dimension')
    })
  })

  describe('euclideanDistance', () => {
    it('should return 0 for identical embeddings', () => {
      const embedding = [1, 2, 3, 4]
      const distance = EmbeddingService.euclideanDistance(embedding, embedding)
      expect(distance).toBe(0)
    })

    it('should calculate distance correctly', () => {
      const a = [0, 0, 0]
      const b = [1, 1, 1]
      // distance = sqrt(1 + 1 + 1) = sqrt(3) ≈ 1.732
      const distance = EmbeddingService.euclideanDistance(a, b)
      expect(distance).toBeCloseTo(1.732, 2)
    })

    it('should throw for different dimensions', () => {
      const a = [1, 0, 0]
      const b = [1, 0]
      expect(() => EmbeddingService.euclideanDistance(a, b)).toThrow('same dimension')
    })
  })

  describe('generateEmbedding (without API key)', () => {
    it('should return zero embedding when no API key configured', async () => {
      // Service without API key (default env may not have it)
      const result = await service.generateEmbedding('test message')

      expect(result.embedding).toHaveLength(1536)
      expect(result.tokens).toBe(0)
      // All zeros when no API key
      expect(result.embedding.every(v => v === 0)).toBe(true)
    })

    it('should generate embeddings for multiple texts', async () => {
      const texts = ['hello', 'world', 'test']
      const results = await service.generateEmbeddings(texts)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.embedding).toHaveLength(1536)
      })
    })
  })

  describe('cleanText', () => {
    it('should remove extra whitespace', () => {
      // Access private method via type assertion
      const cleanText = (service as any).cleanText.bind(service)

      const result = cleanText('hello   world\n\n\n')
      expect(result).toBe('hello world')
    })

    it('should truncate very long texts', () => {
      const cleanText = (service as any).cleanText.bind(service)

      const longText = 'a'.repeat(50000)
      const result = cleanText(longText)

      expect(result.length).toBeLessThanOrEqual(30003) // 30000 + '...'
      expect(result.endsWith('...')).toBe(true)
    })
  })
})