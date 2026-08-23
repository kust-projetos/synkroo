/**
 * OpenRouter Provider (F6.06)
 */

import { BaseLlmProvider } from './base';
import type { LlmProviderConfig, LlmProviderType } from '../types';

export const OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';
export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider extends BaseLlmProvider {
  public readonly providerName: LlmProviderType = 'openrouter';

  constructor(config: LlmProviderConfig) {
    super(config, OPENROUTER_DEFAULT_MODEL, OPENROUTER_DEFAULT_BASE_URL);
  }

  protected override getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://synkroo.com',
      'X-Title': 'Synkroo Dental SaaS',
    };
  }
}
