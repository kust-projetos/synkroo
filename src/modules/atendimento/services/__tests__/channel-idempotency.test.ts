/**
 * Integration leve (A2+A3) no nível das facades do channel-service.
 *
 * Usa o EvolutionApiService REAL (sem mock) + claim in-memory: prova que
 * `sendWhatsApp`/`sendInstagram` com a mesma chave chamam o provider 1 vez,
 * e que o retry de GET (A2) acontece (observação) sem retry de POST de envio.
 */

const outcomes: Array<'claimed' | 'completed' | 'in_progress' | 'retry_after' | 'unknown'> = [];

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(async () => outcomes.shift() ?? 'claimed'),
  markIdempotencyKeyCompleted: jest.fn(async () => undefined),
  markIdempotencyKeyDispatching: jest.fn(async () => true),
  markIdempotencyKeyFailed: jest.fn(async () => undefined),
  markIdempotencyKeyUnknown: jest.fn(async () => undefined),
  isIdempotencyKeyProcessed: jest.fn(async () => false),
  withIdempotency: jest.fn(),
  IdempotencyInfraError: class IdempotencyInfraError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IdempotencyInfraError';
    }
  },
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { sendWhatsApp, sendInstagram } from '../channel-service';
import { buildOutboundIdempotencyKey, OutboundSendConflictError } from '@/lib/http/outbound-idempotency';
import { claimIdempotencyKey, markIdempotencyKeyCompleted, markIdempotencyKeyDispatching, markIdempotencyKeyUnknown } from '@/lib/idempotency';

describe('channel-service outbound idempotency (A3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    outcomes.length = 0;
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    process.env.EVOLUTION_API_KEY = 'evo-key';
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
    delete process.env.INSTAGRAM_ACCOUNT_ID;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sendWhatsApp duplicado (mesma chave) → Evolution chamado 1 vez', async () => {
    outcomes.push('claimed', 'completed');
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-1' } } }),
    });
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-1');

    const first = await sendWhatsApp('11999999999', 'Olá', key);
    expect(first).toEqual({ success: true, messageId: 'evo-1' });

    const dup = await sendWhatsApp('11999999999', 'Olá', key);
    expect(dup).toEqual({ success: true, deduplicated: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sendWhatsApp sem chave mantém envio direto (2 chamadas, claim NUNCA acontece)', async () => {
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-1' } } }),
    });

    await sendWhatsApp('11999999999', 'A');
    await sendWhatsApp('11999999999', 'A');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    // Compatibilidade legada: `runIdempotentSend` sem chave continua direto —
    // a política fail-closed vale para operações COM chave.
    expect(claimIdempotencyKey).not.toHaveBeenCalled();
  });

  it('sendInstagram duplicado (mesma chave) → Graph chamado 1 vez', async () => {
    outcomes.push('claimed', 'completed');
    process.env.INSTAGRAM_ACCOUNT_ID = 'ig-acct-1';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-token';
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message_id: 'ig-mid-1' }),
    });
    const key = buildOutboundIdempotencyKey('instagram', 'clinic-1', 'job-9');

    const first = await sendInstagram('user-1', 'Olá', key);
    expect(first).toEqual({ success: true, messageId: 'ig-mid-1' });

    const dup = await sendInstagram('user-1', 'Olá', key);
    expect(dup).toEqual({ success: true, deduplicated: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falha ambígua da Evolution → SEM fallback sidecar (delivery unknown), Evolution chamada 1x', async () => {
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    const fetchMock = jest.fn(async (url: unknown) => {
      if (String(url).includes('sidecar.example.com')) {
        return { ok: true, status: 200, json: async () => ({ success: true, messageId: 'sc-1' }) };
      }
      return { ok: false, status: 500, json: async () => ({ message: 'evo down' }) };
    });
    (global.fetch as unknown) = fetchMock;
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-fb');

    // E4: HTTP 500 da Evolution pode ser pós-dispatch — ambíguo. NUNCA recorrer
    // ao sidecar (duplicate-send); retorna `unknown` e o sidecar não é tocado.
    const first = await sendWhatsApp('11999999999', 'Olá', key);
    expect(first.success).toBe(false);
    expect(first.delivery).toBe('unknown');
    // Entrega não confirmada nunca vira sucesso e nunca ganha messageId fabricado.
    expect(first.messageId).toBeUndefined();

    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('evolution')).length).toBe(1);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('sidecar')).length).toBe(0);
  });

  // ── E4 / HIGH-1: estado terminal `unknown` ──────────────────────
  // O efeito pode ter ocorrido. A chave NÃO pode voltar a despachar depois do
  // TTL de 600s: o claim é marcado `unknown` (não `failed`) e o replay devolve
  // o próprio estado de entrega desconhecida — nunca sucesso.

  it('entrega não confirmada marca o claim como unknown (não failed)', async () => {
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    const fetchMock = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({ message: 'evo down' }) }));
    (global.fetch as unknown) = fetchMock;
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-unknown-mark');

    const first = await sendWhatsApp('11999999999', 'Olá', key);

    expect(first.success).toBe(false);
    expect(first.delivery).toBe('unknown');
    expect(markIdempotencyKeyUnknown).toHaveBeenCalledWith(key);
  });

  it('replay de claim unknown → provider NÃO é chamado e resultado continua unknown', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { Info: { ID: 'evo-1' } } }) }));
    (global.fetch as unknown) = fetchMock;
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-unknown-replay');
    outcomes.push('unknown');

    const replay = await sendWhatsApp('11999999999', 'Olá', key);

    expect(replay).toEqual({
      success: false,
      delivery: 'unknown',
      error: expect.any(String),
      deduplicated: true,
    });
    expect(replay.messageId).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('concorrência: mesma chave em progresso → OutboundSendConflictError (sem 2º dispatch)', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { Info: { ID: 'evo-1' } } }) }));
    (global.fetch as unknown) = fetchMock;
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-concurrent');

    outcomes.push('claimed', 'in_progress');
    const [first, second] = await Promise.allSettled([
      sendWhatsApp('11999999999', 'Olá', key),
      sendWhatsApp('11999999999', 'Olá', key),
    ]);

    expect(first.status).toBe('fulfilled');
    expect((first as PromiseFulfilledResult<{ success: boolean }>).value.success).toBe(true);
    expect(second.status).toBe('rejected');
    expect((second as PromiseRejectedResult).reason).toBeInstanceOf(OutboundSendConflictError);
    // Um único dispatch sob a chave.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── E4 / HIGH-1: o marco durável `dispatching` é pré-condição do dispatch ──
  // Sem ele, a liquidação best-effort que falhasse deixaria a chave
  // `in_progress` expirável (TTL 600s) e o efeito seria reexecutado.

  it('marco `dispatching` não armado (corrida) → NÃO despacha, conflito', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { Info: { ID: 'evo-1' } } }) }));
    (global.fetch as unknown) = fetchMock;
    (markIdempotencyKeyDispatching as jest.Mock).mockResolvedValueOnce(false);
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-not-armed');

    await expect(sendWhatsApp('11999999999', 'Olá', key)).rejects.toBeInstanceOf(
      OutboundSendConflictError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(markIdempotencyKeyCompleted).not.toHaveBeenCalled();
    expect(markIdempotencyKeyUnknown).not.toHaveBeenCalled();
  });

  it('falha de infra ao armar `dispatching` → falha fechada, provider intacto', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { Info: { ID: 'evo-1' } } }) }));
    (global.fetch as unknown) = fetchMock;
    (markIdempotencyKeyDispatching as jest.Mock).mockRejectedValueOnce(new Error('db offline'));
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-arm-infra');

    await expect(sendWhatsApp('11999999999', 'Olá', key)).rejects.toThrow(
      'Outbound dispatch marker unavailable',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
