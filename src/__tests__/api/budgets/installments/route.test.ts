jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

const mockGetBudgetForClinic = jest.fn();
const mockUpdateInstallmentForBudget = jest.fn();
const mockDeleteInstallmentForBudget = jest.fn();

jest.mock('@/modules/financeiro/services/budget-scope-service', () => ({
  getBudgetForClinic: mockGetBudgetForClinic,
  updateInstallmentForBudget: mockUpdateInstallmentForBudget,
  deleteInstallmentForBudget: mockDeleteInstallmentForBudget,
}));

const mockGetBudget = jest.fn();
const mockListInstallments = jest.fn();
const mockCalculateRemainingBalance = jest.fn();
const mockReplaceInstallments = jest.fn();

jest.mock('@/modules/financeiro/services/installment-service', () => ({
  listInstallments: (...a: any[]) => mockListInstallments(...a),
  calculateRemainingBalance: (...a: any[]) => mockCalculateRemainingBalance(...a),
  replaceInstallments: (...a: any[]) => mockReplaceInstallments(...a),
}));

jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudget: (...a: any[]) => mockGetBudget(...a),
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

import { GET, POST, PATCH, DELETE } from '@/app/api/budgets/[id]/installments/route';
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
});

// ── GET ────────────────────────────────────────

describe('GET /api/budgets/[id]/installments', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when budget does not exist', async () => {
    auth();
    mockGetBudget.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('returns 403 when budget belongs to another clinic', async () => {
    auth(CLINIC_A);
    mockGetBudget.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_B });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(403);
  });

  it('returns installments and remaining balance', async () => {
    auth();
    mockGetBudget.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockListInstallments.mockResolvedValue([{ id: INSTALLMENT_ID, amount: '100.00' }]);
    mockCalculateRemainingBalance.mockResolvedValue(250);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installments).toHaveLength(1);
    expect(body.remaining_balance).toBe(250);
  });
});

// ── POST ───────────────────────────────────────

describe('POST /api/budgets/[id]/installments', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when budget does not exist', async () => {
    auth();
    mockGetBudget.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await POST(req as any, foreignParams as any);
    expect(res.status).toBe(404);
  });

  it('creates installments and returns 201', async () => {
    auth();
    mockGetBudget.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockReplaceInstallments.mockResolvedValue([{ id: 'new-1', amount: '100.00' }]);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST',
      body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.installments).toHaveLength(1);
  });

  it('returns 403 when budget belongs to another clinic (POST)', async () => {
    auth(CLINIC_A);
    mockGetBudget.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_B });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(403);
  });

  it('returns 404 when budget not found (GET)', async () => {
    auth();
    mockGetBudget.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments');
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await GET(req as any, foreignParams as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid input', async () => {
    auth();
    mockGetBudget.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 when budget belongs to another clinic (GET)', async () => {
    auth(CLINIC_A);
    mockGetBudget.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_B });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(403);
  });
});

// ── PATCH ──────────────────────────────────────

describe('PATCH /api/budgets/[id]/installments', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when installment_id is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when budget does not belong to clinic', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await PATCH(req as any, foreignParams as any);
    expect(res.status).toBe(404);
  });

  it('returns 404 when installment not found', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockUpdateInstallmentForBudget.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + FOREIGN_INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('updates own installment and returns it', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockUpdateInstallmentForBudget.mockResolvedValue({ id: INSTALLMENT_ID, budgetId: BUDGET_ID, amount: '150.00' });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installment.id).toBe(INSTALLMENT_ID);
  });
});

// ── DELETE ─────────────────────────────────────

describe('DELETE /api/budgets/[id]/installments', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, { method: 'DELETE' });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when installment_id is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', { method: 'DELETE' });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when budget not found', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, { method: 'DELETE' });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await DELETE(req as any, foreignParams as any);
    expect(res.status).toBe(404);
  });

  it('deletes own installment and returns success', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockDeleteInstallmentForBudget.mockResolvedValue({ id: INSTALLMENT_ID });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, { method: 'DELETE' });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
