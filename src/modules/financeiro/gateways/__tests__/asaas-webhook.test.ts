/**
 * Tests: Asaas webhook idempotent settlement.
 * Mocks repository layer for unit-test isolation.
 */

// Mock the repo layer so we don't need real DB or Drizzle mock chains
const mockFindEvent = jest.fn();
const mockCreateEvent = jest.fn();
const mockCreatePayment = jest.fn();
const mockListGateways = jest.fn().mockResolvedValue([]);

jest.mock('../../repositories/financeiro-repository', () => ({
  findGatewayEvent: (...args: any[]) => mockFindEvent(...args),
  createGatewayEvent: (...args: any[]) => mockCreateEvent(...args),
  createPayment: (...args: any[]) => mockCreatePayment(...args),
  listGateways: (...args: any[]) => mockListGateways(...args),
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

  // Default: gateway exists and event not yet processed
  mockListGateways.mockResolvedValue([
    { id: 'gateway-1', clinicId: 'c1', provider: 'asaas', isDefault: true, isEnabled: true },
  ]);
  mockFindEvent.mockResolvedValue(undefined);
  mockCreateEvent.mockResolvedValue({ id: 'evt-1' });
  mockCreatePayment.mockResolvedValue({ id: 'pay-1' });
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

    expect(first).toMatchObject({ settled: true });
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'asaas', externalEventId: 'evt_1' }),
    );

    // Second call: event already exists → duplicate
    mockFindEvent.mockResolvedValue({ id: 'existing', provider: 'asaas', externalEventId: 'evt_1' });

    const second = await processAsaasWebhook({
      clinicId: CLINIC_ID,
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(second).toMatchObject({ duplicate: true, settled: false });
    // No additional event created or payment settled
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
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

    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeId: 'pay_2',
        amount: '200',
        status: 'settled',
      }),
    );
  });

  test('non-payment events do not settle', async () => {
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

    expect(result).toMatchObject({ settled: false });
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });
});
