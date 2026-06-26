import type { ChatMessage, LlmCompletion, LlmProvider, LlmTool } from './types';

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
    async complete(messages, tools) {
      try {
        return await call(messages, tools);
      } catch (e) {
        if (!retryable(e)) throw e;
        return await call(messages, tools);
      }
    },
  };
}
