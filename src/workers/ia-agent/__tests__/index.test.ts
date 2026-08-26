/**
 * Unit Test Suite for ia-agent DurableObject & Worker (src/workers/ia-agent/index.ts)
 *
 * Covers:
 * 1. Constructor: runtime environment validation and state initialization
 * 2. runTurn: storage retrieval (history fallback [] and pendingAction fallback undefined)
 * 3. Provider wiring: createZenProvider with apiKey, model, and baseUrl
 * 4. Orchestrator delegation: runAgentTurn invocation with input, history, and pendingAction
 * 5. State persistence & 20-message window trimming (.slice(-20))
 * 6. Pending action persistence (action object vs null)
 * 7. Worker fetch handler: env validation and 200 'ia-agent up' response
 */

// ── Mocks ────────────────────────────────────────────────────────

jest.mock(
  'cloudflare:workers',
  () => {
    return {
      DurableObject: class DurableObject<E = any> {
        ctx: any;
        env: E;
        constructor(ctx: any, env: E) {
          this.ctx = ctx;
          this.env = env;
        }
      },
    };
  },
  { virtual: true },
);

const mockCreateZenProvider = jest.fn().mockReturnValue({
  chat: jest.fn(),
});
jest.mock('@/core/ia-agent/provider-zen', () => ({
  createZenProvider: (args: any) => mockCreateZenProvider(args),
}));

const mockRunAgentTurn = jest.fn().mockResolvedValue({
  reply: 'Olá! Como posso ajudar você hoje?',
  pendingAction: undefined,
});
jest.mock('@/core/ia-agent/orchestrator-logic', () => ({
  runTurn: (deps: any, input: any) => mockRunAgentTurn(deps, input),
}));

jest.mock('@/lib/runtime-env', () => ({
  parseRuntimeEnv: jest.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────

import worker, { AgentOrchestrator, type Env } from '../index';
import { parseRuntimeEnv } from '@/lib/runtime-env';
import type { ChatMessage, PendingAction, AppBinding } from '@/core/ia-agent/types';

// ── Helpers ──────────────────────────────────────────────────────

function createMockStorage() {
  const store = new Map<string, any>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    put: jest.fn(async (key: string, val: any) => {
      store.set(key, val);
    }),
    setAlarm: jest.fn(async (_ms: number) => {}),
    getAlarm: jest.fn(async () => null),
  };
}

function createMockCtx() {
  const storage = createMockStorage();
  return {
    storage,
  } as unknown as DurableObjectState & { storage: ReturnType<typeof createMockStorage> };
}

function createMockEnv(): Env {
  const mockAppBinding: AppBinding = {
    listTools: jest.fn(),
    executeAction: jest.fn(),
    issueHandle: jest.fn(),
  };

  return {
    OPENCODE_ZEN_API_KEY: 'sk-zen-test-key-123',
    IA_LLM_MODEL: 'zen/gpt-4o-mini',
    IA_LLM_BASE_URL: 'https://llm.opencode.test/v1',
    APP: mockAppBinding as any,
  } as unknown as Env;
}

// ── Test Suite ───────────────────────────────────────────────────

describe('ia-agent DurableObject (AgentOrchestrator)', () => {
  let mockEnv: Env;
  let mockCtx: ReturnType<typeof createMockCtx>;
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv = createMockEnv();
    mockCtx = createMockCtx();
    orchestrator = new AgentOrchestrator(mockCtx, mockEnv);
  });

  describe('Constructor', () => {
    it('validates runtime env for agent and initializes DurableObject', () => {
      expect(parseRuntimeEnv).toHaveBeenCalledWith('agent', mockEnv);
      expect(orchestrator.env).toBe(mockEnv);
      expect(orchestrator.ctx).toBe(mockCtx);
    });
  });

  describe('runTurn method', () => {
    it('handles empty storage, wires provider, runs turn, and persists history & pendingAction null', async () => {
      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Posso agendar sua consulta.',
        pendingAction: undefined,
      });

      const input = {
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'Gostaria de agendar para amanhã',
        handle: 'handle-token-1',
      };

      const result = await orchestrator.runTurn(input);

      // Verify storage loading
      expect(mockCtx.storage.get).toHaveBeenCalledWith('history');
      expect(mockCtx.storage.get).toHaveBeenCalledWith('pendingAction');

      // Verify provider instantiation
      expect(mockCreateZenProvider).toHaveBeenCalledWith({
        apiKey: 'sk-zen-test-key-123',
        model: 'zen/gpt-4o-mini',
        baseUrl: 'https://llm.opencode.test/v1',
      });

      // Verify orchestrator execution
      expect(mockRunAgentTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.any(Object),
          app: mockEnv.APP,
          now: expect.any(Date),
        }),
        {
          ...input,
          history: [],
          pendingAction: undefined,
        },
      );

      // Verify storage persistence
      expect(mockCtx.storage.put).toHaveBeenCalledWith('history', [
        { role: 'user', content: 'Gostaria de agendar para amanhã' },
        { role: 'assistant', content: 'Posso agendar sua consulta.' },
      ]);
      expect(mockCtx.storage.put).toHaveBeenCalledWith('pendingAction', null);

      // Verify returned result
      expect(result).toEqual({
        reply: 'Posso agendar sua consulta.',
        pendingAction: undefined,
      });
    });

    it('loads existing history and pendingAction from storage and persists updated state', async () => {
      const existingHistory: ChatMessage[] = [
        { role: 'user', content: 'Olá' },
        { role: 'assistant', content: 'Olá! Como posso ajudar?' },
      ];
      const existingPending: PendingAction = {
        actionKey: 'agendamento_criar',
        description: 'Confirmar agendamento às 14h',
        payload: { date: '2026-08-25', time: '14:00' },
      };

      mockCtx.storage.store.set('history', existingHistory);
      mockCtx.storage.store.set('pendingAction', existingPending);

      const newPending: PendingAction = {
        actionKey: 'agendamento_criar',
        description: 'Confirmar agendamento às 15h',
        payload: { date: '2026-08-25', time: '15:00' },
      };

      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Horário ajustado para 15h.',
        pendingAction: newPending,
      });

      const input = {
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'Prefiro às 15h',
        handle: 'handle-token-2',
      };

      const result = await orchestrator.runTurn(input);

      expect(mockRunAgentTurn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          history: existingHistory,
          pendingAction: existingPending,
        }),
      );

      // Verify updated history has 4 messages
      expect(mockCtx.storage.put).toHaveBeenCalledWith('history', [
        ...existingHistory,
        { role: 'user', content: 'Prefiro às 15h' },
        { role: 'assistant', content: 'Horário ajustado para 15h.' },
      ]);
      expect(mockCtx.storage.put).toHaveBeenCalledWith('pendingAction', newPending);
      expect(result.pendingAction).toEqual(newPending);
    });

    it('trims history to the last 20 messages when conversation grows beyond 20 turns', async () => {
      // Create 24 previous messages (12 turns)
      const longHistory: ChatMessage[] = Array.from({ length: 24 }, (_, i) => ({
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `Mensagem ${i + 1}`,
      }));

      mockCtx.storage.store.set('history', longHistory);

      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Resposta ao turno 13',
        pendingAction: undefined,
      });

      const input = {
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'Turno 13 mensagem do usuário',
        handle: 'handle-token-3',
      };

      await orchestrator.runTurn(input);

      // 24 existing + 2 new = 26 total. slice(-20) should yield exactly the last 20 messages.
      const savedHistory = mockCtx.storage.store.get('history');
      expect(savedHistory).toHaveLength(20);
      expect(savedHistory[0]).toEqual(longHistory[6]); // 26 - 20 = index 6
      expect(savedHistory[18]).toEqual({ role: 'user', content: 'Turno 13 mensagem do usuário' });
      expect(savedHistory[19]).toEqual({ role: 'assistant', content: 'Resposta ao turno 13' });
    });
  });
});

describe('ia-agent worker default export fetch handler', () => {
  it('validates agent runtime env and returns 200 with "ia-agent up"', async () => {
    const mockEnv = createMockEnv();
    const req = new Request('http://ia-agent.local/health');

    const res = await worker.fetch(req, mockEnv);

    expect(parseRuntimeEnv).toHaveBeenCalledWith('agent', mockEnv);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('ia-agent up');
  });
});
