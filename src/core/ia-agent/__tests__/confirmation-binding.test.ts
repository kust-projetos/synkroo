import { runTurn, safeTokenEquals } from '../orchestrator-logic';
import type { AppBinding, LlmProvider } from '../types';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

/**
 * B1 (tokens) — prova estrutural: tokens crus vindos do body NÃO autorizam
 * execução por si sós. A execução confirmada só acontece quando o token
 * casa com o pendingAction que o DO injeta do próprio storage (o caller não
 * pode injetar pendingAction — a assinatura do DO omite esses campos).
 */
function app(execSpy: jest.Mock): AppBinding {
  return {
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
    executeAction: execSpy,
  };
}

const textProvider: LlmProvider = {
  complete: async () => ({ text: 'ok', toolCalls: [] }),
};

const base = {
  handle: 'h',
  conversationId: 'conv-atk',
  source: 'agent_delegated' as const,
  personaType: 'funcionario' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'sim, confirmo',
};

describe('runTurn — tokens do body não autorizam execução (B1)', () => {
  it('confirmedToken cru sem pendingAction do DO → nenhuma execução confirmada', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    const r = await runTurn(
      { provider: textProvider, app: app(exec), now: new Date() },
      { ...base, confirmedToken: 'tok-atacante', identityVerifiedToken: 'tok-atacante' },
    );
    expect(r.reply).toBe('ok');
    expect(r.pendingAction).toBeUndefined();
    // nada executado — muito menos com flags de confirmação
    expect(exec).not.toHaveBeenCalled();
  });

  it('confirmedToken divergente do pendingAction do DO → nenhuma execução confirmada', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    const r = await runTurn(
      { provider: textProvider, app: app(exec), now: new Date() },
      {
        ...base,
        pendingAction: { alias: 'x', args: {}, token: 'tok-servidor', principalId: 'user-A' },
        confirmedToken: 'tok-atacante',
        principalId: 'user-A',
      },
    );
    expect(r.reply).toBe('ok');
    expect(exec).not.toHaveBeenCalled();
  });

  it('B1-review (4b): principal B não confirma action criada para principal A', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    const r = await runTurn(
      { provider: textProvider, app: app(exec), now: new Date() },
      {
        ...base,
        pendingAction: { alias: 'x', args: {}, token: 'tok-servidor', principalId: 'user-A' },
        confirmedToken: 'tok-servidor',
        principalId: 'user-B',
      },
    );
    expect(r.reply).toBe('ok');
    expect(exec).not.toHaveBeenCalled();
  });

  it('B1-review: pending legada sem principalId → recusa fail-closed', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    const r = await runTurn(
      { provider: textProvider, app: app(exec), now: new Date() },
      {
        ...base,
        pendingAction: { alias: 'x', args: {}, token: 'tok-servidor' },
        confirmedToken: 'tok-servidor',
        principalId: 'user-A',
      },
    );
    expect(exec).not.toHaveBeenCalled();
    expect(r.reply).toBe('ok');
  });

  it('B1-review (4c): segunda confirmação do mesmo token → recusada (at-most-once)', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    // Simula o DO storage: peek lê sem destruir, consume lê+apaga.
    let stored = { alias: 'x', args: {}, token: 'tok-1', principalId: 'user-A' } as
      | { alias: string; args: unknown; token: string; principalId: string }
      | undefined;
    const peekPendingAction = async () => stored;
    const consumePendingAction = async () => {
      const taken = stored;
      stored = undefined;
      return taken;
    };
    const deps = { provider: textProvider, app: app(exec), now: new Date(), peekPendingAction, consumePendingAction };
    const turnInput = {
      ...base,
      confirmedToken: 'tok-1',
      principalId: 'user-A',
    };
    const first = await runTurn(deps, turnInput);
    expect(first.reply).toContain('confirmado');
    expect(exec).toHaveBeenCalledTimes(1);
    const second = await runTurn(deps, turnInput);
    expect(second.reply).toBe('ok');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('B1-review item 3: mensagem normal NÃO consome a pending; confirmação posterior funciona', async () => {
    const exec = jest.fn(async () => ({
      ok: true as const,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }));
    let stored = { alias: 'x', args: {}, token: 'tok-1', principalId: 'user-A' } as
      | { alias: string; args: unknown; token: string; principalId: string }
      | undefined;
    const deps = {
      provider: textProvider,
      app: app(exec),
      now: new Date(),
      peekPendingAction: async () => stored,
      consumePendingAction: async () => {
        const taken = stored;
        stored = undefined;
        return taken;
      },
    };
    // turno intermediário: mensagem normal, sem token
    const middle = await runTurn(deps, { ...base, userMessage: 'só uma dúvida' });
    expect(middle.reply).toBe('ok');
    expect(exec).not.toHaveBeenCalled();
    expect(stored).toBeDefined();
    // confirmação posterior: ainda funciona
    const confirm = await runTurn(deps, { ...base, confirmedToken: 'tok-1', principalId: 'user-A' });
    expect(confirm.reply).toContain('confirmado');
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('safeTokenEquals (B1, timing-safe)', () => {
  it('iguais → true; diferentes e vazios → false', async () => {
    expect(await safeTokenEquals('tok-1', 'tok-1')).toBe(true);
    expect(await safeTokenEquals('tok-1', 'tok-2')).toBe(false);
    expect(await safeTokenEquals('', 'tok-1')).toBe(false);
    expect(await safeTokenEquals('tok-1', '')).toBe(false);
    expect(await safeTokenEquals('curto', 'bem-mais-longo-que-curto')).toBe(false);
  });
});
