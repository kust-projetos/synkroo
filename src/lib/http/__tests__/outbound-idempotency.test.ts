/**
 * Unit tests — withOutboundIdempotency / buildOutboundIdempotencyKey (A3, review).
 *
 * Claim estruturado (`claimIdempotencyKey`) mockado; prova:
 * claimed→executa, completed→dedup, in_progress/retry_after→ConflictError,
 * infra→fail-open. Conflito legítimo NUNCA vira fail-open silencioso.
 */

import {
  buildOutboundIdempotencyKey,
  withOutboundIdempotency,
  OutboundSendConflictError,
} from '../outbound-idempotency';
import {
  claimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyFailed,
  IdempotencyInfraError,
} from '@/lib/idempotency';

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(),
  tryClaimIdempotencyKey: jest.fn(),
  markIdempotencyKeyCompleted: jest.fn(),
  markIdempotencyKeyFailed: jest.fn(),
  isIdempotencyKeyProcessed: jest.fn(),
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

const mockClaim = claimIdempotencyKey as jest.Mock;
const mockCompleted = markIdempotencyKeyCompleted as jest.Mock;
const mockFailed = markIdempotencyKeyFailed as jest.Mock;

describe('outbound-idempotency (A3 review)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('monta chave determinística whatsapp:send:<clinic>:<stableId>', () => {
    expect(buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'msg-9')).toBe(
      'whatsapp:send:clinic-1:msg-9',
    );
    expect(buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'inbox:job-1')).toBe(
      'whatsapp:send:clinic-1:inbox:job-1',
    );
  });

  it('claimed → executa o handler e marca completed', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    const out = await withOutboundIdempotency('whatsapp:send:c1:m1', handler, {
      isSuccess: (r: { success: boolean }) => r.success,
    });

    expect(out).toEqual({ deduped: false, result: { success: true } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockCompleted).toHaveBeenCalledWith('whatsapp:send:c1:m1');
    expect(mockFailed).not.toHaveBeenCalled();
  });

  it('completed → deduped, handler NÃO executa', async () => {
    mockClaim.mockResolvedValueOnce('completed');
    const handler = jest.fn();

    const out = await withOutboundIdempotency('whatsapp:send:c1:m1', handler);

    expect(out).toEqual({ deduped: true });
    expect(handler).not.toHaveBeenCalled();
    expect(mockCompleted).not.toHaveBeenCalled();
  });

  it('in_progress → OutboundSendConflictError (não envia, não reporta sucesso)', async () => {
    mockClaim.mockResolvedValueOnce('in_progress');
    const handler = jest.fn();

    await expect(withOutboundIdempotency('whatsapp:send:c1:m1', handler)).rejects.toBeInstanceOf(
      OutboundSendConflictError,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('retry_after → OutboundSendConflictError', async () => {
    mockClaim.mockResolvedValueOnce('retry_after');
    const handler = jest.fn();

    const err = await withOutboundIdempotency('whatsapp:send:c1:m1', handler).catch((e) => e);
    expect(err).toBeInstanceOf(OutboundSendConflictError);
    expect((err as OutboundSendConflictError).state).toBe('retry_after');
    expect(handler).not.toHaveBeenCalled();
  });

  it('falha do provider marca failed (retry liberado após TTL)', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockResolvedValueOnce({ success: false });

    const out = await withOutboundIdempotency('whatsapp:send:c1:m2', handler, {
      isSuccess: (r: { success: boolean }) => r.success,
    });

    expect(out.deduped).toBe(false);
    expect(mockFailed).toHaveBeenCalledWith('whatsapp:send:c1:m2', expect.any(String));
    expect(mockCompleted).not.toHaveBeenCalled();
  });

  it('throw do handler marca failed e rethrow', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockRejectedValueOnce(new Error('provider down'));

    await expect(withOutboundIdempotency('whatsapp:send:c1:m3', handler)).rejects.toThrow(
      'provider down',
    );
    expect(mockFailed).toHaveBeenCalledWith('whatsapp:send:c1:m3', 'provider down');
  });

  it('infra indisponível → fail-open: envia sem dedup (só IdempotencyInfraError)', async () => {
    mockClaim.mockRejectedValueOnce(new IdempotencyInfraError('db offline'));
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    const out = await withOutboundIdempotency('whatsapp:send:c1:m4', handler);

    expect(out).toEqual({ deduped: false, result: { success: true } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('repassa completedTtlMs ao claim', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockResolvedValueOnce('ok');

    await withOutboundIdempotency('k', handler, { completedTtlMs: 600_000 });

    expect(mockClaim).toHaveBeenCalledWith(
      'k',
      'whatsapp:outbound',
      expect.objectContaining({ completedTtlMs: 600_000 }),
    );
  });
});
