import { OpenAIProvider } from '../providers/openai';
import { LlmError } from '../errors';

/**
 * B1 — envelope `chat/completions` validado com Zod: `JSON.parse` sozinho
 * não é validação. Guards manuais foram substituídos pelo schema.
 */
function providerWithBody(body: unknown, status = 200) {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const p = new OpenAIProvider({
    apiKey: 'test-key-envelope',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { provider: p, fetchImpl };
}

describe('BaseLlmProvider — envelope Zod (B1)', () => {
  it('aceita envelope válido com tool_calls e usage', async () => {
    const { provider } = providerWithBody({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 't1',
                type: 'function',
                function: { name: 'a__b', arguments: '{"x":1}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    const out = await provider.complete([{ role: 'user', content: 'oi' }]);
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0].function.name).toBe('a__b');
    expect(out.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('rejeita envelope sem choices com LlmError invalid_response', async () => {
    const { provider } = providerWithBody({ foo: 'bar' });
    const err = await provider.complete([{ role: 'user', content: 'oi' }]).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).code).toBe('invalid_response');
    expect((err as LlmError).retryable).toBe(false);
  });

  it('rejeita tool_call sem function.name (não executa nada fantasma)', async () => {
    const { provider } = providerWithBody({
      choices: [{ message: { content: null, tool_calls: [{ id: 't9', function: {} }] } }],
    });
    const err = await provider.complete([{ role: 'user', content: 'oi' }]).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).code).toBe('invalid_response');
  });

  it('mensagem de erro não vaza a api key', async () => {
    const { provider } = providerWithBody({ nope: true });
    const err = (await provider.complete([{ role: 'user', content: 'oi' }]).catch((e) => e)) as LlmError;
    expect(err.message).not.toContain('test-key-envelope');
  });

  it('normaliza arguments-objeto para string JSON (compat)', async () => {
    const { provider } = providerWithBody({
      choices: [
        { message: { content: 'x', tool_calls: [{ id: 't2', function: { name: 'a__b', arguments: { x: 1 } } }] } },
      ],
    });
    const out = await provider.complete([{ role: 'user', content: 'oi' }]);
    expect(out.toolCalls[0].function.arguments).toBe('{"x":1}');
  });
});
