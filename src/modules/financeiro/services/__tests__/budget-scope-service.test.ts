jest.mock('../../repositories/financeiro-scope-repository', () => ({
  getBudgetForClinic: jest.fn(),
  updateInstallmentForBudget: jest.fn(),
  deleteInstallmentForBudget: jest.fn(),
}));

import * as scopeSvc from '../budget-scope-service';
import * as scopeRepo from '../../repositories/financeiro-scope-repository';

const BUDGET_ID = 'budget-0000-0000-0000-0001';
const CLINIC_A = 'clinic-a-1111-1111-1111';
const CLINIC_B = 'clinic-b-2222-2222-2222';
const INSTALLMENT_ID = 'inst-0000-0000-0000-0001';
const FOREIGN_INSTALLMENT_ID = 'inst-0000-0000-0000-0009';

const mockBudget = { id: BUDGET_ID, clinicId: CLINIC_A } as any;
const mockInstallment = { id: INSTALLMENT_ID, budgetId: BUDGET_ID, amount: '100.00' } as any;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── getBudgetForClinic ──────────────────────────

describe('getBudgetForClinic', () => {
  it('returns budget when it belongs to the clinic', async () => {
    (scopeRepo.getBudgetForClinic as jest.Mock).mockResolvedValue(mockBudget);
    const result = await scopeSvc.getBudgetForClinic(BUDGET_ID, CLINIC_A);
    expect(result).toEqual(mockBudget);
    expect(scopeRepo.getBudgetForClinic).toHaveBeenCalledWith(BUDGET_ID, CLINIC_A);
  });

  it('returns undefined for budget from another clinic', async () => {
    (scopeRepo.getBudgetForClinic as jest.Mock).mockResolvedValue(undefined);
    const result = await scopeSvc.getBudgetForClinic(BUDGET_ID, CLINIC_B);
    expect(result).toBeUndefined();
  });

  it('returns undefined for non-existent budget', async () => {
    (scopeRepo.getBudgetForClinic as jest.Mock).mockResolvedValue(undefined);
    const result = await scopeSvc.getBudgetForClinic('nonexistent', CLINIC_A);
    expect(result).toBeUndefined();
  });
});

// ── updateInstallmentForBudget ───────────────────

describe('updateInstallmentForBudget', () => {
  const patch = { amount: '150.00' };

  it('updates installment when it belongs to the budget', async () => {
    (scopeRepo.updateInstallmentForBudget as jest.Mock).mockResolvedValue({
      ...mockInstallment, amount: '150.00',
    });
    const result = await scopeSvc.updateInstallmentForBudget(INSTALLMENT_ID, BUDGET_ID, patch);
    expect(result?.amount).toBe('150.00');
    expect(scopeRepo.updateInstallmentForBudget).toHaveBeenCalledWith(INSTALLMENT_ID, BUDGET_ID, patch);
  });

  it('returns undefined for installment not belonging to the budget', async () => {
    (scopeRepo.updateInstallmentForBudget as jest.Mock).mockResolvedValue(undefined);
    const result = await scopeSvc.updateInstallmentForBudget(FOREIGN_INSTALLMENT_ID, BUDGET_ID, patch);
    expect(result).toBeUndefined();
  });

  it('returns undefined for non-existent installment', async () => {
    (scopeRepo.updateInstallmentForBudget as jest.Mock).mockResolvedValue(undefined);
    const result = await scopeSvc.updateInstallmentForBudget('nonexistent', BUDGET_ID, patch);
    expect(result).toBeUndefined();
  });
});

// ── deleteInstallmentForBudget ───────────────────

describe('deleteInstallmentForBudget', () => {
  it('deletes and returns installment when it belongs to the budget', async () => {
    (scopeRepo.deleteInstallmentForBudget as jest.Mock).mockResolvedValue(mockInstallment);
    const result = await scopeSvc.deleteInstallmentForBudget(INSTALLMENT_ID, BUDGET_ID);
    expect(result).toEqual(mockInstallment);
    expect(scopeRepo.deleteInstallmentForBudget).toHaveBeenCalledWith(INSTALLMENT_ID, BUDGET_ID);
  });

  it('returns undefined for installment not belonging to the budget', async () => {
    (scopeRepo.deleteInstallmentForBudget as jest.Mock).mockResolvedValue(undefined);
    const result = await scopeSvc.deleteInstallmentForBudget(FOREIGN_INSTALLMENT_ID, BUDGET_ID);
    expect(result).toBeUndefined();
  });

  it('returns undefined for non-existent installment', async () => {
    (scopeRepo.deleteInstallmentForBudget as jest.Mock).mockResolvedValue(undefined);
    const result = await scopeSvc.deleteInstallmentForBudget('nonexistent', BUDGET_ID);
    expect(result).toBeUndefined();
  });
});
