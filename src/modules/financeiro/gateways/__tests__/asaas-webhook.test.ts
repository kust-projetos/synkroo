/**
 * Tests: Asaas webhook idempotent settlement.
 * Mocks repository layer for unit-test isolation.
 */

// Mock the repo layer so we don't need real DB or Drizzle mock chains
const mockFindEvent = jest.fn();
const mockCreateEvent = jest.fn();
const mockCreatePayment = jest.fn();
const mockListGateways = jest.fn().mockResolvedValue([]);
const mockFindPaymentChargeByExternalId = jest.fn();
const mockProcessGatewayEventAtomically = jest.fn();

jest.mock('../../repositories/financeiro-repository', () => ({
  findGatewayEvent: (...args: any[]) => mockFindEvent(...args),
  createGatewayEvent: (...args: any[]) => mockCreateEvent(...args),
  createPayment: (...args: any[]) => mockCreatePayment(...args),
  listGateways: (...args: any[]) => mockListGateways(...args),
  findPaymentChargeByExternalId: (...args: any[]) => mockFindPaymentChargeByExternalId(...args),
  processGatewayEventAtomically: (...args: any[]) => mockProcessGatewayEventAtomically(...args),
}));

import { storeReset } from '../../repositories/financeiro-store';
import { processAsaasWebhook } from '../providers/asaas/webhook';

beforeEach(() => {
  storeReset();
  jest.clearAllMocks();
  mockFindEvent.mockReset();
  mockCreateEvent.mockReset();
  mockCreatePayment.mockReset();
  mockListGateways.mockReset();
  mockFindPaymentChargeByExternalId.mockReset();
  mockProcessGatewayEventAtomically.mockReset();

  // Default: gateway exists, charge exists, event not yet processed
  mockListGateways.mockResolvedValue([
    { id: 'gateway-1', clinicId: 'c1', provider: 'asaas', isDefault: true, isEnabled: true },
  ]);
  mockFindPaymentChargeByExternalId.mockResolvedValue({
    id: 'charge-1', clinicId: 'c1', externalChargeId: 'pay_1', amount: '100', status: 'pending',
  });
  mockFindEvent.mockResolvedValue(undefined);
  mockCreateEvent.mockResolvedValue({ id: 'evt-1' });
  mockCreatePayment.mockResolvedValue({ id: 'pay-1' });
  mockProcessGatewayEventAtomically.mockResolvedValue({ settled: true, chargeFound: true });
});

const CLINIC_ID = 'c1';

describe('Asaas webhook idempotency', () => {
  test('settles charge only once, duplicate returns duplicate flag', async () => {
    const payload = {
      id: 'evt_1',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1', value: 100, status: 'RECEIVED' },
    };

    const first = await processAsaasWebhook({
      clinicId: CLINIC_ID,
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(first).toMatchObject({ settled: true, chargeFound: true });
    expect(mockProcessGatewayEventAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'asaas', externalEventId: 'evt_1' }),
    );

    // Second call: event already exists → duplicate
    mockFindEvent.mockResolvedValue({ id: 'existing', provider: 'asaas', externalEventId: 'evt_1' });

    const second = await processAsaasWebhook({
      clinicId: CLINIC_ID,
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(second).toMatchObject({ duplicate: true, settled: false, chargeFound: true });
    // No additional event created or payment settled
    expect(mockProcessGatewayEventAtomically).toHaveBeenCalledTimes(1);
  });

  test('settles through atomic repository transaction', async () => {
    const payload = {
      id: 'evt_atomic',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_atomic', value: 200, status: 'RECEIVED' },
    };

    await processAsaasWebhook({ clinicId: CLINIC_ID, headers: new Headers(), body: payload });

    expect(mockProcessGatewayEventAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC_ID, externalEventId: 'evt_atomic' }),
    );
  });

  test('creates payment on settlement event', async () => {
    const payload = {
      id: 'evt_2',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_2', value: 200, status: 'RECEIVED' },
    };

    await processAsaasWebhook({
      clinicId: CLINIC_ID,
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(mockProcessGatewayEventAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        externalChargeId: 'pay_2',
        amount: '200',
        settlement: true,
      }),
    );
  });

  test('non-payment events do not settle but chargeFound=true (gateway exists)', async () => {
    mockProcessGatewayEventAtomically.mockResolvedValueOnce({ settled: false, chargeFound: true });
    const payload = {
      id: 'evt_3',
      event: 'PAYMENT_OVERDUE',
      payment: { id: 'pay_3', value: 300, status: 'OVERDUE' },
    };

    const result = await processAsaasWebhook({
      clinicId: CLINIC_ID,
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(result).toMatchObject({ settled: false, chargeFound: true });
    expect(mockProcessGatewayEventAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ settlement: false }),
    );
  });

  test('returns chargeFound=false when gateway exists but external charge not found locally', async () => {
    mockProcessGatewayEventAtomically.mockResolvedValueOnce({ settled: false, chargeFound: false });
    const payload = {
      id: 'evt_4',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'unknown-charge', value: 500, status: 'RECEIVED' },
    };

    const result = await processAsaasWebhook({
      clinicId: CLINIC_ID,
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(result).toMatchObject({ settled: false, chargeFound: false });
    expect(mockProcessGatewayEventAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ externalChargeId: 'unknown-charge' }),
    );
  });
});
