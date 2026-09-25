/**
 * T1 — Isolamento por clínica no dispatcher financeiro.
 *
 * RED: job.clinicId = clínica A, mas payload tenta usar recursos da clínica B.
 * O dispatcher deve derivar tenant somente de job.clinicId, buscar gateway/charge
 * por clinicId, validar gateway-charge-budget-clinic antes de provider e falhar
 * fechado sem chamada externa nem mutação na vítima.
 */

const mockGetPaymentGateway = jest.fn();
const mockGetPaymentGatewayForClinic = jest.fn();
const mockGetPaymentChargeForClinic = jest.fn();
const mockGetBudgetForClinic = jest.fn();
const mockUpdatePaymentChargeForClinic = jest.fn();
const mockUpdatePaymentCharge = jest.fn();
const mockGetGatewayProvider = jest.fn();

jest.mock('@/modules/financeiro/gateways/registry', () => ({
  getGatewayProvider: (...args: unknown[]) => mockGetGatewayProvider(...args),
}));

jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  getPaymentGateway: (...args: unknown[]) => mockGetPaymentGateway(...args),
  getPaymentGatewayForClinic: (...args: unknown[]) => mockGetPaymentGatewayForClinic(...args),
  getPaymentChargeForClinic: (...args: unknown[]) => mockGetPaymentChargeForClinic(...args),
  getBudgetForClinic: (...args: unknown[]) => mockGetBudgetForClinic(...args),
  updatePaymentCharge: (...args: unknown[]) => mockUpdatePaymentCharge(...args),
  updatePaymentChargeForClinic: (...args: unknown[]) => mockUpdatePaymentChargeForClinic(...args),
}));

import { dispatchChargeJob } from '../dispatch-charge-job';

const clinicA = '11111111-1111-1111-1111-111111111111';
const clinicB = '22222222-2222-2222-2222-222222222222';
const gatewayA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const gatewayB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const chargeA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const chargeB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const budgetA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10';
const budgetB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb20';

const providerMock = {
  createCharge: jest.fn().mockResolvedValue({
    externalChargeId: 'ext_123',
    paymentUrl: 'https://pay.example/ext_123',
    pixQrCode: 'pix_qr',
    status: 'pending' as const,
  }),
  cancelCharge: jest.fn().mockResolvedValue({ cancelled: true }),
  getCharge: jest.fn(),
  handleWebhook: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGatewayProvider.mockReturnValue(providerMock);
  providerMock.createCharge.mockClear();
  providerMock.cancelCharge.mockClear();
  mockUpdatePaymentCharge.mockClear();
  mockUpdatePaymentChargeForClinic.mockClear();
  // Default: scoped lookups return matching clinic records
  mockGetPaymentGatewayForClinic.mockImplementation(async (gatewayId: string, clinicId: string) => {
    if (gatewayId === gatewayA && clinicId === clinicA) return { id: gatewayA, clinicId: clinicA, provider: 'asaas' } as any;
    if (gatewayId === gatewayB && clinicId === clinicB) return { id: gatewayB, clinicId: clinicB, provider: 'asaas' } as any;
    return undefined;
  });
  mockGetPaymentChargeForClinic.mockImplementation(async (chargeId: string, clinicId: string) => {
    if (chargeId === chargeA && clinicId === clinicA) return { id: chargeA, clinicId: clinicA, gatewayId: gatewayA, budgetId: budgetA, status: 'pending' } as any;
    if (chargeId === chargeB && clinicId === clinicB) return { id: chargeB, clinicId: clinicB, gatewayId: gatewayB, budgetId: budgetB, status: 'pending' } as any;
    return undefined;
  });
  mockGetBudgetForClinic.mockImplementation(async (budgetId: string, clinicId: string) => {
    if (budgetId === budgetA && clinicId === clinicA) return { id: budgetA, clinicId: clinicA } as any;
    if (budgetId === budgetB && clinicId === clinicB) return { id: budgetB, clinicId: clinicB } as any;
    return undefined;
  });
  // Legacy unscoped mocks — current vulnerable code uses these
  mockGetPaymentGateway.mockImplementation(async (gatewayId: string) => {
    if (gatewayId === gatewayA) return { id: gatewayA, clinicId: clinicA, provider: 'asaas' } as any;
    if (gatewayId === gatewayB) return { id: gatewayB, clinicId: clinicB, provider: 'asaas' } as any;
    return undefined;
  });
  mockUpdatePaymentCharge.mockResolvedValue({ id: chargeB } as any);
  mockUpdatePaymentChargeForClinic.mockResolvedValue({ id: chargeA } as any);
});

describe('T1 dispatchChargeJob — isolamento por clínica', () => {
  test('job da clínica A com payload adulterado da clínica B não chama provider nem atualiza charge (create)', async () => {
    const job: any = {
      id: 'job-1',
      clinicId: clinicA, // autoridade
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetB',
      payload: {
        chargeId: chargeB, // charge da vítima B
        gatewayId: gatewayB, // gateway da vítima B
        clinicId: clinicB, // payload tenta se passar por B
        amount: 100,
        dueDate: '2026-08-10',
        budgetId: budgetB,
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow();

    // Deve falhar fechado: nenhuma chamada externa e nenhuma mutação na vítima
    expect(providerMock.createCharge).not.toHaveBeenCalled();
    expect(mockUpdatePaymentCharge).not.toHaveBeenCalled();
    expect(mockUpdatePaymentChargeForClinic).not.toHaveBeenCalled();
  });

  test('gateway/charge de clínica B não podem ser usados por job da clínica A (cancel)', async () => {
    const job: any = {
      id: 'job-2',
      clinicId: clinicA,
      operation: 'financeiro.charge.cancel',
      businessKey: 'charge:cancel:clinicA:chargeB',
      payload: {
        chargeId: chargeB,
        gatewayId: gatewayB,
        clinicId: clinicB,
        externalChargeId: 'ext_b',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow();

    expect(providerMock.cancelCharge).not.toHaveBeenCalled();
    expect(mockUpdatePaymentCharge).not.toHaveBeenCalled();
    expect(mockUpdatePaymentChargeForClinic).not.toHaveBeenCalled();
  });

  test('gateway não pertencente à clínica do job falha antes do provider', async () => {
    // chargeA existe para clinicA, mas gatewayB pertence a clinicB
    mockGetPaymentChargeForClinic.mockResolvedValueOnce({ id: chargeA, clinicId: clinicA, gatewayId: gatewayB, budgetId: budgetA, status: 'pending' } as any);

    const job: any = {
      id: 'job-3',
      clinicId: clinicA,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetA',
      payload: {
        chargeId: chargeA,
        gatewayId: gatewayB, // mismatch
        clinicId: clinicA,
        amount: 50,
        dueDate: '2026-08-11',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow();

    expect(providerMock.createCharge).not.toHaveBeenCalled();
  });

  test('budget de outra clínica falha fechado', async () => {
    // chargeA pertence a A, gatewayA pertence a A, mas budget é de B
    mockGetPaymentChargeForClinic.mockResolvedValueOnce({ id: chargeA, clinicId: clinicA, gatewayId: gatewayA, budgetId: budgetB, status: 'pending' } as any);

    const job: any = {
      id: 'job-4',
      clinicId: clinicA,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetB',
      payload: {
        chargeId: chargeA,
        gatewayId: gatewayA,
        clinicId: clinicA,
        amount: 75,
        dueDate: '2026-08-12',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow();

    expect(providerMock.createCharge).not.toHaveBeenCalled();
  });

  test('fluxo feliz: job e payload alinhados na mesma clínica chama provider e persiste via ForClinic', async () => {
    const job: any = {
      id: 'job-5',
      clinicId: clinicA,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetA',
      payload: {
        chargeId: chargeA,
        gatewayId: gatewayA,
        clinicId: clinicA, // payload igual, mas deve ser ignorado
        amount: 100,
        dueDate: '2026-08-10',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).resolves.toBeUndefined();

    expect(providerMock.createCharge).toHaveBeenCalledTimes(1);
    expect(providerMock.createCharge).toHaveBeenCalledWith(expect.objectContaining({ clinicId: clinicA }));
    // payload.clinicId não deve ser usado como fonte de decisão — a chamada usa job.clinicId
    expect(mockUpdatePaymentChargeForClinic).toHaveBeenCalledTimes(1);
    expect(mockUpdatePaymentCharge).not.toHaveBeenCalled();
  });

  test('payload.clinicId é ignorado mesmo quando igual ao job — clinicId vem de job.clinicId', async () => {
    // Mesmo quando payload tem clinicId idêntico, a fonte de verdade deve ser job
    const job: any = {
      id: 'job-6',
      clinicId: clinicA,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetA',
      payload: {
        chargeId: chargeA,
        gatewayId: gatewayA,
        // sem clinicId no payload — deve continuar funcionando via job
        amount: 100,
        dueDate: '2026-08-10',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).resolves.toBeUndefined();
    expect(providerMock.createCharge).toHaveBeenCalledWith(expect.objectContaining({ clinicId: clinicA }));
  });

  test('precisão: amount de 2 decimais passa normalizado e exato (100.01 → 100.01)', async () => {
    const job: any = {
      id: 'job-7',
      clinicId: clinicA,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetA',
      payload: {
        chargeId: chargeA,
        gatewayId: gatewayA,
        amount: 100.01,
        dueDate: '2026-08-10',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).resolves.toBeUndefined();
    expect(providerMock.createCharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 100.01 }));
  });

  test('precisão: artefato float (0.1+0.2) é rejeitado antes de qualquer chamada externa', async () => {
    const job: any = {
      id: 'job-8',
      clinicId: clinicA,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:clinicA:budgetA',
      payload: {
        chargeId: chargeA,
        gatewayId: gatewayA,
        amount: 0.1 + 0.2, // 0.30000000000000004 — não é decimal exato de 2 casas
        dueDate: '2026-08-10',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow();
    expect(providerMock.createCharge).not.toHaveBeenCalled();
    expect(mockUpdatePaymentChargeForClinic).not.toHaveBeenCalled();
  });
});
