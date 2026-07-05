/**
 * Unit tests: Financeiro gateway contracts and registry.
 */

import { getGatewayProvider, registerGatewayProvider } from '../registry';
import type { PaymentGateway, GatewayProvider } from '../contracts';

describe('gateway contracts', () => {
  it('GatewayProvider type includes asaas', () => {
    const provider: GatewayProvider = 'asaas';
    expect(provider).toBe('asaas');
  });

  it('GatewayProvider type includes mercado_pago, pagarme, efi', () => {
    const providers: GatewayProvider[] = ['asaas', 'mercado_pago', 'pagarme', 'efi'];
    expect(providers).toHaveLength(4);
  });

  it('CreateChargeResult has the expected shape', () => {
    const result: import('../contracts').CreateChargeResult = {
      externalChargeId: 'ch_123',
      paymentUrl: 'https://pay.example.com/123',
      pixQrCode: '00020126580014br.gov.bcb.pix',
      status: 'pending',
    };
    expect(result.externalChargeId).toBe('ch_123');
    expect(result.paymentUrl).toBeTruthy();
    expect(result.pixQrCode).toBeTruthy();
    expect(result.status).toBe('pending');
  });

  it('CreateChargeResult status can be paid, cancelled, overdue', () => {
    const paid: import('../contracts').CreateChargeResult['status'] = 'paid';
    const cancelled: import('../contracts').CreateChargeResult['status'] = 'cancelled';
    const overdue: import('../contracts').CreateChargeResult['status'] = 'overdue';
    expect(paid).toBe('paid');
    expect(cancelled).toBe('cancelled');
    expect(overdue).toBe('overdue');
  });
});

describe('gateway registry', () => {
  it('starts empty', () => {
    expect(getGatewayProvider('asaas')).toBeUndefined();
  });

  it('stores and retrieves a gateway provider', () => {
    const mockProvider: PaymentGateway = {
      createCharge: jest.fn(),
      getCharge: jest.fn(),
      cancelCharge: jest.fn(),
      handleWebhook: jest.fn(),
    };

    registerGatewayProvider('asaas', mockProvider);
    expect(getGatewayProvider('asaas')).toBe(mockProvider);
  });

  it('overwrites existing provider on re-register', () => {
    const oldProvider: PaymentGateway = {
      createCharge: jest.fn(),
      getCharge: jest.fn(),
      cancelCharge: jest.fn(),
      handleWebhook: jest.fn(),
    };
    const newProvider: PaymentGateway = {
      createCharge: jest.fn(),
      getCharge: jest.fn(),
      cancelCharge: jest.fn(),
      handleWebhook: jest.fn(),
    };

    registerGatewayProvider('pagarme', oldProvider);
    registerGatewayProvider('pagarme', newProvider);
    expect(getGatewayProvider('pagarme')).toBe(newProvider);
  });

  it('returns undefined for unregistered provider', () => {
    expect(getGatewayProvider('efi')).toBeUndefined();
  });
});

describe('PaymentGateway interface compliance', () => {
  it('Asaas client implements PaymentGateway', async () => {
    const { asaasClient } = await import('../providers/asaas/client');
    const client: PaymentGateway = asaasClient;

    expect(typeof client.createCharge).toBe('function');
    expect(typeof client.getCharge).toBe('function');
    expect(typeof client.cancelCharge).toBe('function');
    expect(typeof client.handleWebhook).toBe('function');
  });
});
