import type {
  ChatMessage,
  LlmCallMetric,
  LlmCallOpts,
  LlmCompletion,
  LlmMetricSink,
  LlmProvider,
  LlmTool,
  LlmUsage,
} from './types';

export interface ZenConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  provider?: string;
  /** B2: sink da métrica por tentativa (latência/usage/retry). */
  onMetric?: LlmMetricSink;
}

function toUsage(json: unknown): LlmUsage | undefined {
  if (json === null || typeof json !== 'object') return undefined;
  const u = (json as { usage?: unknown }).usage;
  if (u === null || typeof u !== 'object') return undefined;
  const r = u as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    promptTokens: num(r.prompt_tokens),
    completionTokens: num(r.completion_tokens),
    totalTokens: num(r.total_tokens),
  };
}

/**
 * Erro tipado de HTTP do provider: carrega status e code fechado.
 * O corpo da resposta NUNCA entra na mensagem (pode conter PII/conteúdo
 * arbitrário). A métrica da tentativa já foi emitida no site do throw.
 */
export class ZenHttpError extends Error {
  readonly status: number;
  readonly code: 'http_4xx' | 'http_5xx' | 'http_unparseable';
  constructor(status: number, code: 'http_4xx' | 'http_5xx' | 'http_unparseable') {
    super('zen_http_error');
    this.name = 'ZenHttpError';
    this.status = status;
    this.code = code;
  }
}

function statusCode(status: number): 'http_4xx' | 'http_5xx' {
  return status >= 500 ? 'http_5xx' : 'http_4xx';
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 || status === 409 || status === 429 || status >= 500
  );
}

export function createZenProvider(cfg: ZenConfig): LlmProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  const providerName = cfg.provider ?? 'zen';
  const emit = cfg.onMetric;
  const endpoint = cfg.baseUrl.endsWith('/')
    ? `${cfg.baseUrl}chat/completions`
    : `${cfg.baseUrl}/chat/completions`;

  function metric(
    base: Omit<LlmCallMetric, 'provider' | 'model'>,
  ): void {
    emit?.({ provider: providerName, model: cfg.model, ...base });
  }

  async function call(
    messages: ChatMessage[],
    tools: LlmTool[],
    attempt: number,
    correlationId?: string,
  ): Promise<LlmCompletion> {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30000);
    try {
      const res = await doFetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          tools,
          tool_choice: tools.length ? 'auto' : undefined,
          temperature: 0,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        const code = statusCode(res.status);
        metric({
          latencyMs: Date.now() - start,
          success: false,
          attempt,
          correlationId,
          errorCode: code,
        });
        throw new ZenHttpError(res.status, code);
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        // Corpo fora do formato esperado: classifica sem guardar o texto.
        metric({
          latencyMs: Date.now() - start,
          success: false,
          attempt,
          correlationId,
          errorCode: 'http_unparseable',
        });
        throw new ZenHttpError(res.status, 'http_unparseable');
      }
      const m = (json as { choices?: Array<{ message?: unknown }> }).choices?.[0]
        ?.message ?? {};
      const envelope = (
        m !== null && typeof m === 'object' ? m : {}
      ) as { content?: unknown; tool_calls?: unknown };
      const usage = toUsage(json);
      metric({
        latencyMs: Date.now() - start,
        success: true,
        attempt,
        usage,
        correlationId,
      });
      return {
        text: typeof envelope.content === 'string' ? envelope.content : null,
        toolCalls: Array.isArray(envelope.tool_calls)
          ? (envelope.tool_calls as LlmCompletion['toolCalls'])
          : [],
        usage,
      };
    } catch (e) {
      // Métrica já emitida no site para ZenHttpError: só repassa.
      // Abort/rede/parse sem métrica ainda: registra aqui com code fechado.
      // Nenhuma inferência por texto de mensagem (sem regex em e.message).
      if (e instanceof ZenHttpError) throw e;
      if (e instanceof Error && e.name === 'AbortError') {
        metric({
          latencyMs: Date.now() - start,
          success: false,
          attempt,
          correlationId,
          errorCode: 'timeout',
        });
        throw e;
      }
      metric({
        latencyMs: Date.now() - start,
        success: false,
        attempt,
        correlationId,
        // SyntaxError = JSON.parse do corpo (não-retryable); resto = rede.
        errorCode: e instanceof SyntaxError ? 'http_unparseable' : 'provider_error',
      });
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Retry por tipo/status — nunca por sniffing de texto da mensagem.
  const retryable = (e: unknown) =>
    (e instanceof ZenHttpError &&
      e.code !== 'http_unparseable' &&
      isRetryableStatus(e.status)) ||
    (e instanceof Error && e.name === 'AbortError');

  return {
    async complete(messages, tools, opts?: LlmCallOpts) {
      const correlationId = opts?.correlationId;
      try {
        return await call(messages, tools, 1, correlationId);
      } catch (e) {
        if (!retryable(e)) throw e;
        return await call(messages, tools, 2, correlationId);
      }
    },
  };
}
