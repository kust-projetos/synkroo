import { createLlmProvider } from '../provider';
import type { LlmProvider, ChatMessage, ToolCall } from '../provider';
import type { AgentTool } from '@/core/actions/agent';
import { z } from 'zod';

// Helper to create a mock AgentTool
function makeAgentTool(overrides?: Partial<AgentTool>): AgentTool {
  return {
    name: 'test_tool',
    description: 'A test tool for testing',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      limit: z.number().optional().describe('Max results'),
    }),
    run: jest.fn(),
    ...overrides,
  };
}

function makeMockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('LlmProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLlmProvider', () => {
    it('creates a provider with default config', () => {
      // apiKey required; env-based creation needs full env, tested via integration.
      const provider = createLlmProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(typeof provider.complete).toBe('function');
    });

    it('creates a provider with custom config', () => {
      const provider = createLlmProvider({
        apiKey: 'custom-key',
        model: 'custom-model',
        baseUrl: 'https://custom.api.com/v1',
      });
      expect(provider).toBeDefined();
    });
  });

  describe('toolToOpenAI conversion', () => {
    it('converts AgentTool to OpenAI function format', async () => {
      const tool = makeAgentTool();

      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'ok', tool_calls: [] } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      await provider.complete(
        [{ role: 'user', content: 'test' }],
        [tool],
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toHaveLength(1);
      expect(callBody.tools[0].type).toBe('function');
      expect(callBody.tools[0].function.name).toBe('test_tool');
      expect(callBody.tools[0].function.description).toBe('A test tool for testing');
      expect(callBody.tools[0].function.parameters).toBeDefined();
    });

    it('includes parameters schema in tool conversion', async () => {
      const tool = makeAgentTool({
        name: 'search_patients',
        description: 'Search patient records',
      });

      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'ok', tool_calls: [] } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      await provider.complete(
        [{ role: 'user', content: 'find john' }],
        [tool],
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const params = callBody.tools[0].function.parameters;
      expect(params).toBeDefined();
      expect(typeof params).toBe('object');
    });

    it('handles multiple tools', async () => {
      const tool1 = makeAgentTool({ name: 'tool_1', description: 'First tool' });
      const tool2 = makeAgentTool({ name: 'tool_2', description: 'Second tool' });

      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'ok', tool_calls: [] } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      await provider.complete(
        [{ role: 'user', content: 'test' }],
        [tool1, tool2],
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toHaveLength(2);
    });

    it('handles empty tools array', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'ok' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      await provider.complete(
        [{ role: 'user', content: 'test' }],
        [],
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toBeUndefined();
    });
  });

  describe('complete()', () => {
    it('sends POST to correct URL', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'Hello!' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({
        apiKey: 'my-key',
        baseUrl: 'https://opencode.ai/zen/v1',
        model: 'opencode/gpt-4o-mini',
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'Hi' }],
        [],
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://opencode.ai/zen/v1/chat/completions');
      expect(init.method).toBe('POST');
    });

    it('includes Authorization and Content-Type headers', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'Hello!' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'secret-key-123' });

      await provider.complete(
        [{ role: 'user', content: 'Hi' }],
        [],
      );

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-key-123',
      });
    });

    it('sends messages in request body', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'Hello!' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      await provider.complete(messages, []);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages).toEqual(messages);
    });

    it('includes model in request body', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'Hello!' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({
        apiKey: 'test-key',
        model: 'custom-model-v2',
      });

      await provider.complete([{ role: 'user', content: 'Hi' }], []);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('custom-model-v2');
    });

    it('extracts text from response', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'Olá! Como posso ajudar?' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      const result = await provider.complete(
        [{ role: 'user', content: 'Oi' }],
        [],
      );

      expect(result.text).toBe('Olá! Como posso ajudar?');
      expect(result.toolCalls).toEqual([]);
    });

    it('extracts toolCalls from response', async () => {
      const mockToolCalls = [
        {
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'search_patients',
            arguments: '{"query":"joão","page":1}',
          },
        },
      ];

      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [
            {
              message: {
                content: null,
                tool_calls: mockToolCalls,
              },
            },
          ],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      const result = await provider.complete(
        [{ role: 'user', content: 'Find João' }],
        [],
      );

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].id).toBe('call_abc123');
      expect(result.toolCalls[0].name).toBe('search_patients');
      expect(result.toolCalls[0].arguments).toEqual({ query: 'joão', page: 1 });
    });

    it('handles null content gracefully', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: null } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      const result = await provider.complete(
        [{ role: 'user', content: 'Hi' }],
        [],
      );

      expect(result.text).toBe('');
    });

    it('throws on non-2xx API response', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({ error: { message: 'Invalid API key' } }, 401),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'bad-key' });

      await expect(
        provider.complete([{ role: 'user', content: 'Hi' }], []),
      ).rejects.toThrow(/401|Invalid API key|failed/i);
    });

    it('throws on server error (5xx)', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({ error: 'Internal server error' }, 500),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });

      await expect(
        provider.complete([{ role: 'user', content: 'Hi' }], []),
      ).rejects.toThrow();
    });

    it('sends request with timeout signal', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'ok' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      await provider.complete([{ role: 'user', content: 'test' }], []);

      const [, init] = mockFetch.mock.calls[0];
      expect(init.signal).toBeDefined();
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('uses default model when none provided', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        makeMockResponse({
          choices: [{ message: { content: 'ok' } }],
        }),
      );
      global.fetch = mockFetch;

      const provider = createLlmProvider({ apiKey: 'test-key' });
      await provider.complete([{ role: 'user', content: 'test' }], []);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('opencode/gpt-4o-mini');
    });
  });
});
