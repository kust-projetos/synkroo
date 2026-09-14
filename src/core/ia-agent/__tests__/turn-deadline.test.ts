import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider } from '../types';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

/**
 * B1-review HIGH (deadline real) — gates:
 * (a) provider lento + budget curto → sem iteração adicional;
 * (b) chamada abortada → fallback estruturado, não crash;
 * (c) nenhuma tool executa após o deadline.
 */
const okApp: AppBinding = {
  ping: async () => ({
    ok: true,
    contractVersion: BRIDGE_RPC_VERSION,
    from: 'ia-bridge',
    now: 0,
  }),
  dbHealth: async () => ({ ok: true, contractVersion: BRIDGE_RPC_VERSION }),
  listTools: async () => ({
    ok: true,
    contractVersion: BRIDGE_RPC_VERSION,
    catalog: { version: 'v1', tools: [] },
  }),
  executeAction: async () => ({ ok: true, contractVersion: BRIDGE_RPC_VERSION, data: {} }),
};

const base = {
  handle: 'h',
  conversationId: 'conv-deadline',
  source: 'agent_delegated' as const,
  personaType: 'funcionario' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'oi',
};

function abortError(): Error {
  const e = new DOMException('The operation was aborted.', 'AbortError');
  return e as unknown as Error;
}

describe('runTurn — deadline real do turno (B1-review)', () => {
  it('(a) provider lento + budget curto → 1 chamada, sem nova iteração', async () => {
    let calls = 0;
    const slow: LlmProvider = {
      complete: (_m, _t, opts) =>
        new Promise((resolve, reject) => {
          calls++;
          if (opts?.signal?.aborted) {
            reject(abortError());
            return;
          }
          opts?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
        }),
    };
    const exec = jest.fn();
    const r = await runTurn(
      {
        provider: slow,
        app: { ...okApp, executeAction: exec },
        now: new Date(),
        turnBudgetMs: 80,
        maxIterations: 3,
      },
      base,
    );
    expect(r.reply).toBeTruthy();
    expect(calls).toBe(1);
    expect(exec).not.toHaveBeenCalled();
  });

  it('(b) AbortError do provider → fallback estruturado, sem throw', async () => {
    const p: LlmProvider = {
      complete: async () => {
        throw abortError();
      },
    };
    const r = await runTurn({ provider: p, app: okApp, now: new Date() }, base);
    expect(r.reply).toBeTruthy();
    expect(r.turnsUsed).toBe(1);
  });

  it('(c) budget consumido pela execução da tool → 2ª iteração nunca começa', async () => {
    let now = 0;
    let completes = 0;
    const exec = jest.fn(async () => {
      // a execução consome o restante do budget
      now = 150;
      return {
        ok: true as const,
        contractVersion: BRIDGE_RPC_VERSION,
        data: {},
      };
    });
    const toolCall = {
      text: null as string | null,
      toolCalls: [
        {
          id: 'c1',
          type: 'function' as const,
          function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' },
        },
      ],
    };
    const p: LlmProvider = {
      complete: async () => {
        completes++;
        now = 10;
        return toolCall;
      },
    };
    const r = await runTurn(
      {
        provider: p,
        app: { ...okApp, executeAction: exec },
        now: new Date(),
        turnBudgetMs: 100,
        nowMs: () => now,
        maxIterations: 3,
      },
      base,
    );
    // primeira iteração executou a tool dentro do budget; a segunda nunca começou
    expect(exec).toHaveBeenCalledTimes(1);
    expect(completes).toBe(1);
    expect(r.reply).toBeTruthy();
  });

  it('budget zerado → provider nunca chamado', async () => {
    const complete = jest.fn(async () => ({ text: 'x', toolCalls: [] }));
    const exec = jest.fn();
    const r = await runTurn(
      {
        provider: { complete },
        app: { ...okApp, executeAction: exec },
        now: new Date(),
        turnBudgetMs: 0,
      },
      base,
    );
    expect(complete).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(r.turnsUsed).toBe(0);
    expect(r.reply).toBeTruthy();
  });

  it('B1-review HIGH (a): budget estoura APÓS o complete → tool não executa, fallback', async () => {
    let now = 0;
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    const toolCall = {
      text: null as string | null,
      toolCalls: [
        {
          id: 'c1',
          type: 'function' as const,
          function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' },
        },
      ],
    };
    const p: LlmProvider = {
      complete: async () => {
        // resposta chega, mas o budget estourou durante a chamada
        now = 200;
        return toolCall;
      },
    };
    const r = await runTurn(
      {
        provider: p,
        app: { ...okApp, executeAction: exec },
        now: new Date(),
        turnBudgetMs: 100,
        nowMs: () => now,
        maxIterations: 3,
      },
      base,
    );
    expect(exec).not.toHaveBeenCalled();
    expect(r.reply).toBeTruthy();
    expect(r.turnsUsed).toBe(1);
  });

  it('B1-review: confirm com clock além do deadline → 0 exec, pending preservada, fallback', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    let stored = { alias: 'x', args: {}, token: 'tok-1', principalId: 'user-A' } as
      | { alias: string; args: unknown; token: string; principalId: string }
      | undefined;
    const peekPendingAction = async () => stored;
    const consumePendingAction = async () => {
      const taken = stored;
      stored = undefined;
      return taken;
    };
    const r = await runTurn(
      {
        provider: { complete: async () => ({ text: 'n/a', toolCalls: [] }) },
        app: { ...okApp, executeAction: exec },
        now: new Date(),
        turnBudgetMs: 0,
        peekPendingAction,
        consumePendingAction,
      },
      { ...base, confirmedToken: 'tok-1', principalId: 'user-A' },
    );
    expect(exec).not.toHaveBeenCalled();
    expect(stored).toBeDefined();
    expect(await peekPendingAction()).toBeDefined();
    expect(r.turnsUsed).toBe(0);
    expect(r.reply).toBeTruthy();
    expect(r.pendingActionWrite).toBe('keep');
  });
});
