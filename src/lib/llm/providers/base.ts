/**
 * Base Abstract LLM Provider with fail-closed mechanics and safe retry policy (F6.06)
 */

import type {
  ChatMessage,
  LlmCompletion,
  LlmProvider,
  LlmProviderConfig,
  LlmProviderType,
  LlmTool,
  ToolCall,
} from '../types';
import { LlmError } from '../errors';

export abstract class BaseLlmProvider implements LlmProvider {
  public abstract readonly providerName: LlmProviderType;
  public readonly model: string;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly timeoutMs: number;
  protected readonly maxRetries: number;
  protected readonly fetchImpl: typeof fetch;

  constructor(config: LlmProviderConfig, defaultModel: string, defaultBaseUrl: string) {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new LlmError({
        message: 'API key is required for LLM provider',
        code: 'missing_api_key',
      });
    }

    this.apiKey = config.apiKey.trim();
    this.model = config.model || defaultModel;
    this.baseUrl = (config.baseUrl || defaultBaseUrl).replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  protected getEndpoint(): string {
    return `${this.baseUrl}/chat/completions`;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected isRetryableError(error: unknown, status?: number): boolean {
    if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
      return true;
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('abort')) {
        return false; // timeout/abort should respect budget
      }
      if (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('fetch failed')
      ) {
        return true;
      }
    }
    return false;
  }

  public async complete(messages: ChatMessage[], tools: LlmTool[] = []): Promise<LlmCompletion> {
    let attempt = 0;
    const maxAttempts = 1 + Math.max(0, this.maxRetries);

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const payload: Record<string, unknown> = {
          model: this.model,
          messages,
          temperature: 0,
        };

        if (tools.length > 0) {
          payload.tools = tools;
          payload.tool_choice = 'auto';
        }

        const res = await this.fetchImpl(this.getEndpoint(), {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const text = await res.text();

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new LlmError({
              message: `Authentication failed with provider: HTTP ${res.status}`,
              code: 'unauthorized',
              provider: this.providerName,
              statusCode: res.status,
              retryable: false,
              secrets: [this.apiKey],
            });
          }

          if (res.status === 429) {
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, attempt * 50));
              continue;
            }
            throw new LlmError({
              message: `Rate limit exceeded from provider: HTTP 429`,
              code: 'rate_limited',
              provider: this.providerName,
              statusCode: 429,
              retryable: true,
              secrets: [this.apiKey],
            });
          }

          if (res.status >= 500) {
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, attempt * 50));
              continue;
            }
            throw new LlmError({
              message: `Provider server error: HTTP ${res.status}`,
              code: 'provider_down',
              provider: this.providerName,
              statusCode: res.status,
              retryable: true,
              secrets: [this.apiKey],
            });
          }

          throw new LlmError({
            message: `Provider error: HTTP ${res.status}`,
            code: 'invalid_response',
            provider: this.providerName,
            statusCode: res.status,
            retryable: false,
            secrets: [this.apiKey],
          });
        }

        // Parse JSON response
        let json: any;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          throw new LlmError({
            message: `Invalid JSON response from provider: ${text.slice(0, 200)}`,
            code: 'invalid_response',
            provider: this.providerName,
            retryable: false,
            secrets: [this.apiKey],
          });
        }

        const choice = json.choices?.[0];
        if (!choice) {
          throw new LlmError({
            message: 'No choices returned by LLM provider',
            code: 'invalid_response',
            provider: this.providerName,
            retryable: false,
            secrets: [this.apiKey],
          });
        }

        const msg = choice.message ?? {};
        const rawToolCalls = msg.tool_calls;
        const toolCalls: ToolCall[] = [];

        if (Array.isArray(rawToolCalls)) {
          for (const tc of rawToolCalls) {
            if (tc && tc.function && typeof tc.function.name === 'string') {
              toolCalls.push({
                id: tc.id || `call_${Math.random().toString(36).slice(2, 9)}`,
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: typeof tc.function.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function.arguments ?? {}),
                },
              });
            }
          }
        }

        return {
          text: typeof msg.content === 'string' ? msg.content : null,
          toolCalls,
          finishReason: choice.finish_reason ?? null,
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
                totalTokens: json.usage.total_tokens ?? 0,
              }
            : undefined,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof LlmError) {
          throw err;
        }

        const isAbort = (err as Error)?.name === 'AbortError' || (err as Error)?.message?.includes('aborted');
        if (isAbort) {
          throw new LlmError({
            message: `Request timed out after ${this.timeoutMs}ms`,
            code: 'timeout',
            provider: this.providerName,
            retryable: false,
            secrets: [this.apiKey],
          });
        }

        if (this.isRetryableError(err) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 50));
          continue;
        }

        throw new LlmError({
          message: `Network failure connecting to provider: ${(err as Error)?.message ?? 'Unknown error'}`,
          code: 'provider_down',
          provider: this.providerName,
          retryable: true,
          cause: err,
          secrets: [this.apiKey],
        });
      }
    }

    throw new LlmError({
      message: 'Max retry attempts exhausted connecting to provider',
      code: 'provider_down',
      provider: this.providerName,
      retryable: true,
      secrets: [this.apiKey],
    });
  }
}
