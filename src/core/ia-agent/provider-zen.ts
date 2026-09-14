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

function toErrorCode(e: unknown, status?: number): string {
  if (typeof status === 'number') return `http_${status}`;
  if (e instanceof Error) {
    if (e.name === 'AbortError') return 'timeout';
    const m = e.message.match(/HTTP (\d{3})/);
    if (m) return `http_${m[1]}`;
  }
  return 'provider_error';
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
        metric({
          latencyMs: Date.now() - start,
          success: false,
          attempt,
          correlationId,
          errorCode: toErrorCode(undefined, res.status),
        });
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const json = JSON.parse(text);
      const m = json.choices?.[0]?.message ?? {};
      const usage = toUsage(json);
      metric({
        latencyMs: Date.now() - start,
        success: true,
        attempt,
        usage,
        correlationId,
      });
      return { text: m.content ?? null, toolCalls: m.tool_calls ?? [], usage };
    } catch (e) {
      // Falha de rede/abort/parse na tentativa final: registra antes de subir.
      // (Falhas HTTP já emitiram acima; evita métrica duplicada checando a marca.)
      if (
        e instanceof Error &&
        !/HTTP \d{3}/.test(e.message) &&
        e.name !== 'AbortError'
      ) {
        metric({
          latencyMs: Date.now() - start,
          success: false,
          attempt,
          correlationId,
          errorCode: toErrorCode(e),
        });
      } else if (e instanceof Error && e.name === 'AbortError') {
        metric({
          latencyMs: Date.now() - start,
          success: false,
          attempt,
          correlationId,
          errorCode: 'timeout',
        });
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  const retryable = (e: unknown) =>
    e instanceof Error &&
    (e.name === 'AbortError' || /HTTP (408|409|429|5\d\d)/.test(e.message));

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
