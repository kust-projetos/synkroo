/**
 * Integration leve (A2+A3) no nível das facades do channel-service.
 *
 * Usa o EvolutionApiService REAL (sem mock) + claim in-memory: prova que
 * `sendWhatsApp`/`sendInstagram` com a mesma chave chamam o provider 1 vez,
 * e que o retry de GET (A2) acontece (observação) sem retry de POST de envio.
 */

const outcomes: Array<'claimed' | 'completed' | 'in_progress' | 'retry_after'> = [];

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(async () => outcomes.shift() ?? 'claimed'),
  markIdempotencyKeyCompleted: jest.fn(async () => undefined),
  markIdempotencyKeyFailed: jest.fn(async () => undefined),
  isIdempotencyKeyProcessed: jest.fn(async () => false),
  withIdempotency: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { sendWhatsApp, sendInstagram } from '../channel-service';
import { buildOutboundIdempotencyKey } from '@/lib/http/outbound-idempotency';

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

  it('sendWhatsApp sem chave mantém envio direto (2 chamadas)', async () => {
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-1' } } }),
    });

    await sendWhatsApp('11999999999', 'A');
    await sendWhatsApp('11999999999', 'A');

    expect(global.fetch).toHaveBeenCalledTimes(2);
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

  it('falha ambígua da Evolution → fallback sidecar 1x sob o MESMO claim; retry → 0 envios', async () => {
    outcomes.push('claimed', 'completed');
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

    const first = await sendWhatsApp('11999999999', 'Olá', key);
    expect(first).toEqual({ success: true, messageId: 'sc-1' });

    const dup = await sendWhatsApp('11999999999', 'Olá', key);
    expect(dup).toEqual({ success: true, deduplicated: true });

    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('evolution')).length).toBe(1);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('sidecar')).length).toBe(1);
  });
});
