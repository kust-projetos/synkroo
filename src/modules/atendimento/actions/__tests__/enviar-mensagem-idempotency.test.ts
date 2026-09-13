/**
 * Fiação A3 — enviar-mensagem ancora chave determinística pré-envio.
 *
 * Channel-service e evolution-service REAIS + claim in-memory (sem DB):
 * retry duplicado da mesma operação lógica → provider (fetch) 1 chamada.
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
import { claimIdempotencyKey } from '@/lib/idempotency';
import { ActionError } from '@/core/actions/types';

const ctx: any = {
  clinicId: 'clinic-1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
};

describe('enviar-mensagem idempotency wiring (A3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    outcomes.length = 0;
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
    outcomes.push('claimed', 'completed');
    const input = { conversationId: '11111111-1111-4111-8111-111111111111', message: 'Olá!' };

    const first = await enviarMensagem.handler(input, ctx);
    const dup = await enviarMensagem.handler(input, ctx);

    expect((first as { messageId: string }).messageId).toBeDefined();
    expect((dup as { messageId: string }).messageId).toBeDefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Âncora fingerprint expira `completed` em 10min (reenvio tardio legítimo).
    expect(claimIdempotencyKey).toHaveBeenCalledWith(
      expect.stringContaining('whatsapp:send:clinic-1:'),
      'whatsapp:outbound',
      expect.objectContaining({ completedTtlMs: 10 * 60 * 1000 }),
    );
  });

  it('idempotencyKey próprio ancora a operação (chaves distintas reenviam)', async () => {
    outcomes.push('claimed', 'completed', 'claimed');
    const base = { conversationId: '11111111-1111-4111-8111-111111111111', message: 'Olá!' };

    await enviarMensagem.handler({ ...base, idempotencyKey: 'op-1' }, ctx);
    await enviarMensagem.handler({ ...base, idempotencyKey: 'op-1' }, ctx);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await enviarMensagem.handler({ ...base, idempotencyKey: 'op-2' }, ctx);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('conflito (outra execução ativa) → ActionError code conflict', async () => {
    outcomes.push('retry_after');
    const input = { conversationId: '11111111-1111-4111-8111-111111111111', message: 'Olá!' };

    const err = await enviarMensagem.handler(input, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ActionError);
    expect((err as ActionError).code).toBe('conflict');
    expect(global.fetch).not.toHaveBeenCalled();
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
