/**
 * LLM Provider Types & Interfaces (F6.06)
 */

export type LlmProviderType = 'minimax' | 'openai' | 'openrouter';

export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCompletion {
  text: string | null;
  toolCalls: ToolCall[];
  finishReason?: string | null;
  usage?: LlmUsage;
}

export interface LlmProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export interface LlmProvider {
  readonly providerName: LlmProviderType;
  readonly model: string;
  complete(messages: ChatMessage[], tools?: LlmTool[]): Promise<LlmCompletion>;
}

export interface LlmFactoryConfig {
  provider?: LlmProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}
