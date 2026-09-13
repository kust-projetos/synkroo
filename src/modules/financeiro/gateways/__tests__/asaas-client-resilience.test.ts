/**
 * Unit tests — Asaas client resilience (Trilha A, etapa A2).
 *
 * Prova: create/cancel COM `Idempotency-Key` retryam; SEM a chave não retryam;
 * GET retrya; timeout vira erro sem vazar a apiKey; header mantido.
 */

jest.mock('../../repositories/financeiro-repository', () => ({
  listGateways: jest.fn().mockResolvedValue([{ id: 'gw-1', provider: 'asaas', isEnabled: true }]),
  getPaymentGateway: jest.fn().mockResolvedValue({
    encryptedConfig: { iv: 'iv', data: 'data', tag: 'tag' },
  }),
}));

jest.mock('../../lib/crypto', () => ({
  decryptGatewayCredentials: jest.fn().mockReturnValue({ apiKey: 'asaas-api-key-xyz' }),
}));

import { asaasClient } from '../providers/asaas/client';

function okCharge(id = 'ch_123'): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ id, invoiceUrl: 'https://pay.example.com/1', status: 'PENDING' }),
    text: async () => '{}',
  } as unknown as Response;
}

function errRes(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `provider-error-${status}`,
  } as unknown as Response;
}

const baseCreate = {
  clinicId: 'clinic-1',
  amount: 100,
  dueDate: '2026-10-01',
  customerName: 'Paciente Teste',
};

describe('asaas client resilience (A2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createCharge COM idempotencyKey: 500 → SEM retry HTTP (single attempt; retry vive no outbox)', async () => {
    (global.fetch as unknown) = jest.fn().mockResolvedValueOnce(errRes(500));

    await expect(
      asaasClient.createCharge({ ...baseCreate, idempotencyKey: 'idem-1' }),
    ).rejects.toThrow('Asaas createCharge failed: 500');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-1');
    expect(init.signal).toBeDefined(); // timeout explícito
  });

  it('createCharge SEM idempotencyKey: 500 → NÃO retrya (throw)', async () => {
    (global.fetch as unknown) = jest.fn().mockResolvedValueOnce(errRes(500));

    await expect(asaasClient.createCharge({ ...baseCreate })).rejects.toThrow(
      'Asaas createCharge failed: 500',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('getCharge: 429 → retrya e sucede', async () => {
    (global.fetch as unknown) = jest
      .fn()
      .mockResolvedValueOnce(errRes(429))
      .mockResolvedValueOnce(okCharge('ch_9'));

    const out = await asaasClient.getCharge({ clinicId: 'clinic-1', externalChargeId: 'ch_9' });

    expect(out.externalChargeId).toBe('ch_9');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('cancelCharge: erro de rede → SEM retry HTTP (1 tentativa) sem vazar apiKey', async () => {
    (global.fetch as unknown) = jest.fn().mockRejectedValue(new Error('fetch failed'));

    const err = await asaasClient
      .cancelCharge({
        clinicId: 'clinic-1',
        externalChargeId: 'ch_1',
        idempotencyKey: 'idem-cancel-1',
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/External request/);
    expect((err as Error).message).not.toContain('asaas-api-key-xyz');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
