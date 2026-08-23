/**
 * MiniMax Provider (F6.06)
 * Default provider for local dev and production conversational AI
 */

import { BaseLlmProvider } from './base';
import type { LlmProviderConfig, LlmProviderType } from '../types';

export const MINIMAX_DEFAULT_MODEL = 'MiniMax-M2.7';
export const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.chat/v1';

export class MiniMaxProvider extends BaseLlmProvider {
  public readonly providerName: LlmProviderType = 'minimax';

  constructor(config: LlmProviderConfig) {
    super(config, MINIMAX_DEFAULT_MODEL, MINIMAX_DEFAULT_BASE_URL);
  }
}
