/**
 * Tests for OpenAI Compatibility Provider
 * Run: npm test -- src/lib/llm/__tests__/openai-compat.test.ts
 */

import { OpenAICompatProvider } from '../openai-compat'
import type { LLMProvider } from '../provider'

describe('OpenAICompatProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with correct values', () => {
      const provider = new OpenAICompatProvider('TestProvider', {
        apiUrl: 'https://test.api.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        extraHeaders: { 'X-Custom': 'value' }
      })

      expect((provider as any).name).toBe('TestProvider')
      expect((provider as any).apiUrl).toBe('https://test.api.com/v1')
      expect((provider as any).apiKey).toBe('test-key')
      expect((provider as any).model).toBe('test-model')
      expect((provider as any).extraHeaders).toEqual({ 'X-Custom': 'value' })
    })
  })

  describe('chat', () => {
    it('should return successful response', async () => {
      const provider = new OpenAICompatProvider('TestProvider', {
        apiUrl: 'https://test.api.com/v1',
        apiKey: 'test-key',
        model: 'test-model'
      })

      const mockResponse = {
        choices: [{ message: { content: 'Hello  world!' } }]
      }

      // Mock global fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      }) as jest.Mock

      const result = await provider.chat([{ role: 'user', content: 'Test' }])

      expect(result).toBe('Hello  world!')
    })

    it('should handle JSON parsing errors', async () => {
      const provider = new OpenAICompatProvider('TestProvider', {
        apiUrl: 'https://test.api.com/v1',
        apiKey: 'test-key',
        model: 'test-model'
      })

      // Mock global fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Not JSON')
      }) as jest.Mock

      await expect(provider.chat([{ role: 'user', content: 'Test' }]))
        .rejects.toThrow('Invalid JSON response from TestProvider')
    })
  })

  describe('classifyIntent', () => {
    const provider = new OpenAICompatProvider('TestProvider', {
      apiUrl: 'https://test.api.com/v1',
      apiKey: 'test-key',
      model: 'test-model'
    })

    it('should return parsed intent classification', async () => {
      // Mock the chat method directly since classifyIntent calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue(JSON.stringify({
        intent: 'agendamento',
        confidence: 0.95,
        entities: { data: '2026-03-30', hora: '14:00' }
      }))

      const result = await provider.classifyIntent('Quero marcar consulta')

      expect(result).toEqual({
        intent: 'agendamento',
        confidence: 0.95,
        entities: { data: '2026-03-30', hora: '14:00' }
      })
    })

    it('should handle JSON parsing fallback', async () => {
      // Mock the chat method directly since classifyIntent calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue('Some text before {"intent":"duvida","confidence":0.8,"entities":{}} and after')

      const result = await provider.classifyIntent('Que horário vocês trabalham?')

      expect(result).toEqual({
        intent: 'duvida',
        confidence: 0.8,
        entities: {}
      })
    })

    it('should return default when JSON parsing fails', async () => {
      // Mock the chat method directly since classifyIntent calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue('Not JSON at all')

      const result = await provider.classifyIntent('Hello')

      expect(result).toEqual({
        intent: 'outros',
        confidence: 0.5,
        entities: {}
      })
    })

    it('should handle chat errors gracefully', async () => {
      // Mock the chat method directly since classifyIntent calls this.chat()
      ;(provider as any).chat = jest.fn().mockRejectedValue(new Error('Network error'))

      const result = await provider.classifyIntent('Test message')

      expect(result.intent).toBe('outros')
      expect(result.confidence).toBe(0)
      expect(result.entities).toHaveProperty('_error')
    })
  })

  describe('extractEntities', () => {
    const provider = new OpenAICompatProvider('TestProvider', {
      apiUrl: 'https://test.api.com/v1',
      apiKey: 'test-key',
      model: 'test-model'
    })

    it('should return parsed entities', async () => {
      // Mock the chat method directly since extractEntities calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue(JSON.stringify({
        data: '2026-03-30',
        hora: '14:00',
        nome: 'João Silva',
        telefone: '+5511999999999',
        procedimento: 'limpeza'
      }))

      const result = await provider.extractEntities('João quer limpeza dia 30 às 14h')

      expect(result).toEqual({
        data: '2026-03-30',
        hora: '14:00',
        nome: 'João Silva',
        telefone: '+5511999999999',
        procedimento: 'limpeza'
      })
    })

    it('should return empty object when JSON parsing fails', async () => {
      // Mock the chat method directly since extractEntities calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue('Invalid JSON')

      const result = await provider.extractEntities('Test message')

      expect(result).toEqual({})
    })

    it('should handle chat errors gracefully', async () => {
      // Mock the chat method directly since extractEntities calls this.chat()
      ;(provider as any).chat = jest.fn().mockRejectedValue(new Error('API error'))

      const result = await provider.extractEntities('Test message')

      expect(result).toEqual({})
    })
  })

  describe('generateResponse', () => {
    const provider = new OpenAICompatProvider('TestProvider', {
      apiUrl: 'https://test.api.com/v1',
      apiKey: 'test-key',
      model: 'test-model'
    })

    const context = {
      intent: 'agendamento',
      entities: { data: '2026-03-30', hora: '14:00' },
      conversationHistory: [],
      clinicInfo: {
        name: 'Clínica Teste',
        procedures: ['consulta', 'limpeza']
      },
      ragContext: 'Paciente tem histórico de cancelamentos'
    }

    it('should generate response with context', async () => {
      // Mock the chat method directly since generateResponse calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue('Claro! Temos horário disponível.')

      const result = await provider.generateResponse('Quero marcar consulta', context)

      expect(result).toBe('Claro! Temos horário disponível.')
      expect(provider.chat).toHaveBeenCalled()
    })

    it('should handle missing clinic info gracefully', async () => {
      const contextWithoutClinic = {
        intent: 'duvida',
        entities: {},
        conversationHistory: [],
        clinicInfo: undefined,
        ragContext: ''
      }

      // Mock the chat method directly since generateResponse calls this.chat()
      ;(provider as any).chat = jest.fn().mockResolvedValue('Nossos horários são das 8h às 18h.')

      const result = await provider.generateResponse('Qual horário de funcionamento?', contextWithoutClinic)

      expect(result).toBe('Nossos horários são das 8h às 18h.')
    })
  })

  describe('shouldEscalate', () => {
    const provider = new OpenAICompatProvider('TestProvider', {
      apiUrl: 'https://test.api.com/v1',
      apiKey: 'test-key',
      model: 'test-model'
    })

    it('should return true for escalation keywords', () => {
      // Note: shouldEscalate is async but we can test the promise directly
      expect(provider.shouldEscalate('Quero falar com um atendente', 'duvida')).resolves.toBe(true)
      expect(provider.shouldEscalate('Preciso do gerente', 'agendamento')).resolves.toBe(true)
      expect(provider.shouldEscalate('Chamar o responsável', 'outros')).resolves.toBe(true)
    })

    it('should return true for emergencia and reclamacao intents', () => {
      expect(provider.shouldEscalate('Estou com dor', 'emergencia')).resolves.toBe(true)
      expect(provider.shouldEscalate('Péssimo serviço', 'reclamacao')).resolves.toBe(true)
    })

    it('should return false for other cases', () => {
      expect(provider.shouldEscalate('Quero marcar consulta', 'agendamento')).resolves.toBe(false)
      expect(provider.shouldEscalate('Que bom!', 'outros')).resolves.toBe(false)
    })
  })
})