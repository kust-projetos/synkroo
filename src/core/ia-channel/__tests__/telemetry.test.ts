/**
 * B2 — invoker propaga correlation id e registra fallback estruturado sem
 * vazar detalhe interno ao usuário.
 */
import { invokeAgentWithEnv } from '../agent-invoker';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';
import type { TelemetryEvent } from '@/core/ia-agent/telemetry';

const baseInput = {
  clinicId: 'c1',
  conversationId: 'conv-1',
  channel: 'chat' as const,
  peerId: 'u1',
  principalRef: 'u1',
  source: 'agent_delegated' as const,
  personaType: 'funcionario' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'oi',
};

describe('B2 — invoker correlation id', () => {
  it('propaga o correlationId recebido a issueHandle e runTurn', async () => {
    const seen: Record<string, unknown> = {};
    const env = {
      IA_HANDLE_ISSUER: {
        issueHandle: async (i: unknown) => {
          seen.issue = i;
          return {
            contractVersion: BRIDGE_RPC_VERSION,
            handle: 'H',
            expiresAt: '2026-08-29T12:00:00.000Z',
          };
        },
      },
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({
          runTurn: async (i: unknown) => {
            seen.runTurn = i;
            return { reply: 'oi', turnsUsed: 1 };
          },
        }),
      },
    };
    await invokeAgentWithEnv(env as never, {
      ...baseInput,
      correlationId: 'corr-route-1',
    });
    expect(seen.issue).toMatchObject({ correlationId: 'corr-route-1' });
    expect(seen.runTurn).toMatchObject({
      correlationId: 'corr-route-1',
      clinicId: 'c1',
    });
  });

  it('gera correlationId quando o caller não passa', async () => {
    let seen: unknown;
    const env = {
      IA_HANDLE_ISSUER: {
        issueHandle: async () => ({
          contractVersion: BRIDGE_RPC_VERSION,
          handle: 'H',
          expiresAt: '2026-08-29T12:00:00.000Z',
        }),
      },
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({
          runTurn: async (i: unknown) => {
            seen = i;
            return { reply: 'oi', turnsUsed: 1 };
          },
        }),
      },
    };
    await invokeAgentWithEnv(env as never, { ...baseInput });
    expect(typeof (seen as { correlationId?: unknown }).correlationId).toBe(
      'string',
    );
    expect(
      (seen as { correlationId: string }).correlationId.length,
    ).toBeGreaterThan(0);
  });

  it('fallback amigável com errorCode enquanto o log carrega o erro estruturado', async () => {
    const events: TelemetryEvent[] = [];
    const env = {
      IA_HANDLE_ISSUER: {
        issueHandle: async () => ({
          contractVersion: BRIDGE_RPC_VERSION,
          handle: 'H',
          expiresAt: '2026-08-29T12:00:00.000Z',
        }),
      },
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({
          runTurn: async () => {
            throw new Error('DO exploded internally');
          },
        }),
      },
    };
    const out = await invokeAgentWithEnv(
      env as never,
      { ...baseInput, correlationId: 'corr-fail-9' },
      { telemetry: (e) => events.push(e), timeoutMs: 5000 },
    );

    // usuário: fallback amigável, sem detalhe interno
    expect(out.reply).toContain('instabilidade');
    expect(out.reply).not.toContain('exploded');
    expect(out.errorCode).toBe('invoke_failed');
    // log: erro estruturado com correlation — sem texto da exceção, sem detail
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('exploded');
    expect(events[0]).not.toHaveProperty('detail');
    expect(events[0]).toMatchObject({
      correlationId: 'corr-fail-9',
      clinicId: 'c1',
      operation: 'invoke_agent',
      status: 'fallback',
      code: 'invoke_failed',
    });
  });

  it('mismatch de contrato classifica por tipo (contract_version_mismatch)', async () => {
    const events: TelemetryEvent[] = [];
    const env = {
      IA_HANDLE_ISSUER: {
        issueHandle: async () => ({
          ok: false,
          error: 'contract_version_mismatch',
          contractVersion: BRIDGE_RPC_VERSION,
        }),
      },
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({ runTurn: async () => ({ reply: 'x', turnsUsed: 1 }) }),
      },
    };
    const out = await invokeAgentWithEnv(
      env as never,
      { ...baseInput, correlationId: 'corr-mm-1' },
      { telemetry: (e) => events.push(e), timeoutMs: 5000 },
    );
    expect(out.reply).toContain('instabilidade');
    expect(out.errorCode).toBe('contract_version_mismatch');
    expect(events[0]).toMatchObject({
      correlationId: 'corr-mm-1',
      status: 'fallback',
      code: 'contract_version_mismatch',
    });
  });

  it('exceção genérica contendo o texto NÃO classifica como mismatch', async () => {
    const events: TelemetryEvent[] = [];
    const env = {
      IA_HANDLE_ISSUER: {
        issueHandle: async () => ({
          contractVersion: BRIDGE_RPC_VERSION,
          handle: 'H',
          expiresAt: '2026-08-29T12:00:00.000Z',
        }),
      },
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({
          runTurn: async () => {
            throw new Error('external contract version mismatch noise');
          },
        }),
      },
    };
    const out = await invokeAgentWithEnv(
      env as never,
      { ...baseInput, correlationId: 'corr-txt-1' },
      { telemetry: (e) => events.push(e), timeoutMs: 5000 },
    );
    expect(out.errorCode).toBe('invoke_failed');
    expect(events[0]).toMatchObject({ code: 'invoke_failed' });
    expect(JSON.stringify(events)).not.toContain('external contract');
  });
});
