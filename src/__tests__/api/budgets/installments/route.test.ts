jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

const mockGetBudgetForClinic = jest.fn();
const mockUpdateInstallmentForBudget = jest.fn();
const mockDeleteInstallmentForBudget = jest.fn();

jest.mock('@/modules/financeiro/services/budget-scope-service', () => ({
  getBudgetForClinic: mockGetBudgetForClinic,
  updateInstallmentForBudget: mockUpdateInstallmentForBudget,
  deleteInstallmentForBudget: mockDeleteInstallmentForBudget,
}));

jest.mock('@/lib/errors', () => {
  class MockValidationError extends Error {
    status = 400;
    issues: any[];
    constructor(m: string, opts?: any) { super(m); this.issues = opts?.issues ?? []; }
  }
  return {
    handleApiError: jest.fn((err: any) => {
      const s = err.status || 500;
      return { status: s, json: () => Promise.resolve({ error: err.message }) } as any;
    }),
    ValidationError: MockValidationError,
  };
});

import { PATCH, DELETE } from '@/app/api/budgets/[id]/installments/route';
import { validateApiAuth } from '@/lib/auth/session';

const CLINIC_A = 'clinic-a-1111-1111-1111';
const CLINIC_B = 'clinic-b-2222-2222-2222';
const BUDGET_ID = 'budget-0000-0000-0000-0001';
const INSTALLMENT_ID = 'inst-0000-0000-0000-0001';
const FOREIGN_BUDGET_ID = 'budget-0000-0000-0000-0009';
const FOREIGN_INSTALLMENT_ID = 'inst-0000-0000-0000-0009';

function auth(clinicId = CLINIC_A) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  });
}

function authFail() {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: false,
    error: { message: 'Unauthorized', status: 401 },
  });
}

const routeParams = { params: Promise.resolve({ id: BUDGET_ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBudgetForClinic.mockReset();
  mockUpdateInstallmentForBudget.mockReset();
  mockDeleteInstallmentForBudget.mockReset();
});

// ── PATCH ──────────────────────────────────────

describe('PATCH /api/budgets/[id]/installments', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when installment_id query param is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when budget does not belong to the clinic', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined); // foreign budget

    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150 }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await PATCH(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(FOREIGN_BUDGET_ID, CLINIC_A);
    // Mutation should NOT be called
    expect(mockUpdateInstallmentForBudget).not.toHaveBeenCalled();
  });

  it('returns 404 when installment does not belong to the budget (cross-budget)', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockUpdateInstallmentForBudget.mockResolvedValue(undefined); // installment not under this budget

    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + FOREIGN_INSTALLMENT_ID, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(404);
    expect(mockUpdateInstallmentForBudget).toHaveBeenCalledWith(FOREIGN_INSTALLMENT_ID, BUDGET_ID, expect.any(Object));
  });

  it('returns 404 when installment does not exist', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockUpdateInstallmentForBudget.mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('updates own installment and returns it', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockUpdateInstallmentForBudget.mockResolvedValue({
      id: INSTALLMENT_ID, budgetId: BUDGET_ID, amount: '150.00', dueDate: '2026-08-15',
    });

    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150, due_date: '2026-08-15' }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installment).toBeDefined();
    expect(body.installment.id).toBe(INSTALLMENT_ID);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(BUDGET_ID, CLINIC_A);
    expect(mockUpdateInstallmentForBudget).toHaveBeenCalled();
  });
});

// ── DELETE ──────────────────────────────────────

describe('DELETE /api/budgets/[id]/installments', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'DELETE',
    });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when installment_id query param is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'DELETE',
    });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when budget does not belong to the clinic', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'DELETE',
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await DELETE(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    expect(mockDeleteInstallmentForBudget).not.toHaveBeenCalled();
  });

  it('returns 404 when installment does not belong to the budget', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockDeleteInstallmentForBudget.mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + FOREIGN_INSTALLMENT_ID, {
      method: 'DELETE',
    });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(404);
    expect(mockDeleteInstallmentForBudget).toHaveBeenCalledWith(FOREIGN_INSTALLMENT_ID, BUDGET_ID);
  });

  it('deletes own installment and returns success', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockDeleteInstallmentForBudget.mockResolvedValue({
      id: INSTALLMENT_ID, budgetId: BUDGET_ID,
    });

    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'DELETE',
    });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(BUDGET_ID, CLINIC_A);
    expect(mockDeleteInstallmentForBudget).toHaveBeenCalledWith(INSTALLMENT_ID, BUDGET_ID);
  });
});
