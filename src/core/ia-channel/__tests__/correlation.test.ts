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

  it('sempre propaga correlationId resolvido ao handle (integração B1×B2)', async () => {
    // Integração: o invoker SEMPRE envia o id resolvido/validado (B2) — nunca
    // o raw do caller. Sem input, um id válido é gerado (resolveCorrelationId).
    const calls: Record<string, unknown> = {};
    await invokeAgentWithEnv(makeEnv(calls), base);
    const sent = (calls.issue as { correlationId?: unknown }).correlationId;
    expect(typeof sent).toBe('string');
    expect(sent as string).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
  });

  it('nunca propaga raw inválido ao handle (resolve e gera novo)', async () => {
    const calls: Record<string, unknown> = {};
    await invokeAgentWithEnv(makeEnv(calls), { ...base, correlationId: 'cpf-123 <script>' });
    const sent = (calls.issue as { correlationId?: unknown }).correlationId;
    expect(sent).not.toBe('cpf-123 <script>');
    expect(sent as string).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
  });

  it('log de erro contém o correlationId e retorna fallback (integração B1×B2)', async () => {
    // Integração: o catch emite evento estruturado (B2, sem texto de exceção)
    // pelo sink default (JSON via console — status fallback usa console.log).
    // O fallback leva errorCode.
    const calls: Record<string, unknown> = {};
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const out = await invokeAgentWithEnv(
      makeEnv(calls, true),
      { ...base, correlationId: 'req-fail-1' },
      { timeoutMs: 1000 },
    );
    expect(out.turnsUsed).toBe(0);
    expect(out.errorCode).toBe('invoke_failed');
    expect(logSpy).toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('req-fail-1');
    expect(logged).not.toContain('do-down');
    logSpy.mockRestore();
  });
});
