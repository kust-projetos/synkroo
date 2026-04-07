/**
 * Tests for MiniMax Client
 * Run: npm test -- minimax.test.ts
 */

import { MiniMaxClient } from '../lib/minimax'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Helper to create mock response with both text() and json()
function createMockResponse(data: any) {
  return {
    ok: true,
    text: async () => JSON.stringify(data),
    json: async () => data
  }
}

describe('MiniMaxClient', () => {
  let client: MiniMaxClient

  beforeEach(() => {
    client = new MiniMaxClient()
    jest.clearAllMocks()
  })

  describe('classifyIntent', () => {
    it('should classify agendamento intent correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '{"intent": "agendamento", "confidence": 0.95, "entities": {"data": null, "hora": null}}'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await client.classifyIntent('Quero marcar uma consulta para quinta')

      expect(result.intent).toBe('agendamento')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should classify emergencia intent correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '{"intent": "emergencia", "confidence": 0.98, "entities": {}}'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await client.classifyIntent('Estou com muita dor de dente!')

      expect(result.intent).toBe('emergencia')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify duvida intent correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '{"intent": "duvida", "confidence": 0.88, "entities": {"procedimento": "clareamento"}}'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await client.classifyIntent('Qual o valor do clareamento?')

      expect(result.intent).toBe('duvida')
      expect(result.entities.procedimento).toBe('clareamento')
    })

    it('should return fallback on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await client.classifyIntent('Test message')

      expect(result.intent).toBe('outros')
      expect(result.confidence).toBe(0)
    })
  })

  describe('extractEntities', () => {
    it('should extract date and time correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '{"data": "2026-03-30", "hora": "10:00", "nome": null, "telefone": null, "procedimento": null}'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await client.extractEntities('Quero marcar para quinta às 10h')

      expect(result.data).toBeTruthy()
      expect(result.hora).toBe('10:00')
    })

    it('should extract procedure name', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '{"data": null, "hora": null, "nome": null, "telefone": null, "procedimento": "clareamento"}'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await client.extractEntities('Quero fazer um clareamento dental')

      expect(result.procedimento).toBe('clareamento')
    })
  })

  describe('shouldEscalate', () => {
    it('should escalate for emergencies', async () => {
      const result = await client.shouldEscalate('Estou com dor muito forte!', 'emergencia')
      expect(result).toBe(true)
    })

    it('should escalate for complaints', async () => {
      const result = await client.shouldEscalate('Estou muito insatisfeito com o atendimento', 'reclamacao')
      expect(result).toBe(true)
    })

    it('should escalate when human is requested', async () => {
      const result = await client.shouldEscalate('Quero falar com um atendente', 'duvida')
      expect(result).toBe(true)
    })

    it('should not escalate for normal questions', async () => {
      const result = await client.shouldEscalate('Qual o valor do clareamento?', 'duvida')
      expect(result).toBe(false)
    })

    it('should not escalate for scheduling', async () => {
      const result = await client.shouldEscalate('Quero marcar uma consulta', 'agendamento')
      expect(result).toBe(false)
    })
  })

  describe('generateResponse', () => {
    it('should generate contextual response', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Olá! Ficarei feliz em ajudá-lo a agendar sua consulta. Qual seria o melhor dia e horário para você?'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await client.generateResponse('Quero marcar uma consulta', {
        intent: 'agendamento',
        entities: {},
        conversationHistory: []
      })

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(10)
    })
  })
})