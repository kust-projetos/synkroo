/**
 * LLM Provider Factory
 * Creates the appropriate LLM provider based on LLM_PROVIDER env var.
 * All providers use OpenAI-compatible format (compatibility mode).
 */

import { LLMProvider } from './provider'
import { OpenAICompatProvider } from './openai-compat'
import { aiLogger } from '@/lib/logger'

type ProviderType = 'minimax' | 'openai' | 'openrouter' | 'claude-via-proxy' | 'groq'

interface ProviderPreset {
  name: string
  apiUrl: string
  apiKeyEnv: string
  modelEnv: string
  defaultModel: string
  extraHeaders?: Record<string, string>
}

const PRESETS: Record<ProviderType, ProviderPreset> = {
  minimax: {
    name: 'MiniMax',
    apiUrl: 'https://api.minimax.io/v1/text/chatcompletion_v2',
    apiKeyEnv: 'MINIMAX_API_KEY',
    modelEnv: 'MINIMAX_MODEL',
    defaultModel: 'MiniMax-M2.7',
  },
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
  },
  'openrouter': {
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    extraHeaders: {
      'HTTP-Referer': 'https://synkroo.app',
      'X-Title': 'Synkroo',
    },
  },
  'claude-via-proxy': {
    name: 'Claude (OpenAI-compat proxy)',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'CLAUDE_PROXY_MODEL',
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    extraHeaders: {
      'HTTP-Referer': 'https://synkroo.app',
      'X-Title': 'Synkroo',
    },
  },
  groq: {
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKeyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
  },
}

let cachedProvider: LLMProvider | null = null

/**
 * Get the configured LLM provider (singleton).
 * Configured via LLM_PROVIDER env var (default: 'minimax').
 */
export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider

  const providerType = (process.env.LLM_PROVIDER || 'minimax') as ProviderType
  const preset = PRESETS[providerType]

  if (!preset) {
    throw new Error(
      `Unknown LLM_PROVIDER: "${providerType}". Available: ${Object.keys(PRESETS).join(', ')}`
    )
  }

  const apiKey = process.env[preset.apiKeyEnv] || ''
  const model = process.env[preset.modelEnv] || preset.defaultModel

  if (!apiKey) {
    aiLogger.warn(`No API key configured for ${preset.name}`, {
      envVar: preset.apiKeyEnv,
      fallback: 'Responses will be empty',
    })
  }

  cachedProvider = new OpenAICompatProvider(preset.name, {
    apiUrl: preset.apiUrl,
    apiKey,
    model,
    extraHeaders: preset.extraHeaders,
  })

  aiLogger.info('LLM Provider initialized', {
    provider: preset.name,
    model,
    configured: !!apiKey,
  })

  return cachedProvider
}

/**
 * Force reset the cached provider (useful for testing or config changes)
 */
export function resetLLMProvider(): void {
  cachedProvider = null
}
