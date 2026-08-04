/**
 * Unit tests for charge-service.ts — FIN-01 and FIN-02 contracts.
 */

const mockGetBudget = jest.fn();
const mockGetDefaultGateway = jest.fn();
const mockCreateCharge = jest.fn();
const mockGetGatewayProvider = jest.fn();
const mockWithIdempotency = jest.fn();

jest.mock('@/modules/financeiro/gateways/registry', () => ({
  getGatewayProvider: (...args: any[]) => mockGetGatewayProvider(...args),
}));

jest.mock('@/lib/idempotency', () => ({
  withIdempotency: (...args: any[]) => mockWithIdempotency(...args),
}));

jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  getBudget: (...args: any[]) => mockGetBudget(...args),
  getDefaultGateway: (...args: any[]) => mockGetDefaultGateway(...args),
  createPaymentCharge: (...args: any[]) => mockCreateCharge(...args),
  buildChargeInsert: (data: any) => data,
  findPaymentChargeByBudget: (...args: any[]) => jest.fn()(...args),
}));

import { createCharge } from '../charge-service';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBudget.mockResolvedValue({
    id: 'b1', clinicId: 'c1', finalValue: '100.00',
  });
  mockGetDefaultGateway.mockResolvedValue({
    id: 'g1', clinicId: 'c1', provider: 'asaas', isDefault: true, isEnabled: true,
  });
  mockGetGatewayProvider.mockReturnValue({
    createCharge: jest.fn().mockResolvedValue({
      externalChargeId: 'ext_1', paymentUrl: 'https://asaas.com/pay/1',
      pixQrCode: 'pix123', status: 'pending',
    }),
  });
  mockWithIdempotency.mockImplementation(async (_key: string, _type: string, handler: () => Promise<unknown>) => ({
    status: 'completed', result: await handler(),
  }));
  mockCreateCharge.mockResolvedValue({
    id: 'c1', clinicId: 'c1', budgetId: 'b1', externalChargeId: 'ext_1',
    amount: '100', status: 'pending',
  });
});

describe('charge-service', () => {
  describe('FIN-02: fail without fake data', () => {
    it('throws when provider is absent from registry', async () => {
      mockGetGatewayProvider.mockReturnValue(undefined);
      await expect(createCharge({
        clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01',
      })).rejects.toThrow(/not registered/);
      expect(mockCreateCharge).not.toHaveBeenCalled();
    });

    it('throws when no default gateway exists', async () => {
      mockGetDefaultGateway.mockResolvedValue(null);
      await expect(createCharge({
        clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01',
      })).rejects.toThrow(/No enabled default gateway/);
    });
  });

  describe('FIN-01: server-calculated value', () => {
    it('throws when budget does not exist', async () => {
      mockGetBudget.mockResolvedValue(undefined);
      await expect(createCharge({
        clinicId: 'c1', budgetId: 'bad_id', amount: 100, dueDate: '2026-08-01',
      })).rejects.toThrow(/Budget not found/);
    });

    it('throws when amount diverges from budget finalValue', async () => {
      mockGetBudget.mockResolvedValue({
        id: 'b1', clinicId: 'c1', finalValue: '200.00',
      });
      await expect(createCharge({
        clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01',
      })).rejects.toThrow(/does not match budget/);
    });

    it('succeeds when amount matches budget finalValue', async () => {
      const result = await createCharge({
        clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01',
      });
      expect(result.charge).toBeDefined();
      expect(result.gatewayResponse.externalChargeId).toBe('ext_1');
    });

    it('rejects cross-clinic budget access', async () => {
      mockGetBudget.mockResolvedValue({
        id: 'b1', clinicId: 'other-clinic', finalValue: '100.00',
      });
      await expect(createCharge({
        clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01',
      })).rejects.toThrow(/Budget not found/);
    });
  });
});
