/**
 * Route tests: Financeiro canonical routes + legacy budget adapters.
 * Mocks route-adapter for action-gated reads to isolate RBAC enforcement.
 */

// Mock the route-adapter so canonical routes return 200 by default
const mockRunFinanceiroAction = jest.fn().mockImplementation(
  () => Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })),
);
jest.mock('@/modules/financeiro/ui/route-adapter', () => ({
  runFinanceiroAction: (...args: any[]) => mockRunFinanceiroAction(...args),
}));

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn().mockResolvedValue({
    success: true,
    profile: {
      id: '00000000-0000-0000-0000-000000000099',
      clinic_id: '00000000-0000-0000-0000-000000000001',
      role: 'owner',
    },
  }),
}));

jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: {
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'financeiro'])),
  },
}));

// Mock budget-service for legacy route tests
const mockListBudgets = jest.fn().mockResolvedValue([]);
const mockGetBudget = jest.fn().mockResolvedValue(undefined);
const mockGetBudgetForClinic = jest.fn().mockResolvedValue({ id: 'b1', clinicId: '00000000-0000-0000-0000-000000000001', finalValue: '900' });
const mockMarkBudgetSent = jest.fn().mockResolvedValue({ id: 'b1', status: 'pending' });
const mockAcceptBudget = jest.fn().mockResolvedValue({ id: 'b1', status: 'accepted', acceptedAt: new Date().toISOString() });
const mockRejectBudget = jest.fn().mockResolvedValue({ id: 'b1', status: 'rejected', rejectedAt: new Date().toISOString() });
const mockListPayments = jest.fn().mockResolvedValue([]);

jest.mock('@/modules/financeiro/services/budget-service', () => ({
  listBudgets: (...args: any[]) => mockListBudgets(...args),
  createBudget: jest.fn(),
  getBudget: (...args: any[]) => mockGetBudget(...args),
  markBudgetSent: (...args: any[]) => mockMarkBudgetSent(...args),
  acceptBudget: (...args: any[]) => mockAcceptBudget(...args),
  rejectBudget: (...args: any[]) => mockRejectBudget(...args),
  calculateBudgetTotals: jest.fn(),
}));

jest.mock('@/modules/financeiro/services/budget-scope-service', () => ({
  getBudgetForClinic: (...args: any[]) => mockGetBudgetForClinic(...args),
  updateInstallmentForBudget: jest.fn(),
  deleteInstallmentForBudget: jest.fn(),
}));

jest.mock('@/modules/financeiro/services/payment-service', () => ({
  listPayments: (...args: any[]) => mockListPayments(...args),
  registerManualPayment: jest.fn(),
}));

// Mock installment service for legacy route tests
const mockListInstallments = jest.fn().mockResolvedValue([]);
const mockCalcRemainingBalance = jest.fn().mockResolvedValue(0);
jest.mock('@/modules/financeiro/services/installment-service', () => ({
  listInstallments: (...args: any[]) => mockListInstallments(...args),
  calculateRemainingBalance: (...args: any[]) => mockCalcRemainingBalance(...args),
  replaceInstallments: jest.fn().mockResolvedValue([]),
  updateInstallment: jest.fn(),
  deleteInstallment: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { storeReset } from '../repositories/financeiro-store';

function makeNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init));
}

let gatewaysGET: any;
let gatewaysPOST: any;
let gatewayRulesGET: any;
let gatewayRulesPOST: any;
let legacyPaymentsGET: any;
let legacyBudgetsGET: any;
let legacyInstallmentsGET: any;

beforeAll(async () => {
  gatewaysGET = (await import('@/app/api/financeiro/gateways/route')).GET as any;
  gatewaysPOST = (await import('@/app/api/financeiro/gateways/route')).POST as any;
  gatewayRulesGET = (await import('@/app/api/financeiro/gateway-rules/route')).GET as any;
  gatewayRulesPOST = (await import('@/app/api/financeiro/gateway-rules/route')).POST as any;
  legacyPaymentsGET = (await import('@/app/api/budgets/[id]/payments/route')).GET as any;
  legacyBudgetsGET = (await import('@/app/api/budgets/route')).GET as any;
  legacyInstallmentsGET = (await import('@/app/api/budgets/[id]/installments/route')).GET as any;
});

beforeEach(() => {
  storeReset();
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════
// Canonical — gateways (action-gated reads)
// ══════════════════════════════════════════════

describe('GET /api/financeiro/gateways (action-gated)', () => {
  test('returns data array', async () => {
    const res = await gatewaysGET(makeNextRequest('http://localhost/api/financeiro/gateways'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('calls runFinanceiroAction with listarGateways action', async () => {
    const mod = await import('@/modules/financeiro/actions/listar-gateways');
    await gatewaysGET(makeNextRequest('http://localhost/api/financeiro/gateways'));
    expect(mockRunFinanceiroAction).toHaveBeenCalledWith(mod.listarGateways, {});
  });
});

describe('POST /api/financeiro/gateways', () => {
  test('calls runFinanceiroAction with salvarGateway action', async () => {
    const mod = await import('@/modules/financeiro/actions/salvar-gateway');
    const body = JSON.stringify({ provider: 'asaas', apiKey: 'test' });
    await gatewaysPOST(makeNextRequest('http://localhost/api/financeiro/gateways', {
      method: 'POST',
      body,
    }));
    expect(mockRunFinanceiroAction).toHaveBeenCalledWith(mod.salvarGateway, expect.any(Object), { okStatus: 201 });
  });
});

// ══════════════════════════════════════════════
// Canonical — gateway-rules (action-gated reads)
// ══════════════════════════════════════════════

describe('GET /api/financeiro/gateway-rules (action-gated)', () => {
  test('returns data array', async () => {
    const res = await gatewayRulesGET(makeNextRequest('http://localhost/api/financeiro/gateway-rules'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('calls runFinanceiroAction with listarRegrasRoteamento action', async () => {
    const mod = await import('@/modules/financeiro/actions/listar-regras-roteamento');
    await gatewayRulesGET(makeNextRequest('http://localhost/api/financeiro/gateway-rules'));
    expect(mockRunFinanceiroAction).toHaveBeenCalledWith(mod.listarRegrasRoteamento, {});
  });
});

describe('POST /api/financeiro/gateway-rules', () => {
  test('calls runFinanceiroAction with salvarRegraRoteamento action', async () => {
    const mod = await import('@/modules/financeiro/actions/salvar-regra-roteamento');
    await gatewayRulesPOST(makeNextRequest('http://localhost/api/financeiro/gateway-rules', {
      method: 'POST',
      body: '{}',
    }));
    expect(mockRunFinanceiroAction).toHaveBeenCalledWith(mod.salvarRegraRoteamento, expect.any(Object), { okStatus: 201 });
  });
});

// ══════════════════════════════════════════════
// Legacy — budgets list
// ══════════════════════════════════════════════

describe('GET /api/budgets (legacy)', () => {
  test('returns { budgets }', async () => {
    mockListBudgets.mockResolvedValueOnce([{ id: 'b1', clinicId: '00000000-0000-0000-0000-000000000001', title: 'Test' }]);
    const res = await legacyBudgetsGET(makeNextRequest('http://localhost/api/budgets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budgets');
    expect(body.budgets).toHaveLength(1);
  });

  test('returns empty array when no budgets', async () => {
    mockListBudgets.mockResolvedValueOnce([]);
    const res = await legacyBudgetsGET(makeNextRequest('http://localhost/api/budgets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budgets');
    expect(body.budgets).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget payments
// ══════════════════════════════════════════════

describe('GET /api/budgets/[id]/payments (legacy)', () => {
  test('preserves { payments } key shape', async () => {
    mockListPayments.mockResolvedValueOnce([]);
    const res = await legacyPaymentsGET(
      makeNextRequest('http://localhost/api/budgets/b1/payments'),
      { params: Promise.resolve({ id: 'b1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('payments');
    expect(Array.isArray(body.payments)).toBe(true);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget installments
// ══════════════════════════════════════════════

describe('GET /api/budgets/[id]/installments (legacy)', () => {
  test('returns { installments, remaining_balance } shape', async () => {
    mockGetBudgetForClinic.mockResolvedValueOnce({ id: 'b1', clinicId: '00000000-0000-0000-0000-000000000001', finalValue: '900' });
    const res = await legacyInstallmentsGET(
      makeNextRequest('http://localhost/api/budgets/'),
      { params: Promise.resolve({ id: 'b1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('installments');
    expect(body).toHaveProperty('remaining_balance');
  });
});
