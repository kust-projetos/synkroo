/**
 * Tests for LLM Provider Factory
 * Run: npm test -- src/lib/__tests__/factory.test.ts
 */

import { getLLMProvider, resetLLMProvider } from '../llm/factory'
import { LLMProvider } from '../llm/provider'
import { OpenAICompatProvider } from '../llm/openai-compat'
import { aiLogger } from '@/lib/logger'

jest.mock('../llm/openai-compat')
jest.mock('@/lib/logger')

describe('LLM Provider Factory', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    resetLLMProvider()
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getLLMProvider', () => {
    it('should return Minimax provider by default', () => {
      delete process.env.LLM_PROVIDER
      delete process.env.MINIMAX_API_KEY
      // Ensure we use the default model from preset
      delete process.env.MINIMAX_MODEL

      const provider = getLLMProvider()

      // Debug what was actually called
      expect(OpenAICompatProvider).toHaveBeenCalled()
      const callArgs = OpenAICompatProvider.mock.calls[0]
      expect(callArgs[0]).toBe('MiniMax')
      expect(callArgs[1].apiUrl).toBe('https://api.minimax.io/v1/text/chatcompletion_v2')
      expect(callArgs[1].apiKey).toBe('')
      expect(callArgs[1].model).toBe('MiniMax-M2.7') // Check model from preset default
      expect(callArgs[1].extraHeaders).toBeUndefined()
      expect(provider).toBeInstanceOf(OpenAICompatProvider)
    })

    it('should return OpenAI provider when configured', () => {
      process.env.LLM_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.OPENAI_MODEL = 'gpt-4'

      const provider = getLLMProvider()

      expect(OpenAICompatProvider).toHaveBeenCalledWith('OpenAI', {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-openai-key',
        model: 'gpt-4',
        extraHeaders: undefined,
      })
      expect(provider).toBeInstanceOf(OpenAICompatProvider)
    })

    it('should return OpenRouter provider when configured', () => {
      process.env.LLM_PROVIDER = 'openrouter'
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key'
      process.env.OPENROUTER_MODEL = 'test-model'

      const provider = getLLMProvider()

      expect(OpenAICompatProvider).toHaveBeenCalledWith('OpenRouter', {
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: 'test-openrouter-key',
        model: 'test-model',
        extraHeaders: {
          'HTTP-Referer': 'https://synkroo.app',
          'X-Title': 'Synkroo',
        },
      })
      expect(provider).toBeInstanceOf(OpenAICompatProvider)
    })

    it('should return Claude via proxy provider when configured', () => {
      process.env.LLM_PROVIDER = 'claude-via-proxy'
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key'
      process.env.CLAUDE_PROXY_MODEL = 'claude-3-sonnet'

      const provider = getLLMProvider()

      expect(OpenAICompatProvider).toHaveBeenCalledWith('Claude (OpenAI-compat proxy)', {
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: 'test-openrouter-key',
        model: 'claude-3-sonnet',
        extraHeaders: {
          'HTTP-Referer': 'https://synkroo.app',
          'X-Title': 'Synkroo',
        },
      })
      expect(provider).toBeInstanceOf(OpenAICompatProvider)
    })

    it('should return Groq provider when configured', () => {
      process.env.LLM_PROVIDER = 'groq'
      process.env.GROQ_API_KEY = 'test-groq-key'
      process.env.GROQ_MODEL = 'mixtral-8x7b'

      const provider = getLLMProvider()

      expect(OpenAICompatProvider).toHaveBeenCalledWith('Groq', {
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: 'test-groq-key',
        model: 'mixtral-8x7b',
        extraHeaders: undefined,
      })
      expect(provider).toBeInstanceOf(OpenAICompatProvider)
    })

    it('should cache the provider on subsequent calls', () => {
      process.env.LLM_PROVIDER = 'minimax'
      process.env.MINIMAX_API_KEY = 'test-key'

      const provider1 = getLLMProvider()
      const provider2 = getLLMProvider()

      expect(provider1).toBe(provider2)
      // OpenAICompatProvider should only be called once
      expect(OpenAICompatProvider).toHaveBeenCalledTimes(1)
    })

    it('should throw error for unknown provider type', () => {
      process.env.LLM_PROVIDER = 'unknown-provider'

      expect(() => getLLMProvider()).toThrow(
        'Unknown LLM_PROVIDER: "unknown-provider". Available: minimax, openai, openrouter, claude-via-proxy, groq'
      )
    })

    it('should warn when no API key is configured', () => {
      process.env.LLM_PROVIDER = 'minimax'
      // Ensure no API key is set
      delete process.env.MINIMAX_API_KEY

      getLLMProvider()

      expect(aiLogger.warn).toHaveBeenCalledWith('No API key configured for MiniMax', {
        envVar: 'MINIMAX_API_KEY',
        fallback: 'Responses will be empty',
      })
    })

    it('should log initialization info', () => {
      process.env.LLM_PROVIDER = 'minimax'
      process.env.MINIMAX_API_KEY = 'test-key'
      // Ensure we use the default model from preset
      delete process.env.MINIMAX_MODEL

      getLLMProvider()

      expect(aiLogger.info).toHaveBeenCalledWith('LLM Provider initialized', {
        provider: 'MiniMax',
        model: 'MiniMax-M2.7',
        configured: true,
      })
    })
  })

  describe('resetLLMProvider', () => {
    it('should clear the cached provider', () => {
      process.env.LLM_PROVIDER = 'minimax'
      process.env.MINIMAX_API_KEY = 'test-key'

      // Get provider to cache it
      const provider1 = getLLMProvider()

      // Reset the cache
      resetLLMProvider()

      // Get provider again - should create a new instance
      const provider2 = getLLMProvider()

      // Should be different instances (new OpenAICompatProvider called)
      expect(OpenAICompatProvider).toHaveBeenCalledTimes(2)
    })
  })
})