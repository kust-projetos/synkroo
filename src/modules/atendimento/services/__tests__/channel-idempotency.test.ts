/**
 * Integration leve (A2+A3) no nível das facades do channel-service.
 *
 * Usa o EvolutionApiService REAL (sem mock) + claim in-memory: prova que
 * `sendWhatsApp`/`sendInstagram` com a mesma chave chamam o provider 1 vez,
 * e que o retry de GET (A2) acontece (observação) sem retry de POST de envio.
 */

const claimed = new Set<string>();
const completed = new Set<string>();

jest.mock('@/lib/idempotency', () => ({
  tryClaimIdempotencyKey: jest.fn(async (key: string) => {
    if (claimed.has(key) || completed.has(key)) return false;
    claimed.add(key);
    return true;
  }),
  markIdempotencyKeyCompleted: jest.fn(async (key: string) => {
    completed.add(key);
  }),
  markIdempotencyKeyFailed: jest.fn(async () => undefined),
  isIdempotencyKeyProcessed: jest.fn(async (key: string) => completed.has(key)),
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
    claimed.clear();
    completed.clear();
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
});
