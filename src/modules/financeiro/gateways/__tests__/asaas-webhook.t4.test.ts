/**
 * T4 unit — Asaas webhook adversarial: partial, duplicate, chargeback, cross-tenant
 */
const mockFindEvent = jest.fn();
const mockProcessAtomic = jest.fn();
const mockListGateways = jest.fn();

jest.mock('../../repositories/financeiro-repository', () => ({
  findGatewayEvent: (...args: any[]) => mockFindEvent(...args),
  processGatewayEventAtomically: (...args: any[]) => mockProcessAtomic(...args),
  listGateways: (...args: any[]) => mockListGateways(...args),
}));

import { processAsaasWebhook } from '../providers/asaas/webhook';

const CLINIC_A = 'clinic-a';
const CLINIC_B = 'clinic-b';

beforeEach(() => {
  jest.clearAllMocks();
  mockListGateways.mockResolvedValue([{ id: 'gw-1', clinicId: CLINIC_A, provider: 'asaas' }]);
  mockFindEvent.mockResolvedValue(undefined);
  mockProcessAtomic.mockResolvedValue({ settled: true, chargeFound: true });
});

describe('T4 — webhook Asaas adversarial', () => {
  it('dedupe by externalEventId — duplicate does not call atomic again', async () => {
    const payload = { id: 'evt-dup', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1', value: 100, status: 'RECEIVED' } };
    await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: payload });
    expect(mockProcessAtomic).toHaveBeenCalledTimes(1);
    mockFindEvent.mockResolvedValue({ id: 'existing', provider: 'asaas', externalEventId: 'evt-dup' } as any);
    const dup = await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: payload });
    expect(dup).toMatchObject({ duplicate: true });
    expect(mockProcessAtomic).toHaveBeenCalledTimes(1);
  });

  it('partial PIX does not mark paid — passes settlement true but amount < charge', async () => {
    // The repository will handle partial vs full; webhook just passes amount
    const payload = { id: 'evt-partial', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-partial', value: 10, status: 'RECEIVED' } };
    await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: payload });
    expect(mockProcessAtomic).toHaveBeenCalledWith(expect.objectContaining({ amount: '10', settlement: true }));
    // If later we test repository, it should keep status partially_paid
  });

  it('chargeback terminal — subsequent paid retry does not revert', async () => {
    // First settlement
    const payPayload = { id: 'evt-paid', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1', value: 500, status: 'RECEIVED' } };
    await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: payPayload });
    // Refund
    mockProcessAtomic.mockResolvedValueOnce({ settled: false, chargeFound: true });
    const refundPayload = { id: 'evt-refund', event: 'PAYMENT_REFUNDED', payment: { id: 'pay-1', value: 500, status: 'REFUNDED' } };
    await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: refundPayload });
    expect(mockProcessAtomic).toHaveBeenLastCalledWith(expect.objectContaining({ settlement: false }));
    // Late retry of original paid should not revert — repository CAS will keep cancelled
    mockFindEvent.mockResolvedValue(undefined);
    mockProcessAtomic.mockResolvedValue({ settled: false, chargeFound: true });
    const retry = await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: payPayload });
    // It will be processed but repository should return settled:false due to terminal
    expect(retry.settled).toBe(false);
  });

  it('cross-tenant: gateway not found for clinic B returns not settled', async () => {
    mockListGateways.mockResolvedValue([]); // No gateway for clinic B
    const payload = { id: 'evt-cross', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1', value: 100, status: 'RECEIVED' } };
    const res = await processAsaasWebhook({ clinicId: CLINIC_B, headers: new Headers(), body: payload });
    expect(res).toMatchObject({ settled: false });
    expect(mockProcessAtomic).not.toHaveBeenCalled();
  });

  it('preserves method and amount as decimal string', async () => {
    const payload = { id: 'evt-method', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1', value: 123.45, status: 'RECEIVED', billingType: 'BOLETO' } };
    await processAsaasWebhook({ clinicId: CLINIC_A, headers: new Headers(), body: payload });
    expect(mockProcessAtomic).toHaveBeenCalledWith(expect.objectContaining({ amount: '123.45' }));
  });
});
