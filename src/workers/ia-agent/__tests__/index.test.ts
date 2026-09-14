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
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

// ── Helpers ──────────────────────────────────────────────────────

function createMockStorage() {
  const store = new Map<string, any>();
  const get = jest.fn(async (key: string) => store.get(key) ?? null);
  const put = jest.fn(async (key: string, val: any) => {
    store.set(key, val);
  });
  const del = jest.fn(async (key: string) => {
    store.delete(key);
  });
  return {
    store,
    get,
    put,
    delete: del,
    // Transação serializada por shard: o closure recebe um txn ligado ao
    // mesmo Map (suficiente para o teste unitário da reserva atômica).
    transaction: jest.fn(async (fn: (txn: unknown) => Promise<unknown>) =>
      fn({ get, put, delete: del }),
    ),
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
    ping: jest.fn().mockResolvedValue({
      ok: true,
      contractVersion: BRIDGE_RPC_VERSION,
      from: 'ia-bridge',
      now: 0,
    }),
    dbHealth: jest.fn().mockResolvedValue({
      ok: true,
      contractVersion: BRIDGE_RPC_VERSION,
    }),
    listTools: jest.fn(),
    executeAction: jest.fn(),
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

      // Verify storage loading (history eager; pending via reserva atômica)
      expect(mockCtx.storage.get).toHaveBeenCalledWith('history');
      expect(mockCtx.storage.get).not.toHaveBeenCalledWith('pendingAction');

      // Verify provider instantiation (B2: onMetric correlaciona provider_call)
      expect(mockCreateZenProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-zen-test-key-123',
          model: 'zen/gpt-4o-mini',
          baseUrl: 'https://llm.opencode.test/v1',
          onMetric: expect.any(Function),
        }),
      );

      // Verify orchestrator execution: pending via peek + consume (B1, não
      // eager) e correlationId validado/injetado no input (B2).
      expect(mockRunAgentTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.any(Object),
          app: mockEnv.APP,
          now: expect.any(Date),
          peekPendingAction: expect.any(Function),
          consumePendingAction: expect.any(Function),
        }),
        expect.objectContaining({
          ...input,
          history: [],
          // B1: pending NÃO é passada eager — o orchestrator consome via
          // callback a partir do storage do DO.
          correlationId: expect.stringMatching(/^[A-Za-z0-9_-]{1,128}$/),
        }),

      // Verify storage persistence (history sim; pending keep → NÃO escreve)
      expect(mockCtx.storage.put).toHaveBeenCalledWith('history', [
        { role: 'user', content: 'Gostaria de agendar para amanhã' },
        { role: 'assistant', content: 'Posso agendar sua consulta.' },
      ]);
      expect(mockCtx.storage.put).not.toHaveBeenCalledWith(
        'pendingAction',
        expect.anything(),
      );

      // Verify returned result
      expect(result).toEqual({
        reply: 'Posso agendar sua consulta.',
        pendingAction: undefined,
      });
    });

    it('loads existing history from storage and persists updated state', async () => {
      const existingHistory: ChatMessage[] = [
        { role: 'user', content: 'Olá' },
        { role: 'assistant', content: 'Olá! Como posso ajudar?' },
      ];

      mockCtx.storage.store.set('history', existingHistory);

      const newPending: PendingAction = {
        alias: 'operacional__agendarConsulta',
        args: { date: '2026-08-25', time: '15:00' },
        token: 'tok-2',
        principalId: 'user-A',
      };

      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Horário ajustado para 15h.',
        pendingAction: newPending,
        pendingActionWrite: 'set',
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
        }),
      );
      // pending NÃO é mais passada eager — o orchestrator consome via callback
      expect(mockRunAgentTurn).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ pendingAction: expect.anything() }),
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

    it("B1-review item 3: turno normal com pending existente → pending intacta (keep não escreve)", async () => {
      const existing = {
        alias: 'operacional__agendarConsulta',
        args: { date: '2026-08-25' },
        token: 'tok-keep',
        principalId: 'user-A',
      };
      mockCtx.storage.store.set('pendingAction', existing);
      mockRunAgentTurn.mockResolvedValueOnce({ reply: 'ok' });

      await orchestrator.runTurn({
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'só uma dúvida',
        handle: 'handle-token-keep',
      });

      expect(mockCtx.storage.put).not.toHaveBeenCalledWith(
        'pendingAction',
        expect.anything(),
      );
      expect(mockCtx.storage.store.get('pendingAction')).toEqual(existing);
    });

    it('B1-review item 3: confirm inválido → pending intacta; confirm válido → null', async () => {
      const existing = {
        alias: 'operacional__agendarConsulta',
        args: { date: '2026-08-25' },
        token: 'tok-x',
        principalId: 'user-A',
      };
      mockCtx.storage.store.set('pendingAction', existing);

      // confirm inválido (sem clear) → não escreve
      mockRunAgentTurn.mockResolvedValueOnce({ reply: 'não entendi' });
      await orchestrator.runTurn({
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'sim?',
        handle: 'handle-token-bad',
      });
      expect(mockCtx.storage.put).not.toHaveBeenCalledWith(
        'pendingAction',
        expect.anything(),
      );
      expect(mockCtx.storage.store.get('pendingAction')).toEqual(existing);

      // confirm válido (consumiu tok-x) → clear grava null
      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Pronto, confirmado e executado.',
        pendingActionWrite: 'clear',
        clearedToken: 'tok-x',
      });
      await orchestrator.runTurn({
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'sim, confirmo',
        handle: 'handle-token-ok',
      });
      expect(mockCtx.storage.put).toHaveBeenCalledWith('pendingAction', null);
    });

    it('consumePendingAction condicional: reserva quando casa, mismatch sem deletar', async () => {
      mockRunAgentTurn.mockResolvedValueOnce({ reply: 'ok' });

      await orchestrator.runTurn({
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'sim, confirmo',
        handle: 'handle-token-9',
      });

      // O turno acima não escreve pending (keep); simula a pending gravada
      // por um turno anterior.
      mockCtx.storage.store.set('pendingAction', {
        alias: 'operacional__agendarConsulta',
        args: { date: '2026-08-25' },
        token: 'tok-reserva',
        principalId: 'user-A',
      });

      const deps = mockRunAgentTurn.mock.calls.at(-1)?.[0] as {
        consumePendingAction: (expected: unknown) => Promise<{
          reserved: unknown;
          mismatch: boolean;
        }>;
      };
      expect(typeof deps.consumePendingAction).toBe('function');

      // (a) HIGH: pending trocada entre peek e consume → NÃO deleta, mismatch
      const stale = await deps.consumePendingAction({ token: 'tok-antiga', principalId: 'user-A' });
      expect(stale).toEqual({ reserved: undefined, mismatch: true });
      expect(mockCtx.storage.store.get('pendingAction')).toEqual(
        expect.objectContaining({ token: 'tok-reserva' }),
      );

      // reserva com a chave certa → entrega e apaga
      const first = await deps.consumePendingAction({ token: 'tok-reserva', principalId: 'user-A' });
      expect(first.mismatch).toBe(false);
      expect(first.reserved).toEqual(expect.objectContaining({ token: 'tok-reserva' }));

      // segunda tomada → ausente (não mismatch), sem segunda execução
      const second = await deps.consumePendingAction({ token: 'tok-reserva', principalId: 'user-A' });
      expect(second).toEqual({ reserved: undefined, mismatch: false });
      expect(mockCtx.storage.store.get('pendingAction')).toBeUndefined();
    });

    it('B1-review HIGH (b): clear NÃO apaga pending nova criada durante o executeAction', async () => {
      // Turno retorna clear da pending que reservou (tok-old)...
      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Pronto, confirmado e executado.',
        pendingActionWrite: 'clear',
        clearedToken: 'tok-old',
      });
      // ...mas durante o await uma pending NOVA foi criada pelo turno intercalado.
      mockCtx.storage.store.set('pendingAction', {
        alias: 'operacional__consultarDisponibilidade',
        args: {},
        token: 'tok-new',
        principalId: 'user-A',
      });

      await orchestrator.runTurn({
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'sim, confirmo',
        handle: 'handle-token-10',
      });

      expect(mockCtx.storage.put).not.toHaveBeenCalledWith('pendingAction', null);
      expect(mockCtx.storage.store.get('pendingAction')).toEqual(
        expect.objectContaining({ token: 'tok-new' }),
      );
    });

    it('B1-review HIGH (c): clear com a mesma pending ainda lá → apaga', async () => {
      mockCtx.storage.store.set('pendingAction', {
        alias: 'x',
        args: {},
        token: 'tok-old',
        principalId: 'user-A',
      });
      mockRunAgentTurn.mockResolvedValueOnce({
        reply: 'Pronto, confirmado e executado.',
        pendingActionWrite: 'clear',
        clearedToken: 'tok-old',
      });

      await orchestrator.runTurn({
        clinicId: 'clinic-1',
        conversationId: 'conv-100',
        userMessage: 'sim, confirmo',
        handle: 'handle-token-11',
      });

      expect(mockCtx.storage.put).toHaveBeenCalledWith('pendingAction', null);
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
