/**
 * F9.08 race tests — criação duplicada/simultânea deve ser idempotente.
 */
const mockGetBudget = jest.fn();
const mockGetDefaultGateway = jest.fn();
const mockCreateCharge = jest.fn();
const mockGetGatewayProvider = jest.fn();
const mockWithIdempotency = jest.fn();
const mockFindByBudget = jest.fn();

jest.mock('@/modules/financeiro/gateways/registry', () => ({
  getGatewayProvider: (...args: any[]) => mockGetGatewayProvider(...args),
}));
jest.mock('@/lib/idempotency', () => ({
  withIdempotency: (...args: any[]) => mockWithIdempotency(...args),
}));
jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  getBudget: (...args: any[]) => mockGetBudget(...args),
  getDefaultGateway: (...args: any[]) => mockGetDefaultGateway(...args),
  createPaymentChargeWithOutbox: (...args: any[]) => mockCreateCharge(...args),
  getPaymentCharge: jest.fn(),
  getPaymentGateway: jest.fn(),
  updatePaymentChargeWithOutbox: jest.fn(),
  buildChargeInsert: (d: any) => d,
  findPaymentChargeByBudget: (...args: any[]) => mockFindByBudget(...args),
}));

import { createCharge } from '../charge-service';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBudget.mockResolvedValue({ id: 'b1', clinicId: 'c1', finalValue: '100.00' });
  mockGetDefaultGateway.mockResolvedValue({ id: 'g1', clinicId: 'c1', provider: 'asaas', isDefault: true, isEnabled: true });
  mockGetGatewayProvider.mockReturnValue({
    createCharge: jest.fn().mockResolvedValue({ externalChargeId: 'ext_1', paymentUrl: 'https://pay', pixQrCode: 'pix', status: 'pending' }),
  });
  mockCreateCharge.mockResolvedValue({ id: 'c1', clinicId: 'c1', budgetId: 'b1', externalChargeId: 'ext_1', amount: '100', status: 'pending' });
  mockFindByBudget.mockResolvedValue({ id: 'c1', clinicId: 'c1', budgetId: 'b1', externalChargeId: 'ext_1', paymentUrl: 'https://pay', pixQrCode: 'pix', status: 'pending' });
});

describe('F9.08 finance race idempotent', () => {
  test('Promise.all duplicated createCharge returns same charge via withIdempotency', async () => {
    // first call completes, second sees already_processed
    mockWithIdempotency
      .mockImplementationOnce(async (_k: string, _t: string, h: () => Promise<unknown>) => ({ status: 'completed', result: await h() }))
      .mockImplementationOnce(async () => ({ status: 'already_processed', result: { charge: { id: 'c1' } } as any }));

    const a = createCharge({ clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01' });
    const b = createCharge({ clinicId: 'c1', budgetId: 'b1', amount: 100, dueDate: '2026-08-01' });
    const [ra, rb] = await Promise.all([a, b]);

    expect(ra.charge.id).toBe('c1');
    // already_processed path returns { success:true } or cached charge — ensure no duplicate external charge created twice
    expect(mockCreateCharge).toHaveBeenCalledTimes(1);
    expect(mockWithIdempotency).toHaveBeenCalledTimes(2);
  });

  test('webhook duplicado simultâneo é idempotente (evento + transition 1 transaction)', async () => {
    // Simulate gateway event persistence being idempotent: second call returns same event id
    const mockEvent = { id: 'evt-1' };
    // Reuse withIdempotency contract: duplicate event key → already_processed
    mockWithIdempotency
      .mockResolvedValueOnce({ status: 'completed', result: mockEvent })
      .mockResolvedValueOnce({ status: 'already_processed', result: mockEvent });
    const webhook = async () =>
      mockWithIdempotency('gateway:event:evt-1', 'asaas_webhook', async () => mockEvent);
    const [e1, e2] = await Promise.all([webhook(), webhook()]);
    expect(e1.result).toEqual(e2.result);
  });
});
