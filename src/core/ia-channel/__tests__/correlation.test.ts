import { invokeAgentWithEnv } from '../agent-invoker';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

/**
 * B1 (correlation id) — gate (d), lado invoker: o correlation chega ao
 * payload do issueHandle e ao input do runTurn, e aparece no log de erro.
 */
function makeEnv(calls: Record<string, unknown>, failRunTurn = false) {
  return {
    IA_HANDLE_ISSUER: {
      issueHandle: async (i: unknown) => {
        calls.issue = i;
        return {
          contractVersion: BRIDGE_RPC_VERSION,
          handle: 'H',
          expiresAt: '2026-08-29T12:00:00.000Z',
        };
      },
    },
    AGENT: {
      idFromName: (name: string) => ({ name }),
      get: (_id: unknown) => ({
        runTurn: async (i: unknown) => {
          calls.runTurn = i;
          if (failRunTurn) throw new Error('do-down');
          return { reply: 'oi', turnsUsed: 1 };
        },
      }),
    },
  } as unknown as Parameters<typeof invokeAgentWithEnv>[0];
}

const base = {
  clinicId: 'c1',
  conversationId: 'conv-corr',
  channel: 'chat' as const,
  peerId: 'u1',
  principalRef: 'u1',
  source: 'agent_delegated' as const,
  personaType: 'funcionario' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'oi',
};

describe('invokeAgentWithEnv — correlation id (B1)', () => {
  it('propaga correlationId ao handle e ao runTurn', async () => {
    const calls: Record<string, unknown> = {};
    await invokeAgentWithEnv(makeEnv(calls), { ...base, correlationId: 'req-abc' });
    expect((calls.issue as { correlationId?: string }).correlationId).toBe('req-abc');
    expect((calls.runTurn as { correlationId?: string }).correlationId).toBe('req-abc');
  });

  it('omite correlationId do handle quando ausente (contrato antigo tolera)', async () => {
    const calls: Record<string, unknown> = {};
    await invokeAgentWithEnv(makeEnv(calls), base);
    expect(calls.issue as object).not.toHaveProperty('correlationId');
  });

  it('log de erro contém o correlationId e retorna fallback', async () => {
    const calls: Record<string, unknown> = {};
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await invokeAgentWithEnv(
      makeEnv(calls, true),
      { ...base, correlationId: 'req-fail-1' },
      { timeoutMs: 1000 },
    );
    expect(out.turnsUsed).toBe(0);
    expect(errSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ correlationId: 'req-fail-1' }),
    );
    errSpy.mockRestore();
  });
});
