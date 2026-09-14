import { createZenProvider } from '../provider-zen';
import type { LlmTool } from '../types';

const tool: LlmTool = {
  type: 'function',
  function: {
    name: 'operacional__consultarDisponibilidade',
    description: 'x',
    parameters: { type: 'object', properties: {} },
  },
};

function mk(body: unknown, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(body),
  });
}

describe('zen provider', () => {
  it('parses tool_calls', async () => {
    const f = mk({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 't1',
                type: 'function',
                function: {
                  name: 'operacional__consultarDisponibilidade',
                  arguments: '{"date":"2026-06-25"}',
                },
              },
            ],
          },
        },
      ],
    });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
    });
    const out = await p.complete(
      [{ role: 'user', content: 'horários?' }],
      [tool],
    );
    expect(out.toolCalls[0].function.name).toBe(
      'operacional__consultarDisponibilidade',
    );
  });

  it('parses plain text', async () => {
    const f = mk({ choices: [{ message: { content: 'Olá!' } }] });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
    });
    const out = await p.complete([{ role: 'user', content: 'oi' }], []);
    expect(out.text).toBe('Olá!');
    expect(out.toolCalls).toHaveLength(0);
  });

  it('retries once on 429', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
    });
    expect(
      (await p.complete([{ role: 'user', content: 'oi' }], [])).text,
    ).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('B1-review HIGH (b): abort entre checagem e retry → segundo fetch nunca acontece', async () => {
    const controller = new AbortController();
    const f = jest.fn(async () => {
      // primeira tentativa falha com retryable; o abort chega no microtask,
      // ou seja, depois da checagem e antes do retry
      queueMicrotask(() => controller.abort());
      return {
        ok: false,
        status: 500,
        text: async () => 'boom',
      };
    });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
    });
    const err = await p
      .complete([{ role: 'user', content: 'oi' }], [], { signal: controller.signal })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeTruthy();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
