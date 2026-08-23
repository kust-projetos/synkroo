/**
 * Contract tests for LLM Adapters and Fail-Closed behavior (F6.06)
 */

import {
  createLlmProvider,
  getLlmProvider,
  MiniMaxProvider,
  OpenAIProvider,
  OpenRouterProvider,
  LlmError,
  EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
} from '../index';

describe('LLM Adapters & Fail-Closed Contract (F6.06)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MINIMAX_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.LLM_PROVIDER;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Embedding Model and Dimensions constants', () => {
    it('enforces fixed 1536 dimension and standard model', () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
      expect(DEFAULT_EMBEDDING_MODEL).toBe('text-embedding-3-small');
    });
  });

  describe('Factory Provider Selection', () => {
    it('creates MiniMax provider when configured explicitly', () => {
      const provider = createLlmProvider({
        provider: 'minimax',
        apiKey: 'test-key-minimax',
      });
      expect(provider).toBeInstanceOf(MiniMaxProvider);
      expect(provider.providerName).toBe('minimax');
      expect(provider.model).toBe('MiniMax-M2.7');
    });

    it('creates OpenAI provider when configured explicitly', () => {
      const provider = createLlmProvider({
        provider: 'openai',
        apiKey: 'test-key-openai',
        model: 'gpt-4o-mini',
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.providerName).toBe('openai');
      expect(provider.model).toBe('gpt-4o-mini');
    });

    it('creates OpenRouter provider when configured explicitly', () => {
      const provider = createLlmProvider({
        provider: 'openrouter',
        apiKey: 'test-key-openrouter',
        model: 'anthropic/claude-3.5-sonnet',
      });
      expect(provider).toBeInstanceOf(OpenRouterProvider);
      expect(provider.providerName).toBe('openrouter');
      expect(provider.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('defaults to MiniMax when LLM_PROVIDER=minimax and env var present', () => {
      process.env.MINIMAX_API_KEY = 'env-minimax-key';
      process.env.LLM_PROVIDER = 'minimax';
      const provider = getLlmProvider();
      expect(provider.providerName).toBe('minimax');
    });

    it('fails closed when no API key is provided', async () => {
      expect(() => {
        createLlmProvider({ provider: 'minimax', apiKey: '' });
      }).toThrow(LlmError);

      try {
        createLlmProvider({ provider: 'minimax', apiKey: '' });
      } catch (err: any) {
        expect(err.code).toBe('missing_api_key');
        expect(err.message).toContain('API key is required');
      }
    });

    it('fails closed when getLlmProvider called without any configured provider', async () => {
      expect(() => getLlmProvider()).toThrow(LlmError);
      try {
        getLlmProvider();
      } catch (err: any) {
        expect(err.code).toBe('missing_api_key');
      }
    });
  });

  describe('Fail-Closed Behavior & Contract Robustness', () => {
    it('fails closed on network error / provider down without fabricating success', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = new MiniMaxProvider({
        apiKey: 'test-key',
        fetchImpl: mockFetch as any,
        maxRetries: 1,
      });

      let caughtError: any;
      try {
        await provider.complete([{ role: 'user', content: 'Olá' }]);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(LlmError);
      expect(caughtError.code).toBe('provider_down');
      expect(caughtError.retryable).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('fails closed on HTTP 429 Rate Limit', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        fetchImpl: mockFetch as any,
        maxRetries: 1,
      });

      let caughtError: any;
      try {
        await provider.complete([{ role: 'user', content: 'Teste' }]);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(LlmError);
      expect(caughtError.code).toBe('rate_limited');
      expect(caughtError.statusCode).toBe(429);
    });

    it('fails closed on HTTP 401 Unauthorized without retrying', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const provider = new OpenRouterProvider({
        apiKey: 'invalid-key',
        fetchImpl: mockFetch as any,
        maxRetries: 2,
      });

      let caughtError: any;
      try {
        await provider.complete([{ role: 'user', content: 'Teste' }]);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(LlmError);
      expect(caughtError.code).toBe('unauthorized');
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.retryable).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for 401
    });

    it('fails closed on invalid JSON response from provider', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html>502 Bad Gateway</html>',
      });

      const provider = new MiniMaxProvider({
        apiKey: 'test-key',
        fetchImpl: mockFetch as any,
        maxRetries: 0,
      });

      let caughtError: any;
      try {
        await provider.complete([{ role: 'user', content: 'Teste' }]);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(LlmError);
      expect(caughtError.code).toBe('invalid_response');
    });

    it('fails closed on timeout / request abort within budget', async () => {
      const mockFetch = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          setTimeout(() => reject(err), 50);
        });
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        timeoutMs: 30,
        fetchImpl: mockFetch as any,
        maxRetries: 0,
      });

      let caughtError: any;
      try {
        await provider.complete([{ role: 'user', content: 'Teste' }]);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(LlmError);
      expect(caughtError.code).toBe('timeout');
    });

    it('redacts authorization secrets from error representations and headers', async () => {
      const secretKey = 'super-secret-minimax-key-12345';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error with key ' + secretKey,
      });

      const provider = new MiniMaxProvider({
        apiKey: secretKey,
        fetchImpl: mockFetch as any,
        maxRetries: 0,
      });

      try {
        await provider.complete([{ role: 'user', content: 'Teste' }]);
        fail('Should have thrown LlmError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(LlmError);
        expect(err.message).not.toContain(secretKey);
        expect(JSON.stringify(err)).not.toContain(secretKey);
      }
    });

    it('successfully parses completion and tool calls from OpenAI-compatible API', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 'chatcmpl-123',
            model: 'MiniMax-M2.7',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_abc123',
                      type: 'function',
                      function: {
                        name: 'operacional__consultarDisponibilidade',
                        arguments: '{"date":"2026-11-20"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
      });

      const provider = new MiniMaxProvider({
        apiKey: 'test-key',
        fetchImpl: mockFetch as any,
      });

      const res = await provider.complete(
        [{ role: 'user', content: 'Quero agendar consulta' }],
        [
          {
            type: 'function',
            function: {
              name: 'operacional__consultarDisponibilidade',
              description: 'Consulta disponibilidade da clínica',
              parameters: { type: 'object', properties: { date: { type: 'string' } } },
            },
          },
        ],
      );

      expect(res.text).toBeNull();
      expect(res.toolCalls).toHaveLength(1);
      expect(res.toolCalls[0].function.name).toBe('operacional__consultarDisponibilidade');
      expect(res.toolCalls[0].function.arguments).toBe('{"date":"2026-11-20"}');
      expect(res.usage?.totalTokens).toBe(30);
    });
  });
});
