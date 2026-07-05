/**
 * Tests: Asaas webhook idempotent settlement.
 */

import { storeReset, storeFindGatewayEvent } from '../../repositories/financeiro-store';
import { processAsaasWebhook } from '../providers/asaas/webhook';

beforeEach(() => {
  storeReset();
});

describe('Asaas webhook idempotency', () => {
  test('settles charge only once, duplicate returns 200 with duplicate flag', async () => {
    const payload = {
      id: 'evt_1',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1', value: 100, status: 'RECEIVED' },
    };

    const first = await processAsaasWebhook({
      clinicId: 'c1',
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(first).toMatchObject({ settled: true });

    const second = await processAsaasWebhook({
      clinicId: 'c1',
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(second).toMatchObject({ duplicate: true, settled: false });
  });

  test('creates gateway event log entry on first call', async () => {
    const payload = {
      id: 'evt_2',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_2', value: 200, status: 'RECEIVED' },
    };

    const result = await processAsaasWebhook({
      clinicId: 'c1',
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(result.settled).toBe(true);

    const event = storeFindGatewayEvent('asaas', 'evt_2');
    expect(event).toBeDefined();
    expect(event!.provider).toBe('asaas');
    expect(event!.externalEventId).toBe('evt_2');
    expect(event!.chargeId).toBe('pay_2');
  });

  test('non-payment events do not settle', async () => {
    const payload = {
      id: 'evt_3',
      event: 'PAYMENT_OVERDUE',
      payment: { id: 'pay_3', value: 300, status: 'OVERDUE' },
    };

    const result = await processAsaasWebhook({
      clinicId: 'c1',
      headers: new Headers({ 'x-asaas-token': 'test' }),
      body: payload,
    });

    expect(result).toMatchObject({ settled: false });
  });
});
