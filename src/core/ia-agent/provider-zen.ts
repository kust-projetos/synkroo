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

/**
 * B1 (timeout budget) — cadeia única de budgets (pior caso → melhor caso):
 *
 *   provider call (este arquivo):  ZEN_CALL_TIMEOUT_MS (9s)
 *   provider complete() c/ 1 retry: ≤ 2 × 9s = 18s  < TURN_BUDGET_MS (20s)
 *   orchestrator turn budget:       TURN_BUDGET_MS (20s, ENFORÇADO — deadline
 *                                   checado antes de cada iteração + abort da
 *                                   chamada em curso via AbortSignal)
 *   invoker RPC total:              INVOKER_RPC_TIMEOUT_MS (25s, fallback)
 *   workerd cancel:                 ~30s
 *
 * O provider (30s default anterior) era MAIOR que o invoker (25s): o abort do
 * provider chegava depois do fallback do invoker, e 5 iterações × 2 retries
 * amplificavam o estouro. Com 9s por call, o pior caso de complete() (18s)
 * cabe no budget do turno (20s), que por sua vez cabe no RPC total (25s).
 * NÃO aumentar o invoker: o limite de ~30s do workerd é rígido.
 */
export const ZEN_CALL_TIMEOUT_MS = 9_000;

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

  // Integração B1×B2: signal (abort externo do deadline do turno — B1) +
  // attempt/correlationId (métrica por tentativa — B2).
  interface CallOpts {
    signal?: AbortSignal;
    attempt: number;
    correlationId?: string;
  }

  async function call(
    messages: ChatMessage[],
    tools: LlmTool[],
    opts: CallOpts,
  ): Promise<LlmCompletion> {
    const { signal, attempt, correlationId } = opts;
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? ZEN_CALL_TIMEOUT_MS);
    // B1-review: propaga o abort externo (deadline do turno) para a chamada
    // em curso — sem isto o fetch pendurado sobrevive ao budget do turno.
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onExternalAbort, { once: true });
    }
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
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  // Retry por tipo/status — nunca por sniffing de texto da mensagem.
  const retryable = (e: unknown) =>
    (e instanceof ZenHttpError &&
      e.code !== 'http_unparseable' &&
      isRetryableStatus(e.status)) ||
    (e instanceof Error && e.name === 'AbortError');

  // B1-review HIGH (TOCTOU): o signal pode abortar entre a checagem e o
  // fetch — re-checa imediatamente antes de CADA call(); abortado → erro
  // abortado sem fetch.
  const throwIfAborted = (signal?: AbortSignal): void => {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
  };

  return {
    // Integração B1×B2: deadline/abort + retry anotado (B1) com métrica por
    // tentativa e correlation propagado (B2).
    async complete(messages, tools, opts?: LlmCallOpts & { signal?: AbortSignal }) {
      // B1: correlation no texto do erro para rastreio (o abort do
      // AbortController não carrega contexto — o invoker loga o resto).
      const correlationId = opts?.correlationId;
      const corr = correlationId ?? 'none';
      const annotate = (e: unknown): void => {
        if (e instanceof Error && !e.message.includes('[corr=')) {
          e.message = `${e.message} [corr=${corr}]`;
        }
      };
      const callOpts = (attempt: number): CallOpts => ({
        signal: opts?.signal,
        attempt,
        correlationId,
      });
      try {
        throwIfAborted(opts?.signal);
        return await call(messages, tools, callOpts(1));
      } catch (e) {
        // Deadline do turno já estourou → sem retry, propaga o abort.
        if (opts?.signal?.aborted) {
          annotate(e);
          throw e;
        }
        if (!retryable(e)) {
          annotate(e);
          throw e;
        }
        try {
          throwIfAborted(opts?.signal);
          return await call(messages, tools, callOpts(2));
        } catch (e2) {
          annotate(e2);
          throw e2;
        }
      }
    },
  };
}
