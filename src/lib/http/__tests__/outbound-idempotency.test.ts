/**
 * Unit tests — withOutboundIdempotency / buildOutboundIdempotencyKey (A3, review).
 *
 * Claim estruturado (`claimIdempotencyKey`) mockado; prova:
 * claimed→executa, completed→dedup, in_progress/retry_after→ConflictError,
 * infra→FAIL-CLOSED. Conflito legítimo NUNCA vira fail-open silencioso.
 *
 * E4 (HIGH-1): entrega não confirmada (`isDeliveryUnknown`) marca o claim
 * `unknown` — TERMINAL, sem retry por TTL — e o replay devolve
 * `deliveryUnknown` sem executar o handler e sem reportar sucesso.
 *
 * E4 (fail-closed no claim): falha de infra (`IdempotencyInfraError`) no claim
 * RELANÇA antes de qualquer handler — enviar sem dedup seria exatamente o
 * duplicate-send que o claim existe para impedir.
 */

import {
  buildOutboundIdempotencyKey,
  withOutboundIdempotency,
  OutboundSendConflictError,
} from '../outbound-idempotency';
import {
  claimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyDispatching,
  markIdempotencyKeyFailed,
  markIdempotencyKeyUnknown,
  IdempotencyInfraError,
} from '@/lib/idempotency';

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(),
  tryClaimIdempotencyKey: jest.fn(),
  markIdempotencyKeyCompleted: jest.fn(async () => undefined),
  markIdempotencyKeyDispatching: jest.fn(async () => true),
  markIdempotencyKeyFailed: jest.fn(async () => undefined),
  markIdempotencyKeyUnknown: jest.fn(async () => undefined),
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
const mockUnknown = markIdempotencyKeyUnknown as jest.Mock;
const mockDispatching = markIdempotencyKeyDispatching as jest.Mock;

/** Resultado usado pelos casos de entrega (mesma forma de `SendResult`). */
interface SendLike {
  success: boolean;
  delivery?: 'sent' | 'failed' | 'unknown';
  messageId?: string;
}

describe('outbound-idempotency (A3 review)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default do marco durável: a chave foi claimada e o marco foi armado.
    mockDispatching.mockResolvedValue(true);
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
    expect(mockCompleted).toHaveBeenCalledWith('whatsapp:send:c1:m1', undefined);
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
    // O TTL é repassado: o marco `dispatching` zera `expires_at`, então sem ele
    // a falha ficaria sem expiração e o retry legítimo nunca seria liberado.
    expect(mockFailed).toHaveBeenCalledWith('whatsapp:send:c1:m2', expect.any(String), 600);
    expect(mockCompleted).not.toHaveBeenCalled();
    expect(mockUnknown).not.toHaveBeenCalled();
  });

  it('entrega não confirmada marca unknown (TERMINAL) e não failed', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockResolvedValueOnce({ success: false, delivery: 'unknown' });

    const out = await withOutboundIdempotency<SendLike>('whatsapp:send:c1:m5', handler, {
      isSuccess: (r) => r.success,
      isDeliveryUnknown: (r) => r.delivery === 'unknown',
    });

    expect(out.deduped).toBe(false);
    expect(mockUnknown).toHaveBeenCalledWith('whatsapp:send:c1:m5');
    // `failed` liberaria retry pelo TTL — nunca para efeito possivelmente ocorrido.
    expect(mockFailed).not.toHaveBeenCalled();
    expect(mockCompleted).not.toHaveBeenCalled();
  });
  it('replay de claim unknown → deliveryUnknown, handler NÃO executa e NÃO é sucesso', async () => {
    mockClaim.mockResolvedValueOnce('unknown');
    const handler = jest.fn();

    const out = await withOutboundIdempotency<SendLike>('whatsapp:send:c1:m6', handler, {
      isSuccess: (r) => r.success,
      isDeliveryUnknown: (r) => r.delivery === 'unknown',
    });

    expect(out).toEqual({ deduped: true, deliveryUnknown: true });
    expect(handler).not.toHaveBeenCalled();
    expect(mockCompleted).not.toHaveBeenCalled();
  });

  it('sem isDeliveryUnknown, falha ambígua segue failed (contrato legado preservado)', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockResolvedValueOnce({ success: false, delivery: 'unknown' });

    await withOutboundIdempotency<SendLike>('whatsapp:send:c1:m7', handler, {
      isSuccess: (r) => r.success,
    });

    expect(mockUnknown).not.toHaveBeenCalled();
    expect(mockFailed).toHaveBeenCalledTimes(1);
  });

  it('throw do handler marca failed e rethrow', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockRejectedValueOnce(new Error('provider down'));

    await expect(withOutboundIdempotency('whatsapp:send:c1:m3', handler)).rejects.toThrow(
      'provider down',
    );
    expect(mockFailed).toHaveBeenCalledWith('whatsapp:send:c1:m3', 'provider down', 600);
  });

  it('falha de infra no claim → FAIL-CLOSED: IdempotencyInfraError, handler NÃO executa', async () => {
    mockClaim.mockRejectedValueOnce(new IdempotencyInfraError('db offline'));
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    await expect(withOutboundIdempotency('whatsapp:send:c1:m4', handler)).rejects.toBeInstanceOf(
      IdempotencyInfraError,
    );
    // Sem claim NÃO há dispatch: enviar sem dedup (fail-open) seria o
    // duplicate-send que o claim existe para impedir.
    expect(handler).not.toHaveBeenCalled();
    expect(mockDispatching).not.toHaveBeenCalled();
  });

  it('falha de infra no claim NUNCA alcança o provider (erro antes do handler)', async () => {
    mockClaim.mockRejectedValueOnce(new IdempotencyInfraError('db offline'));
    const order: string[] = [];
    const handler = jest.fn(async () => {
      order.push('handler');
      return { success: true };
    });

    const err = await withOutboundIdempotency('whatsapp:send:c1:m8', handler).catch((e) => e);
    order.push('rejected');

    expect(err).toBeInstanceOf(IdempotencyInfraError);
    expect(order).toEqual(['rejected']);
  });

  it('erro não-idempotência no claim propaga sem tratar como infra', async () => {
    mockClaim.mockRejectedValueOnce(new TypeError('bad claim input'));
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    await expect(withOutboundIdempotency('whatsapp:send:c1:m9', handler)).rejects.toBeInstanceOf(TypeError);
    expect(handler).not.toHaveBeenCalled();
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
    // O marco `completed` recebe o MESMO TTL: o marco `dispatching` zerou
    // `expires_at`, e um `completed` sem expiração própria nunca seria
    // reclaimado — a âncora de conteúdo perderia o reenvio tardio legítimo.
    expect(mockCompleted).toHaveBeenCalledWith('k', 600_000);
  });
});

// ─── E4 / HIGH-1 + HIGH-2: marco durável de dispatch e liquidação limitada ────

describe('outbound-idempotency — dispatching durável (E4 review)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatching.mockResolvedValue(true);
  });

  it('claimed → arma `dispatching` ANTES de chamar o handler', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    await withOutboundIdempotency('whatsapp:send:c1:d1', handler, {
      isSuccess: (r: { success: boolean }) => r.success,
    });

    expect(mockDispatching).toHaveBeenCalledWith('whatsapp:send:c1:d1');
    // Ordem é o contrato: sem o marco durável persistido, nenhum dispatch.
    expect(mockDispatching.mock.invocationCallOrder[0]).toBeLessThan(
      handler.mock.invocationCallOrder[0],
    );
  });

  it('marco `dispatching` perdido (false) → conflito, handler NÃO executa', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    mockDispatching.mockResolvedValueOnce(false);
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    await expect(
      withOutboundIdempotency('whatsapp:send:c1:d2', handler, {
        isSuccess: (r: { success: boolean }) => r.success,
      }),
    ).rejects.toBeInstanceOf(OutboundSendConflictError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('falha de infra ao armar `dispatching` → falha fechada, handler NÃO executa', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    mockDispatching.mockRejectedValueOnce(new Error('db offline'));
    const handler = jest.fn().mockResolvedValueOnce({ success: true });

    await expect(
      withOutboundIdempotency('whatsapp:send:c1:d3', handler, {
        isSuccess: (r: { success: boolean }) => r.success,
      }),
    ).rejects.toBeInstanceOf(IdempotencyInfraError);
    // Sem garantia terminal durável NÃO se despacha (nunca fail-open aqui).
    expect(handler).not.toHaveBeenCalled();
  });

  it('escrita do marco `unknown` que nunca resolve → resposta em tempo limitado, sem unhandled', async () => {
    mockClaim.mockResolvedValueOnce('claimed');
    let rejectSettle: ((reason: unknown) => void) | undefined;
    const hanging = new Promise<void>((_resolve, reject) => {
      rejectSettle = reject;
    });
    mockUnknown.mockReturnValueOnce(hanging);
    const handler = jest.fn().mockResolvedValueOnce({ success: false, delivery: 'unknown' });

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    const startedAt = Date.now();
    try {
      const out = await withOutboundIdempotency<SendLike>('whatsapp:send:c1:d4', handler, {
        isSuccess: (r) => r.success,
        isDeliveryUnknown: (r) => r.delivery === 'unknown',
      });
      expect(out.deduped).toBe(false);
      expect(out.result).toEqual({ success: false, delivery: 'unknown' });
      // A resposta NÃO pode esperar a liquidação para sempre.
      expect(Date.now() - startedAt).toBeLessThan(5_000);

      // A escrita destravada depois REJEITA: o catch em segundo plano absorve
      // e nada vira unhandled rejection.
      rejectSettle?.(new Error('db offline after the response'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
