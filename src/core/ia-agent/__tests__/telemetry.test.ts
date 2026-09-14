/**
 * B2 — telemetria mínima: métrica de provider call + erro estruturado com
 * correlation id, com reply amigável preservada ao usuário.
 */
import { createZenProvider } from '../provider-zen';
import { runTurn } from '../orchestrator-logic';
import type {
  AppBinding,
  LlmCallMetric,
  LlmTool,
} from '../types';
import type { TelemetryEvent, TelemetrySink } from '../telemetry';
import {
  isValidCorrelationId,
  resolveCorrelationId,
} from '../telemetry';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

const tool: LlmTool = {
  type: 'function',
  function: {
    name: 'operacional__consultarDisponibilidade',
    description: 'x',
    parameters: { type: 'object', properties: {} },
  },
};

function okFetch(body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
}

function okApp(overrides: Partial<AppBinding> = {}): AppBinding {
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
    executeAction: async () => ({
      ok: true,
      contractVersion: BRIDGE_RPC_VERSION,
      data: {},
    }),
    ...overrides,
  };
}

const base = {
  handle: 'h',
  conversationId: 'conv-1',
  source: 'system' as const,
  personaType: 'recepcao' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'oi',
  correlationId: 'corr-123',
  clinicId: 'clinic-9',
};

function sinkTo(arr: TelemetryEvent[]): TelemetrySink {
  return (e) => {
    arr.push(e);
  };
}

describe('B2 — provider call registra latência + usage + retry', () => {
  it('emite métrica por tentativa com attempt, usage e correlationId', async () => {
    const metrics: LlmCallMetric[] = [];
    const fetch429thenOk = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: {
              prompt_tokens: 12,
              completion_tokens: 3,
              total_tokens: 15,
            },
          }),
      });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: fetch429thenOk as unknown as typeof fetch,
      onMetric: (m) => metrics.push(m),
    });

    const out = await p.complete([{ role: 'user', content: 'oi' }], [], {
      correlationId: 'corr-123',
    });

    expect(out.text).toBe('ok');
    expect(out.usage).toEqual({
      promptTokens: 12,
      completionTokens: 3,
      totalTokens: 15,
    });
    expect(metrics).toHaveLength(2);
    // tentativa 1: falha 429 (classe http_4xx, sem texto do body)
    expect(metrics[0]).toMatchObject({
      success: false,
      attempt: 1,
      errorCode: 'http_4xx',
      correlationId: 'corr-123',
    });
    expect(metrics[0].latencyMs).toBeGreaterThanOrEqual(0);
    // tentativa 2 (retry): sucesso com usage
    expect(metrics[1]).toMatchObject({
      success: true,
      attempt: 2,
      correlationId: 'corr-123',
      usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 },
    });
    expect(metrics[1].latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('B2 — métrica por tipo/status, sem sniffing de texto', () => {
  it('fetch lançando Error com texto "HTTP 429" registra métrica da tentativa', async () => {
    const metrics: LlmCallMetric[] = [];
    const throwing = jest.fn().mockRejectedValue(new Error('HTTP 429 fake (texto, sem resposta)'));
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: throwing as unknown as typeof fetch,
      onMetric: (m) => metrics.push(m),
    });

    await expect(
      p.complete([{ role: 'user', content: 'oi' }], [], { correlationId: 'c' }),
    ).rejects.toThrow();
    // erro genérico (não é resposta real): métrica registrada, sem retry
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      success: false,
      attempt: 1,
      errorCode: 'provider_error',
      correlationId: 'c',
    });
  });

  it('corpo não-JSON vira http_unparseable sem vazar o body', async () => {
    const metrics: LlmCallMetric[] = [];
    const f = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'não-json { segredo: CORPO-SECRETO-XYZ }',
    });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
      onMetric: (m) => metrics.push(m),
    });

    await expect(p.complete([{ role: 'user', content: 'oi' }], [])).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1); // sem retry de corpo ilegível
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      success: false,
      attempt: 1,
      errorCode: 'http_unparseable',
    });
    expect(JSON.stringify(metrics)).not.toContain('CORPO-SECRETO-XYZ');
  });
});

describe('B2 — resolveCorrelationId valida formato fechado', () => {
  it('aceita id válido e gera para PII/blob/ausente', () => {
    expect(isValidCorrelationId('req-abc_123')).toBe(true);
    expect(isValidCorrelationId('cpf-123.456.789-00')).toBe(false);
    expect(isValidCorrelationId('x'.repeat(1024))).toBe(false);
    expect(isValidCorrelationId('')).toBe(false);
    expect(isValidCorrelationId(undefined)).toBe(false);
    expect(resolveCorrelationId('req-abc_123')).toBe('req-abc_123');
    const gen = resolveCorrelationId('PII:' + 'x'.repeat(1024));
    expect(gen).not.toContain('PII');
    expect(isValidCorrelationId(gen)).toBe(true);
    expect(isValidCorrelationId(resolveCorrelationId(undefined))).toBe(true);
  });
});

describe('B2 — redaction: evento execute_action não carrega payload', () => {
  it('log contém só code/descritor estático — sem input/args/handle', async () => {
    const events: TelemetryEvent[] = [];
    const token = 'tok-1';
    const r = await runTurn(
      {
        provider: { complete: async () => ({ text: 'x', toolCalls: [] }) },
        app: okApp({
          executeAction: async () => ({
            ok: false as const,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'forbidden',
            level: 'proibido',
            message: 'Sem permissão para TOPSECRET-ARGS.',
          }),
        }),
        now: new Date(),
        telemetry: sinkTo(events),
      },
      {
        ...base,
        handle: 'h-handle-SEGREDO-123',
        pendingAction: {
          alias: 'a',
          args: { segredo: 'TOPSECRET-ARGS' },
          token,
        },
        confirmedToken: token,
      },
    );

    expect(r.errorCode).toBe('forbidden');
    const dumped = JSON.stringify(events);
    expect(dumped).not.toContain('TOPSECRET-ARGS');
    expect(dumped).not.toContain('h-handle-SEGREDO-123');
    expect(dumped).not.toContain('Sem permissão');
    const ev = events.find((e) => e.operation === 'execute_action');
    expect(ev).not.toHaveProperty('detail');
    expect(ev).not.toHaveProperty('input');
    expect(ev).not.toHaveProperty('args');
    expect(ev).not.toHaveProperty('handle');
    expect(ev).toMatchObject({ code: 'forbidden', status: 'error' });
  });
});

describe('B2 — erro do orchestrator loga com correlationId e código estruturado', () => {
  it('provider throw vira fallback amigável com errorCode + evento provider_call', async () => {
    const events: TelemetryEvent[] = [];
    const err = Object.assign(new Error('boom'), { code: 'timeout' });
    const r = await runTurn(
      {
        provider: {
          complete: async () => {
            throw err;
          },
        },
        app: okApp(),
        now: new Date(),
        telemetry: sinkTo(events),
      },
      base,
    );

    // usuário recebe fallback amigável (sem código interno vazado)
    expect(r.reply).toBe('Só um momento — vou verificar e já te retorno.');
    expect(r.errorCode).toBe('timeout');
    // texto da exceção ('boom') jamais chega ao log; sem campo detail
    expect(JSON.stringify(events)).not.toContain('boom');
    const ev = events.find((e) => e.operation === 'provider_call');
    expect(ev).not.toHaveProperty('detail');
    expect(ev).toMatchObject({
      correlationId: 'corr-123',
      clinicId: 'clinic-9',
      status: 'error',
      code: 'timeout',
    });
    expect(ev?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('execute_action negado no confirm loga código e mantém reply amigável', async () => {
    const events: TelemetryEvent[] = [];
    const token = 'tok-1';
    const r = await runTurn(
      {
        provider: { complete: async () => ({ text: 'x', toolCalls: [] }) },
        app: okApp({
          executeAction: async () => ({
            ok: false as const,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'forbidden',
            level: 'proibido',
            message: 'Sem permissão.',
          }),
        }),
        now: new Date(),
        telemetry: sinkTo(events),
      },
      {
        ...base,
        pendingAction: { alias: 'a', args: {}, token },
        confirmedToken: token,
      },
    );

    expect(r.reply).not.toContain('forbidden');
    expect(r.errorCode).toBe('forbidden');
    const ev = events.find((e) => e.operation === 'execute_action');
    expect(ev).toMatchObject({
      correlationId: 'corr-123',
      status: 'error',
      code: 'forbidden',
    });
  });
});
