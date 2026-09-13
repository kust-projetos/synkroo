/**
 * Fiação A3 — enviar-mensagem ancora chave determinística pré-envio.
 *
 * Channel-service e evolution-service REAIS + claim in-memory (sem DB):
 * retry duplicado da mesma operação lógica → provider (fetch) 1 chamada.
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

let messageSeq = 0;
jest.mock('../../repositories/conversations-repository', () => ({
  findByIdForClinic: jest.fn(async (conversationId: string) => ({
    id: conversationId,
    clinicId: 'clinic-1',
    externalId: '5511999990001',
    channel: 'whatsapp',
  })),
  findByIdWithJoins: jest.fn(async (conversationId: string) => ({
    id: conversationId,
    clinicId: 'clinic-1',
    externalId: '5511999990001',
    channel: 'whatsapp',
  })),
  appendOutboundMessage: jest.fn(async (_clinicId: string, data: Record<string, unknown>) => ({
    id: `msg-${(messageSeq += 1)}`,
    ...data,
  })),
  updateConversation: jest.fn(async () => undefined),
}));

import { enviarMensagem, buildOutboundPayloadFingerprint } from '../enviar-mensagem';

const ctx: any = {
  clinicId: 'clinic-1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
};

describe('enviar-mensagem idempotency wiring (A3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    claimed.clear();
    completed.clear();
    messageSeq = 0;
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    process.env.EVOLUTION_API_KEY = 'evo-key';
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-1' } } }),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('retry duplicado (mesmo input) → provider chamado 1 vez', async () => {
    const input = { conversationId: '11111111-1111-4111-8111-111111111111', message: 'Olá!' };

    const first = await enviarMensagem.handler(input, ctx);
    const dup = await enviarMensagem.handler(input, ctx);

    expect((first as { messageId: string }).messageId).toBeDefined();
    expect((dup as { messageId: string }).messageId).toBeDefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('idempotencyKey próprio ancora a operação (chaves distintas reenviam)', async () => {
    const base = { conversationId: '11111111-1111-4111-8111-111111111111', message: 'Olá!' };

    await enviarMensagem.handler({ ...base, idempotencyKey: 'op-1' }, ctx);
    await enviarMensagem.handler({ ...base, idempotencyKey: 'op-1' }, ctx);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await enviarMensagem.handler({ ...base, idempotencyKey: 'op-2' }, ctx);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('fingerprint é determinístico por payload e sensível ao texto', () => {
    const a = buildOutboundPayloadFingerprint('whatsapp', '5511999990001', '  Olá! ');
    const b = buildOutboundPayloadFingerprint('whatsapp', '5511999990001', 'Olá!');
    const c = buildOutboundPayloadFingerprint('whatsapp', '5511999990001', 'Tchau!');
    expect(a).toBe(b); // normalização: trim
    expect(a).not.toBe(c);
    expect(a).toHaveLength(16);
  });
});
