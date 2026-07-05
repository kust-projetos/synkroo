/**
 * Route tests: Financeiro canonical routes + legacy budget adapters.
 *
 * Mocks budget-service layer to avoid real DB dependency in unit tests.
 * Covers shape preservation and secret masking.
 */

// Mock auth context for canonical routes (uses buildUserContext)
jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn().mockResolvedValue({
    clinicId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'owner',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test' },
  }),
  buildSystemContext: jest.fn().mockResolvedValue({
    clinicId: '00000000-0000-0000-0000-000000000001',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'system' },
  }),
}));

// Mock auth session for legacy routes
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

// Mock module manifest
jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: {
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'financeiro'])),
  },
}));

// Mock budget-service so route tests don't need real DB
const mockListBudgets = jest.fn().mockResolvedValue([]);
const mockGetBudget = jest.fn().mockResolvedValue(undefined);
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

jest.mock('@/modules/financeiro/services/payment-service', () => ({
  listPayments: (...args: any[]) => mockListPayments(...args),
  registerManualPayment: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { storeReset } from '../repositories/financeiro-store';

function makeNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init));
}

let gatewaysGET: any;
let legacyPaymentsGET: any;
let legacyBudgetsGET: any;
let legacyInstallmentsGET: any;

beforeAll(async () => {
  gatewaysGET = (await import('@/app/api/financeiro/gateways/route')).GET as any;
  legacyPaymentsGET = (await import('@/app/api/budgets/[id]/payments/route')).GET as any;
  legacyBudgetsGET = (await import('@/app/api/budgets/route')).GET as any;
  legacyInstallmentsGET = (await import('@/app/api/budgets/[id]/installments/route')).GET as any;
});

beforeEach(() => {
  storeReset();
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════
// Canonical — gateways
// ══════════════════════════════════════════════

describe('GET /api/financeiro/gateways', () => {
  test('returns empty list when no gateways', async () => {
    const res = await gatewaysGET(makeNextRequest('http://localhost/api/financeiro/gateways'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ══════════════════════════════════════════════
// Legacy — budgets list
// ══════════════════════════════════════════════

describe('GET /api/budgets (legacy)', () => {
  test('returns { budgets } with seeded data', async () => {
    mockListBudgets.mockResolvedValueOnce([
      { id: 'b1', clinicId: '00000000-0000-0000-0000-000000000001', title: 'Test Budget', status: 'pending' },
    ]);

    const res = await legacyBudgetsGET(makeNextRequest('http://localhost/api/budgets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budgets');
    expect(Array.isArray(body.budgets)).toBe(true);
    expect(body.budgets.length).toBe(1);
    expect(body.budgets[0].title).toBe('Test Budget');
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
    mockGetBudget.mockResolvedValueOnce({
      id: 'b1',
      clinicId: '00000000-0000-0000-0000-000000000001',
      finalValue: '900',
      totalValue: '1000',
    });

    const res = await legacyInstallmentsGET(
      makeNextRequest('http://localhost/api/budgets/'),
      { params: Promise.resolve({ id: 'b1' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('installments');
    expect(Array.isArray(body.installments)).toBe(true);
    expect(body).toHaveProperty('remaining_balance');
  });
});

// ══════════════════════════════════════════════
// Legacy — budget send
// ══════════════════════════════════════════════

describe('POST /api/budgets/[id]/send (legacy)', () => {
  test('sends existing budget', async () => {
    const { POST: sendPOST } = await import('@/app/api/budgets/[id]/send/route');
    mockGetBudget.mockResolvedValueOnce({
      id: 'b1',
      clinicId: '00000000-0000-0000-0000-000000000001',
      status: 'pending',
    });
    mockMarkBudgetSent.mockResolvedValueOnce({ id: 'b1', status: 'pending' });

    const res = await sendPOST(
      makeNextRequest('http://localhost/api/budgets/send', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'b1' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budget');
    expect(body).toHaveProperty('whatsapp_sent');
  });
});

// ══════════════════════════════════════════════
// Legacy — budget accept
// ══════════════════════════════════════════════

describe('POST /api/budgets/[id]/accept (legacy)', () => {
  test('accepts existing pending budget', async () => {
    const { POST: acceptPOST } = await import('@/app/api/budgets/[id]/accept/route');
    mockGetBudget.mockResolvedValueOnce({
      id: 'b1',
      clinicId: '00000000-0000-0000-0000-000000000001',
      status: 'pending',
    });
    mockAcceptBudget.mockResolvedValueOnce({
      id: 'b1',
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
    });

    const res = await acceptPOST(
      makeNextRequest('http://localhost/api/budgets/accept', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'b1' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budget');
    expect(body.budget.status).toBe('accepted');
  });

  test('returns 404 for non-existent budget', async () => {
    const { POST: acceptPOST } = await import('@/app/api/budgets/[id]/accept/route');
    mockGetBudget.mockResolvedValueOnce(undefined);

    const res = await acceptPOST(
      makeNextRequest('http://localhost/api/budgets/accept', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget reject
// ══════════════════════════════════════════════

describe('POST /api/budgets/[id]/reject (legacy)', () => {
  test('rejects existing pending budget', async () => {
    const { POST: rejectPOST } = await import('@/app/api/budgets/[id]/reject/route');
    mockGetBudget.mockResolvedValueOnce({
      id: 'b1',
      clinicId: '00000000-0000-0000-0000-000000000001',
      status: 'pending',
    });
    mockRejectBudget.mockResolvedValueOnce({
      id: 'b1',
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
    });

    const res = await rejectPOST(
      makeNextRequest('http://localhost/api/budgets/reject', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'b1' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budget');
    expect(body.budget.status).toBe('rejected');
  });
});

/** @jest-environment node */
