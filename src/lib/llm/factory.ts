/**
 * LLM Provider Factory (F6.06)
 */

import type { LlmFactoryConfig, LlmProvider, LlmProviderType } from './types';
import { LlmError } from './errors';
import { MiniMaxProvider } from './providers/minimax';
import { OpenAIProvider } from './providers/openai';
import { OpenRouterProvider } from './providers/openrouter';

export function createLlmProvider(config: LlmFactoryConfig): LlmProvider {
  const providerType: LlmProviderType = config.provider || 'minimax';
  const apiKey = config.apiKey;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new LlmError({
      message: `API key is required for provider '${providerType}'`,
      code: 'missing_api_key',
      provider: providerType,
    });
  }

  const providerConfig = {
    apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    fetchImpl: config.fetchImpl,
  };

  switch (providerType) {
    case 'minimax':
      return new MiniMaxProvider(providerConfig);
    case 'openai':
      return new OpenAIProvider(providerConfig);
    case 'openrouter':
      return new OpenRouterProvider(providerConfig);
    default:
      throw new LlmError({
        message: `Unsupported LLM provider: ${providerType}`,
        code: 'invalid_input',
        provider: providerType,
      });
  }
}

/**
 * Resolves configured LLM Provider from environment variables or throws fail-closed error.
 */
export function getLlmProvider(preferredProvider?: LlmProviderType): LlmProvider {
  const providerType: LlmProviderType =
    preferredProvider ||
    (process.env.LLM_PROVIDER as LlmProviderType) ||
    (process.env.MINIMAX_API_KEY ? 'minimax' : process.env.OPENAI_API_KEY ? 'openai' : 'openrouter');

  let apiKey: string | undefined;
  let model: string | undefined;
  let baseUrl: string | undefined;

  if (providerType === 'minimax') {
    apiKey = process.env.MINIMAX_API_KEY;
    model = process.env.MINIMAX_MODEL;
    baseUrl = process.env.MINIMAX_BASE_URL;
  } else if (providerType === 'openai') {
    apiKey = process.env.OPENAI_API_KEY;
    model = process.env.OPENAI_MODEL;
    baseUrl = process.env.OPENAI_BASE_URL;
  } else if (providerType === 'openrouter') {
    apiKey = process.env.OPENROUTER_API_KEY;
    model = process.env.OPENROUTER_MODEL;
    baseUrl = process.env.OPENROUTER_BASE_URL;
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new LlmError({
      message: `No active LLM provider configured with valid API key. (Provider: ${providerType})`,
      code: 'missing_api_key',
      provider: providerType,
    });
  }

  return createLlmProvider({
    provider: providerType,
    apiKey,
    model,
    baseUrl,
  });
}
