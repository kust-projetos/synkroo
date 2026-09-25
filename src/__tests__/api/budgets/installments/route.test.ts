jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));
jest.mock('@/core/actions/context', () => ({ buildUserContext: jest.fn() }));
jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  })),
  setDbConnectionString: jest.fn(),
}));
jest.mock('@/core/actions/audit-writer', () => ({
  writeActionLog: jest.fn().mockResolvedValue(undefined),
  allowlistInput: jest.fn((input: any) => input),
}));

const mockGetBudgetForClinic = jest.fn();
const mockUpdateInstallmentForBudget = jest.fn();
const mockDeleteInstallmentForBudget = jest.fn();
const mockGetInstallment = jest.fn();
const mockUpdateInstallment = jest.fn();
const mockDeleteInstallment = jest.fn();

jest.mock('@/modules/financeiro/services/budget-scope-service', () => ({
  getBudgetForClinic: mockGetBudgetForClinic,
  updateInstallmentForBudget: mockUpdateInstallmentForBudget,
  deleteInstallmentForBudget: mockDeleteInstallmentForBudget,
}));
jest.mock('@/modules/financeiro/repositories/financeiro-scope-repository', () => ({
  getBudgetForClinic: (...a: any[]) => mockGetBudgetForClinic(...a),
}));
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudgetForClinic: (...a: any[]) => mockGetBudgetForClinic(...a),
  listBudgets: jest.fn(),
  createBudget: jest.fn(),
  getBudget: jest.fn(),
}));
jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => {
  const actual = jest.requireActual('@/modules/financeiro/repositories/financeiro-repository');
  return {
    ...actual,
    getInstallment: (...a: any[]) => mockGetInstallment(...a),
    updateInstallment: (...a: any[]) => mockUpdateInstallment(...a),
    deleteInstallment: (...a: any[]) => mockDeleteInstallment(...a),
  };
});

const mockSalvarParcelasHandler = jest.fn();

jest.mock('@/modules/financeiro/actions/salvar-parcelas', () => ({
  salvarParcelas: {
    name: 'financeiro.salvarParcelas',
    module: 'financeiro',
    requires: 'financeiro:manage_budget',
    label: 'Salvar parcelas',
    input: require('zod').z.any(),
    handler: (...args: any[]) => mockSalvarParcelasHandler(...args),
  },
}));

const mockListInstallments = jest.fn(async (clinicId: string, budgetId: string) => {
  const budget = await mockGetBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    const { ActionError } = await import('@/core/actions/types');
    throw new ActionError('not_found', 'Budget not found');
  }
  return [{ id: '00000000-0000-0000-0000-000000000002', amount: '100.00' }];
});
const mockCalculateRemainingBalance = jest.fn(async (clinicId: string, budgetId: string) => {
  const budget = await mockGetBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    const { ActionError } = await import('@/core/actions/types');
    throw new ActionError('not_found', 'Budget not found');
  }
  return 250;
});
const mockReplaceInstallments = jest.fn(async (clinicId: string, budgetId: string, installments: any[]) => {
  const budget = await mockGetBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    const { ActionError } = await import('@/core/actions/types');
    throw new ActionError('not_found', 'Budget not found');
  }
  return installments.map((inst: any, i: number) => ({ id: `new-${i}`, ...inst }));
});

jest.mock('@/modules/financeiro/services/installment-service', () => ({
  listInstallments: (...a: any[]) => (mockListInstallments as unknown as (...args: any[]) => any)(...a),
  calculateRemainingBalance: (...a: any[]) => (mockCalculateRemainingBalance as unknown as (...args: any[]) => any)(...a),
  replaceInstallments: (...a: any[]) => (mockReplaceInstallments as unknown as (...args: any[]) => any)(...a),
}));

jest.mock('@/lib/errors', () => {
  class MockValidationError extends Error {
    status = 400;
    issues: any[];
    constructor(m: string, opts?: any) { super(m); this.issues = opts?.issues ?? []; }
  }
  return {
    ValidationError: MockValidationError,
  };
});

import { GET, POST, PATCH, DELETE } from '@/app/api/budgets/[id]/installments/route';
import { validateApiAuth } from '@/lib/auth/session';

const CLINIC_A = '11111111-1111-1111-1111-111111111111';
const CLINIC_B = '22222222-2222-2222-2222-222222222222';
const BUDGET_ID = '00000000-0000-0000-0000-000000000001';
const INSTALLMENT_ID = '00000000-0000-0000-0000-000000000002';
const FOREIGN_BUDGET_ID = '00000000-0000-0000-0000-000000000009';
const FOREIGN_INSTALLMENT_ID = '00000000-0000-0000-0000-000000000010';

function auth(clinicId = CLINIC_A) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  });
  const { buildUserContext } = require('@/core/actions/context');
  (buildUserContext as jest.Mock).mockResolvedValue({
    clinicId,
    user: { id: 'user-1', email: 'test@test.local', name: 'Test' },
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'user-1' },
    source: 'user',
  });
}

function authFail() {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: false,
    error: { message: 'Unauthorized', status: 401 },
  });
  const { buildUserContext } = require('@/core/actions/context');
  (buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'));
}

const routeParams = { params: Promise.resolve({ id: BUDGET_ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBudgetForClinic.mockReset();
  // Re-apply the installment mocks that check getBudgetForClinic
  mockListInstallments.mockImplementation(async (clinicId: string, budgetId: string) => {
    const budget = await mockGetBudgetForClinic(budgetId, clinicId);
    if (!budget) {
      const { ActionError } = await import('@/core/actions/types');
      throw new ActionError('not_found', 'Budget not found');
    }
    return [{ id: '00000000-0000-0000-0000-000000000002', amount: '100.00' }];
  });
  mockCalculateRemainingBalance.mockImplementation(async (clinicId: string, budgetId: string) => {
    const budget = await mockGetBudgetForClinic(budgetId, clinicId);
    if (!budget) {
      const { ActionError } = await import('@/core/actions/types');
      throw new ActionError('not_found', 'Budget not found');
    }
    return 250;
  });
  mockReplaceInstallments.mockImplementation(async (clinicId: string, budgetId: string, installments: any[]) => {
    const budget = await mockGetBudgetForClinic(budgetId, clinicId);
    if (!budget) {
      const { ActionError } = await import('@/core/actions/types');
      throw new ActionError('not_found', 'Budget not found');
    }
    return installments.map((inst: any, i: number) => ({ id: `new-${i}`, ...inst }));
  });
  mockSalvarParcelasHandler.mockImplementation(async (input: any, ctx: any) => {
    const budget = await mockGetBudgetForClinic(input.budgetId, ctx.clinicId);
    if (!budget) {
      const { ActionError } = await import('@/core/actions/types');
      throw new ActionError('not_found', 'Budget not found');
    }
    const saved = await mockReplaceInstallments(ctx.clinicId, input.budgetId, input.installments ?? []);
    return { data: saved };
  });
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
    mockGetBudgetForClinic.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('returns 404 when budget belongs to another clinic', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('returns installments and remaining balance', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockListInstallments.mockResolvedValue([{ id: INSTALLMENT_ID, amount: '100.00' }]);
    mockCalculateRemainingBalance.mockResolvedValue(250);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installments).toHaveLength(1);
    expect(body.remaining_balance).toBe(250);
  });

  it('falls back to 0 when remaining balance is null', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockCalculateRemainingBalance.mockResolvedValue(null as any);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining_balance).toBe(0);
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
    mockGetBudgetForClinic.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await POST(req as any, foreignParams as any);
    expect(res.status).toBe(404);
  });

  it('creates installments and returns 201', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
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

  it('returns 404 when budget belongs to another clinic (POST)', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('serializes non-array saved payload as empty installments list', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockSalvarParcelasHandler.mockResolvedValue({ data: { saved: true, count: 2 } });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST',
      body: JSON.stringify({ installments: [{ amount: 100, due_date: '2026-08-15' }] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.installments).toEqual([]);
  });

  it('returns 404 when budget not found (GET)', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments');
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await GET(req as any, foreignParams as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid input', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments', {
      method: 'POST', body: JSON.stringify({ installments: [] }),
    });
    const res = await POST(req as any, routeParams as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when budget belongs to another clinic (GET)', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(null);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments');
    const res = await GET(req as any, routeParams as any);
    expect(res.status).toBe(404);
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

  it('returns 400 for invalid input body', async () => {
    auth();
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 'not-a-number' }),
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
    mockGetInstallment.mockResolvedValue(undefined as any);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + FOREIGN_INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(404);
  });

  it('updates own installment and returns it', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockGetInstallment.mockResolvedValue({ id: INSTALLMENT_ID, budgetId: BUDGET_ID } as any);
    mockUpdateInstallment.mockResolvedValue({ id: INSTALLMENT_ID, budgetId: BUDGET_ID, amount: '150.00' } as any);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ amount: 150 }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installment.id).toBe(INSTALLMENT_ID);
  });

  it('updates only due_date when amount is absent', async () => {
    auth();
    mockGetBudgetForClinic.mockResolvedValue({ id: BUDGET_ID, clinicId: CLINIC_A });
    mockGetInstallment.mockResolvedValue({ id: INSTALLMENT_ID, budgetId: BUDGET_ID } as any);
    mockUpdateInstallment.mockResolvedValue({ id: INSTALLMENT_ID, budgetId: BUDGET_ID, dueDate: '2026-09-01' } as any);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH', body: JSON.stringify({ due_date: '2026-09-01' }),
    });
    const res = await PATCH(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installment.dueDate).toBe('2026-09-01');
  });

  it('ignores forged clinicId in PATCH body, uses auth clinicId for scope', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    // Route does not read clinicId from body
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150, clinicId: CLINIC_B }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await PATCH(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    // Budget lookup used auth clinicId (CLINIC_A), not CLINIC_B
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(FOREIGN_BUDGET_ID, CLINIC_A);
  });

  it('ignores forged clinicId in PATCH header, uses auth clinicId for scope', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'PATCH',
      headers: { 'x-clinic-id': CLINIC_B },
      body: JSON.stringify({ amount: 150 }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await PATCH(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(FOREIGN_BUDGET_ID, CLINIC_A);
  });

  it('ignores forged clinicId in PATCH query, uses auth clinicId for scope', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID + '&clinicId=' + CLINIC_B, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 150 }),
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await PATCH(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(FOREIGN_BUDGET_ID, CLINIC_A);
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
    mockGetInstallment.mockResolvedValue({ id: INSTALLMENT_ID, budgetId: BUDGET_ID } as any);
    mockDeleteInstallment.mockResolvedValue(undefined as any);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, { method: 'DELETE' });
    const res = await DELETE(req as any, routeParams as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('ignores forged clinicId in DELETE query, uses auth clinicId for scope', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    // DELETE reads installment_id from query, not clinicId
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID + '&clinicId=' + CLINIC_B, { method: 'DELETE' });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await DELETE(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(FOREIGN_BUDGET_ID, CLINIC_A);
  });

  it('ignores forged clinicId in DELETE header, uses auth clinicId for scope', async () => {
    auth(CLINIC_A);
    mockGetBudgetForClinic.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/budgets/' + FOREIGN_BUDGET_ID + '/installments?installment_id=' + INSTALLMENT_ID, {
      method: 'DELETE',
      headers: { 'x-clinic-id': CLINIC_B },
    });
    const foreignParams = { params: Promise.resolve({ id: FOREIGN_BUDGET_ID }) };
    const res = await DELETE(req as any, foreignParams as any);
    expect(res.status).toBe(404);
    expect(mockGetBudgetForClinic).toHaveBeenCalledWith(FOREIGN_BUDGET_ID, CLINIC_A);
  });
});
