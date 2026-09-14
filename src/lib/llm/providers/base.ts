/**
 * Base Abstract LLM Provider with fail-closed mechanics and safe retry policy (F6.06)
 */

import type {
  ChatMessage,
  LlmCallMetric,
  LlmCallOpts,
  LlmCompletion,
  LlmProvider,
  LlmProviderConfig,
  LlmProviderType,
  LlmTelemetrySink,
  LlmTool,
  ToolCall,
} from '../types';
import { LlmError } from '../errors';
import { z } from 'zod';

/**
 * B1 — envelope `chat/completions` validado com Zod em vez de guards manuais.
 * Falha de schema → `LlmError` (`invalid_response`, sem retry); a mensagem de
 * erro carrega só os paths inválidos, nunca o payload bruto (sem secrets).
 */
const ProviderToolCallSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: z.string().optional(),
    function: z
      .object({
        name: z.string().min(1),
        arguments: z.unknown().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ChatCompletionsEnvelopeSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.union([z.string(), z.null()]).optional(),
                tool_calls: z.array(ProviderToolCallSchema).optional(),
              })
              .passthrough()
              .optional(),
            finish_reason: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type ChatCompletionsEnvelope = z.infer<typeof ChatCompletionsEnvelopeSchema>;

function invalidEnvelopeError(
  provider: LlmProviderType,
  apiKey: string,
  detail: string,
): LlmError {
  return new LlmError({
    message: `Invalid response envelope from provider: ${detail}`,
    code: 'invalid_response',
    provider,
    retryable: false,
    secrets: [apiKey],
  });
}

/** Normaliza o envelope já validado para `LlmCompletion` (mesma semântica dos guards antigos). */
function toCompletion(envelope: ChatCompletionsEnvelope): LlmCompletion {
  const choice = envelope.choices[0];
  const msg = choice.message ?? {};
  const toolCalls: ToolCall[] = [];

  for (const tc of msg.tool_calls ?? []) {
    // function.name vazio já é barrado pelo schema; id ausente ganha fallback.
    toolCalls.push({
      id: tc.id || `call_${Math.random().toString(36).slice(2, 9)}`,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments:
          typeof tc.function.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments ?? {}),
      },
    });
  }

  return {
    text: typeof msg.content === 'string' ? msg.content : null,
    toolCalls,
    finishReason: choice.finish_reason ?? null,
    usage: envelope.usage
      ? {
          promptTokens: envelope.usage.prompt_tokens ?? 0,
          completionTokens: envelope.usage.completion_tokens ?? 0,
          totalTokens: envelope.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

export abstract class BaseLlmProvider implements LlmProvider {
  public abstract readonly providerName: LlmProviderType;
  public readonly model: string;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly timeoutMs: number;
  protected readonly maxRetries: number;
  protected readonly fetchImpl: typeof fetch;
  protected readonly onMetric?: LlmTelemetrySink;

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
    this.onMetric = config.onMetric;
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

  public async complete(messages: ChatMessage[], tools: LlmTool[] = [], opts: LlmCallOpts = {}): Promise<LlmCompletion> {
    let attempt = 0;
    const maxAttempts = 1 + Math.max(0, this.maxRetries);
    const correlationId = opts.correlationId;

    const emit = (m: Omit<LlmCallMetric, 'provider' | 'model'>): void => {
      this.onMetric?.({
        provider: this.providerName,
        model: this.model,
        correlationId,
        ...m,
      });
    };

    while (attempt < maxAttempts) {
      attempt++;
      const startedAt = Date.now();
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
            emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'unauthorized' });
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
              emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'rate_limited' });
              await new Promise((r) => setTimeout(r, attempt * 50));
              continue;
            }
            emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'rate_limited' });
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
              emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'provider_down' });
              await new Promise((r) => setTimeout(r, attempt * 50));
              continue;
            }
            emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'provider_down' });
            throw new LlmError({
              message: `Provider server error: HTTP ${res.status}`,
              code: 'provider_down',
              provider: this.providerName,
              statusCode: res.status,
              retryable: true,
              secrets: [this.apiKey],
            });
          }

          emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'invalid_response' });
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
          emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'invalid_response' });
          throw new LlmError({
            message: `Invalid JSON response from provider: ${text.slice(0, 200)}`,
            code: 'invalid_response',
            provider: this.providerName,
            retryable: false,
            secrets: [this.apiKey],
          });
        }

        // Integração B1×B2: validação Zod do envelope (B1, fail-closed) COM
        // métrica estruturada por tentativa (B2). Falha de schema →
        // `invalid_response` sem retry; paths inválidos no erro, nunca o
        // payload bruto (sem secrets/PII).
        const choice = ChatCompletionsEnvelopeSchema.safeParse(json);
        if (!choice.success) {
          const paths = choice.error.issues
            .map((i) => i.path.join('.') || '(root)')
            .slice(0, 5)
            .join(', ');
          emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'invalid_response' });
          throw invalidEnvelopeError(this.providerName, this.apiKey, paths);
        }

        const completion = toCompletion(choice.data);
        emit({ latencyMs: Date.now() - startedAt, success: true, attempt, usage: completion.usage });
        return completion;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof LlmError) {
          throw err;
        }

        const isAbort = (err as Error)?.name === 'AbortError' || (err as Error)?.message?.includes('aborted');
        if (isAbort) {
          emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'timeout' });
          throw new LlmError({
            message: `Request timed out after ${this.timeoutMs}ms`,
            code: 'timeout',
            provider: this.providerName,
            retryable: false,
            secrets: [this.apiKey],
          });
        }

        if (this.isRetryableError(err) && attempt < maxAttempts) {
          emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'provider_down' });
          await new Promise((r) => setTimeout(r, attempt * 50));
          continue;
        }

        emit({ latencyMs: Date.now() - startedAt, success: false, attempt, errorCode: 'provider_down' });
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
