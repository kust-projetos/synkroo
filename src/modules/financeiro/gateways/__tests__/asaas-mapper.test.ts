import { mapAsaasCreateChargeResponse, mapAsaasWebhookEvent } from '../providers/asaas/mapper';

describe('Asaas payload mapper', () => {
  it('maps a create-charge response to the normalized result', () => {
    expect(mapAsaasCreateChargeResponse({
      id: 'pay_123',
      invoiceUrl: 'https://asaas.example/invoice/pay_123',
      pixQrCode: '000201...',
      status: 'RECEIVED',
    })).toEqual({
      externalChargeId: 'pay_123',
      paymentUrl: 'https://asaas.example/invoice/pay_123',
      pixQrCode: '000201...',
      status: 'paid',
    });
  });

  it('uses null links and pending status when optional fields are absent', () => {
    expect(mapAsaasCreateChargeResponse({ id: 'pay_456' })).toEqual({
      externalChargeId: 'pay_456',
      paymentUrl: null,
      pixQrCode: null,
      status: 'pending',
    });
  });

  it('delegates webhook normalization and preserves the raw payload', () => {
    const payload = {
      id: 'evt_123',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', status: 'RECEIVED', paymentDate: '2026-08-20' },
    };

    expect(mapAsaasWebhookEvent(payload)).toEqual({
      provider: 'asaas',
      externalEventId: 'evt_123',
      externalChargeId: 'pay_123',
      status: 'paid',
      paidAt: '2026-08-20',
      raw: payload,
    });
  });

  it('rejects an invalid webhook payload', () => {
    expect(() => mapAsaasWebhookEvent({ event: 'PAYMENT_RECEIVED' })).toThrow(
      'Invalid Asaas webhook payload',
    );
  });
});
