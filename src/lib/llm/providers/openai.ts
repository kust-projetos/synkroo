/**
 * OpenAI Provider (F6.06)
 */

import { BaseLlmProvider } from './base';
import type { LlmProviderConfig, LlmProviderType } from '../types';

export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class OpenAIProvider extends BaseLlmProvider {
  public readonly providerName: LlmProviderType = 'openai';

  constructor(config: LlmProviderConfig) {
    super(config, OPENAI_DEFAULT_MODEL, OPENAI_DEFAULT_BASE_URL);
  }
}
