import { runTurn } from '../orchestrator-logic';
import { createZenProvider } from '../provider-zen';
import type { AppBinding, LlmProvider } from '../types';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

/**
 * B1 (correlation id) — gate (d), lado orchestrator/provider: o correlation
 * chega à chamada do provider e aparece no log de erro do orchestrator.
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
  conversationId: 'conv-corr',
  source: 'agent_delegated' as const,
  personaType: 'funcionario' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'oi',
};

describe('runTurn — correlation id (B1)', () => {
  it('repassa correlationId ao provider', async () => {
    let seen: unknown;
    const p: LlmProvider = {
      complete: async (_m, _t, opts) => {
        seen = opts;
        return { text: 'ok', toolCalls: [] };
      },
    };
    await runTurn({ provider: p, app: okApp, now: new Date() }, { ...base, correlationId: 'req-xyz' });
    expect(seen).toEqual({ correlationId: 'req-xyz' });
  });

  it('falha do provider loga com correlationId e propaga (invoker dá fallback)', async () => {
    const p: LlmProvider = {
      complete: async () => {
        throw new Error('provider-down');
      },
    };
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      runTurn({ provider: p, app: okApp, now: new Date() }, { ...base, correlationId: 'req-log-1' }),
    ).rejects.toThrow('provider-down');
    expect(errSpy).toHaveBeenCalledWith(
      '[ia-agent] provider complete failed',
      expect.objectContaining({ correlationId: 'req-log-1' }),
    );
    errSpy.mockRestore();
  });

  it('erro HTTP do provider carrega o correlation', async () => {
    const f = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
    });
    await expect(
      p.complete([{ role: 'user', content: 'oi' }], [], { correlationId: 'req-http-1' }),
    ).rejects.toThrow('[corr=req-http-1]');
  });
});
