/**
 * Unit test: `channel-service` reaches providers through the provider registry
 * (vNext P3.1) — never through a direct `evolution-service` import.
 *
 * WAHA-only (owner decision, commit 3863c4f): WAHA is the default outbound
 * channel — the facade resolves `'waha'` first and only uses the deprecated
 * Evolution adapter as a legacy fallback. Provider detection, fallback order,
 * result contracts and facade-owned idempotency keep their legacy shape; only
 * the seam and the WAHA-first order changed.
 */

jest.mock('../../integrations/whatsapp-provider-registry', () => ({
  getWhatsAppProviderAdapter: jest.fn(),
}));

// Claim in-memory: prova que os fallbacks sem adapter passam pelo claim único.
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
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { sendWhatsAppMessage, sendWhatsApp } from '../channel-service';
import { getWhatsAppProviderAdapter } from '../../integrations/whatsapp-provider-registry';
import { buildOutboundIdempotencyKey } from '@/lib/http/outbound-idempotency';

const mockGetAdapter = getWhatsAppProviderAdapter as jest.MockedFunction<typeof getWhatsAppProviderAdapter>;

function availableAdapter(id: 'waha' | 'evolution', sendTextMessage: jest.Mock) {
  return { id, isAvailable: () => true, sendTextMessage };
}

function unavailableAdapter(id: 'waha' | 'evolution') {
  return { id, isAvailable: () => false, sendTextMessage: jest.fn() };
}

describe('channel-service provider seam (P3.1, WAHA-only)', () => {
  const originalEnv = process.env;

  // Per-provider registrations behind the mocked registry seam. WAHA defaults
  // to unwired so legacy Evolution tests exercise the legacy path exactly.
  let wahaAdapter: unknown;
  let evolutionAdapter: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    outcomes.length = 0;
    process.env = { ...originalEnv };
    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    process.env.EVOLUTION_API_KEY = 'evo-key';
    delete process.env.WAHA_API_URL;
    delete process.env.WAHA_API_KEY;
    delete process.env.WAHA_SESSION;
    delete process.env.WHATSAPP_API_URL;
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
    wahaAdapter = null;
    evolutionAdapter = null;
    mockGetAdapter.mockImplementation(((id: string) =>
      id === 'waha' ? wahaAdapter : evolutionAdapter) as never);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sendWhatsAppMessage resolves the WAHA adapter when WAHA is configured', async () => {
    process.env.WAHA_API_URL = 'https://waha.example.com';
    process.env.WAHA_API_KEY = 'waha-key';
    const wahaSend = jest.fn().mockResolvedValue({ success: true, messageId: 'waha-1' });
    const evolutionSend = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-1' });
    wahaAdapter = availableAdapter('waha', wahaSend);
    evolutionAdapter = availableAdapter('evolution', evolutionSend);

    const res = await sendWhatsAppMessage('5511999999999', 'Olá');

    expect(mockGetAdapter).toHaveBeenCalledWith('waha');
    expect(wahaSend).toHaveBeenCalledWith('5511999999999', 'Olá');
    expect(evolutionSend).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, messageId: 'waha-1' });
  });

  it('sendWhatsAppMessage does NOT fall back when the WAHA send is ambiguous (delivery unknown)', async () => {
    process.env.WAHA_API_URL = 'https://waha.example.com';
    process.env.WAHA_API_KEY = 'waha-key';
    // Falha ambígua pós-dispatch (a WAHA emite WahaProviderError com delivery
    // 'unknown' em timeout/http_error) marcada aqui como um throw sem
    // `not_attempted`: o sidecar NÃO é chamado.
    wahaAdapter = availableAdapter(
      'waha',
      jest.fn().mockRejectedValue(Object.assign(new Error('waha: sendText failed'), { delivery: 'unknown', code: 'http_error', status: 502 })),
    );
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    global.fetch = jest.fn() as never;

    const res = await sendWhatsAppMessage('5511999999999', 'Olá');

    expect(res).toEqual({ success: false, delivery: 'unknown', error: 'waha: sendText failed' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sendWhatsAppMessage falls back to the sidecar on a WAHA deterministic pre-dispatch failure (not_attempted)', async () => {
    process.env.WAHA_API_URL = 'https://waha.example.com';
    process.env.WAHA_API_KEY = 'waha-key';
    // `not_attempted` = rejeitado antes de qualquer requisição (destino/texto
    // inválido): nada foi enviado, então o sidecar é seguro.
    wahaAdapter = availableAdapter(
      'waha',
      jest.fn().mockRejectedValue(Object.assign(new Error('waha: sendText requires a non-empty text'), { code: 'invalid_text', delivery: 'not_attempted' })),
    );
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, messageId: 'sc-1' }),
    } as Response) as never;

    await expect(sendWhatsAppMessage('5511999999999', 'Olá')).resolves.toEqual({
      success: true,
      messageId: 'sc-1',
    });
  });

  it('sendWhatsAppMessage resolves the legacy Evolution adapter when WAHA is not wired', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-1' });
    evolutionAdapter = availableAdapter('evolution', sendTextMessage);

    const res = await sendWhatsAppMessage('5511999999999', 'Olá');

    expect(mockGetAdapter).toHaveBeenCalledWith('evolution');
    expect(sendTextMessage).toHaveBeenCalledWith('5511999999999', 'Olá');
    expect(res).toEqual({ success: true, messageId: 'evo-1' });
  });

  it('sendWhatsAppMessage does NOT fall back when the legacy adapter send is ambiguous (delivery unknown)', async () => {
    evolutionAdapter = availableAdapter(
      'evolution',
      jest.fn().mockResolvedValue({ success: false, error: 'HTTP 500' }),
    );
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    global.fetch = jest.fn() as never;

    // E4: success:false da Evolution pode ser pós-dispatch — ambíguo, sem fallback.
    await expect(sendWhatsAppMessage('5511999999999', 'Olá')).resolves.toEqual({
      success: false,
      delivery: 'unknown',
      error: 'HTTP 500',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sendWhatsAppMessage keeps the fail-closed error when no adapter is registered', async () => {
    const res = await sendWhatsAppMessage('5511999999999', 'Olá');

    expect(res).toEqual({ success: false, error: 'No WhatsApp provider available' });
  });

  it('sendWhatsAppMessage treats an unavailable adapter as no provider', async () => {
    evolutionAdapter = unavailableAdapter('evolution');

    const res = await sendWhatsAppMessage('5511999999999', 'Olá');

    expect(res).toEqual({ success: false, error: 'No WhatsApp provider available' });
  });

  it('sendWhatsAppMessage sem adapter WAHA + fallback: mesma chave 2x → sidecar 1x', async () => {
    process.env.WAHA_API_URL = 'https://waha.example.com';
    process.env.WAHA_API_KEY = 'waha-key';
    wahaAdapter = null;
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    outcomes.push('claimed', 'completed');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, messageId: 'sc-1' }),
    } as Response) as never;
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-waha-null');

    const first = await sendWhatsAppMessage('5511999999999', 'Olá', key);
    expect(first).toEqual({ success: true, messageId: 'sc-1' });

    const dup = await sendWhatsAppMessage('5511999999999', 'Olá', key);
    expect(dup).toEqual({ success: true, deduplicated: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sendWhatsAppMessage sem adapter Evolution + fallback: mesma chave 2x → sidecar 1x', async () => {
    evolutionAdapter = null;
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    outcomes.push('claimed', 'completed');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, messageId: 'sc-2' }),
    } as Response) as never;
    const key = buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'job-evo-null');

    const first = await sendWhatsAppMessage('5511999999999', 'Olá', key);
    expect(first).toEqual({ success: true, messageId: 'sc-2' });

    const dup = await sendWhatsAppMessage('5511999999999', 'Olá', key);
    expect(dup).toEqual({ success: true, deduplicated: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sendWhatsApp prefers WAHA over the legacy Evolution adapter', async () => {
    const wahaSend = jest.fn().mockResolvedValue({ success: true, messageId: 'waha-2' });
    const evolutionSend = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-2' });
    wahaAdapter = availableAdapter('waha', wahaSend);
    evolutionAdapter = availableAdapter('evolution', evolutionSend);

    const res = await sendWhatsApp('11999999999', 'Texto');

    expect(mockGetAdapter).toHaveBeenCalledWith('waha');
    expect(wahaSend).toHaveBeenCalledWith('11999999999', 'Texto');
    expect(evolutionSend).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, messageId: 'waha-2' });
  });

  it('sendWhatsApp resolves the legacy Evolution adapter when WAHA is not wired', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-2' });
    evolutionAdapter = availableAdapter('evolution', sendTextMessage);

    const res = await sendWhatsApp('11999999999', 'Texto');

    expect(mockGetAdapter).toHaveBeenCalledWith('evolution');
    expect(res).toEqual({ success: true, messageId: 'evo-2' });
  });

  it('sendWhatsApp keeps the legacy error message when the adapter is unavailable', async () => {
    evolutionAdapter = unavailableAdapter('evolution');

    const res = await sendWhatsApp('11999999999', 'Texto');

    expect(res).toEqual({ success: false, error: 'Evolution service not available' });
  });

  it('sendWhatsApp converts an ambiguous adapter throw into the unknown delivery contract', async () => {
    evolutionAdapter = availableAdapter(
      'evolution',
      jest.fn().mockRejectedValue(new Error('Connection timed out')),
    );

    const res = await sendWhatsApp('11999999999', 'Texto');

    expect(res).toEqual({ success: false, delivery: 'unknown', error: 'Connection timed out' });
  });

  it('sendWhatsApp falls back to the sidecar on a WAHA deterministic pre-dispatch failure', async () => {
    wahaAdapter = availableAdapter(
      'waha',
      jest.fn().mockRejectedValue(Object.assign(new Error('waha: invalid destination'), { code: 'invalid_destination', delivery: 'not_attempted' })),
    );
    process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
    process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, messageId: 'sc-waha-1' }),
    } as Response) as never;

    await expect(sendWhatsApp('11999999999', 'Texto')).resolves.toEqual({
      success: true,
      messageId: 'sc-waha-1',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sendWhatsApp falls through to Evolution when WAHA resolve throws', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-3' });
    evolutionAdapter = availableAdapter('evolution', sendTextMessage);
    mockGetAdapter.mockImplementation((((id: string) => {
      if (id === 'waha') throw new Error('registry boom');
      return evolutionAdapter;
    }) as never));

    await expect(sendWhatsApp('11999999999', 'Texto')).resolves.toEqual({
      success: true,
      messageId: 'evo-3',
    });
    expect(sendTextMessage).toHaveBeenCalledWith('11999999999', 'Texto');
  });
});
