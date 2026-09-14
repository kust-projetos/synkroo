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
  /** B2: sink da métrica por tentativa (latência/usage/retry). */
  onMetric?: LlmTelemetrySink;
}

/** Opções por chamada (aditivas — callers com 2 args seguem válidos). */
export interface LlmCallOpts {
  correlationId?: string;
}

/** Métrica por tentativa de provider call (B2 — log estruturado, sem backend externo). */
export interface LlmCallMetric {
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  /** Tentativa 1-based (1 = primeira; >1 indica retry). */
  attempt: number;
  usage?: LlmUsage;
  correlationId?: string;
  errorCode?: string;
}

export type LlmTelemetrySink = (metric: LlmCallMetric) => void;

export interface LlmProvider {
  readonly providerName: LlmProviderType;
  readonly model: string;
  complete(messages: ChatMessage[], tools?: LlmTool[], opts?: LlmCallOpts): Promise<LlmCompletion>;
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
