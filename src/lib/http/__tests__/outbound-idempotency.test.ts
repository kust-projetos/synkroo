/**
 * Unit tests — withOutboundIdempotency / buildOutboundIdempotencyKey (A3).
 *
 * Camada DB (`@/lib/idempotency`) mockada; prova o contrato do claim:
 * primeira execução processa, duplicata não reexecuta o handler.
 */

import { buildOutboundIdempotencyKey, withOutboundIdempotency } from '../outbound-idempotency';
import {
  tryClaimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyFailed,
} from '@/lib/idempotency';

jest.mock('@/lib/idempotency', () => ({
  tryClaimIdempotencyKey: jest.fn(),
  markIdempotencyKeyCompleted: jest.fn(),
  markIdempotencyKeyFailed: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockClaim = tryClaimIdempotencyKey as jest.Mock;
const mockCompleted = markIdempotencyKeyCompleted as jest.Mock;
const mockFailed = markIdempotencyKeyFailed as jest.Mock;

describe('outbound-idempotency (A3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('monta chave determinística whatsapp:send:<clinic>:<stableId>', () => {
    expect(buildOutboundIdempotencyKey('whatsapp', 'clinic-1', 'msg-9')).toBe(
      'whatsapp:send:clinic-1:msg-9',
    );
    expect(buildOutboundIdempotencyKey('instagram', 'clinic-1', 'ig-2')).toBe(
      'instagram:send:clinic-1:ig-2',
    );
  });

  it('primeira execução roda o handler e marca completed', async () => {
    mockClaim.mockResolvedValueOnce(true);
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    const out = await withOutboundIdempotency('whatsapp:send:c1:m1', handler, {
      isSuccess: (r: { success: boolean }) => r.success,
    });

    expect(out).toEqual({ deduped: false, result: { success: true } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockCompleted).toHaveBeenCalledWith('whatsapp:send:c1:m1');
    expect(mockFailed).not.toHaveBeenCalled();
  });

  it('duplicata (claim recusado) NÃO reexecuta o handler', async () => {
    mockClaim.mockResolvedValueOnce(false);
    const handler = jest.fn();

    const out = await withOutboundIdempotency('whatsapp:send:c1:m1', handler);

    expect(out).toEqual({ deduped: true });
    expect(handler).not.toHaveBeenCalled();
    expect(mockCompleted).not.toHaveBeenCalled();
  });

  it('falha do provider marca failed (retry liberado após TTL)', async () => {
    mockClaim.mockResolvedValueOnce(true);
    const handler = jest.fn().mockResolvedValueOnce({ success: false });

    const out = await withOutboundIdempotency('whatsapp:send:c1:m2', handler, {
      isSuccess: (r: { success: boolean }) => r.success,
    });

    expect(out.deduped).toBe(false);
    expect(mockFailed).toHaveBeenCalledWith('whatsapp:send:c1:m2', expect.any(String));
    expect(mockCompleted).not.toHaveBeenCalled();
  });

  it('throw do handler marca failed e rethrow', async () => {
    mockClaim.mockResolvedValueOnce(true);
    const handler = jest.fn().mockRejectedValueOnce(new Error('provider down'));

    await expect(withOutboundIdempotency('whatsapp:send:c1:m3', handler)).rejects.toThrow(
      'provider down',
    );
    expect(mockFailed).toHaveBeenCalledWith('whatsapp:send:c1:m3', 'provider down');
  });

  it('claim indisponível (DB down) → fail-open: envia sem dedup', async () => {
    mockClaim.mockRejectedValueOnce(new Error('db offline'));
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    const out = await withOutboundIdempotency('whatsapp:send:c1:m4', handler);

    expect(out).toEqual({ deduped: false, result: { success: true } });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
