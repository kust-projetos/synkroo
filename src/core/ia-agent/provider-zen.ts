import type { ChatMessage, LlmCompletion, LlmProvider, LlmTool } from './types';

/**
 * B1 (timeout budget) — cadeia única de budgets (pior caso → melhor caso):
 *
 *   provider call (este arquivo):  ZEN_CALL_TIMEOUT_MS (9s)
 *   provider complete() c/ 1 retry: ≤ 2 × 9s = 18s  < TURN_BUDGET_MS (20s)
 *   orchestrator turn budget:       TURN_BUDGET_MS (20s, documental — o retry
 *                                   do provider cabe dentro de um turno)
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
}

export function createZenProvider(cfg: ZenConfig): LlmProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  const endpoint = cfg.baseUrl.endsWith('/')
    ? `${cfg.baseUrl}chat/completions`
    : `${cfg.baseUrl}/chat/completions`;

  async function call(
    messages: ChatMessage[],
    tools: LlmTool[],
  ): Promise<LlmCompletion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? ZEN_CALL_TIMEOUT_MS);
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
      if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text);
      const m = json.choices?.[0]?.message ?? {};
      return { text: m.content ?? null, toolCalls: m.tool_calls ?? [] };
    } finally {
      clearTimeout(timeout);
    }
  }

  const retryable = (e: unknown) =>
    e instanceof Error &&
    (e.name === 'AbortError' || /HTTP (408|409|429|5\d\d)/.test(e.message));

  return {
    async complete(messages, tools, opts?: { correlationId?: string }) {
      // B1: correlation no texto do erro para rastreio (o abort do
      // AbortController não carrega contexto — o invoker loga o resto).
      const corr = opts?.correlationId ?? 'none';
      try {
        return await call(messages, tools);
      } catch (e) {
        if (!retryable(e)) {
          if (e instanceof Error && !e.message.includes('[corr=')) {
            e.message = `${e.message} [corr=${corr}]`;
          }
          throw e;
        }
        try {
          return await call(messages, tools);
        } catch (e2) {
          if (e2 instanceof Error && !e2.message.includes('[corr=')) {
            e2.message = `${e2.message} [corr=${corr}]`;
          }
          throw e2;
        }
      }
    },
  };
}
