/**
 * Tests for installment-service.ts
 */

import { randomUUID } from 'node:crypto';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}));

jest.mock('../../repositories/financeiro-repository', () => ({
  listInstallments: jest.fn(),
  listInstallmentsForClinic: jest.fn(),
  getInstallment: jest.fn(),
  updateInstallment: jest.fn(),
  deleteInstallment: jest.fn(),
  listPaymentsByBudget: jest.fn(),
  listPaymentsByBudgetForClinic: jest.fn(),
  getBudget: jest.fn(),
  getBudgetForClinic: jest.fn(),
}));

jest.mock('../../repositories/financeiro-scope-repository', () => ({
  getBudgetForClinic: jest.fn(),
}));

jest.mock('../../repositories/installment-replacement-repository', () => ({
  replaceInstallmentsAtomic: jest.fn(),
}));

import {
  replaceInstallments,
  listInstallments,
  calculateRemainingBalance,
  getInstallment,
  updateInstallment,
  deleteInstallment,
} from '../installment-service';
import * as repo from '../../repositories/financeiro-repository';
import * as atomicRepo from '../../repositories/installment-replacement-repository';

const BUDGET_ID = randomUUID();
const INSTALLMENT_ID = randomUUID();
const CLINIC_ID = randomUUID();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('replaceInstallments', () => {
  it('returns empty array when installments input is empty but still validates tenant via atomic', async () => {
    (atomicRepo.replaceInstallmentsAtomic as jest.Mock).mockResolvedValue([]);
    const result = await replaceInstallments(CLINIC_ID, BUDGET_ID, []);
    expect(result).toEqual([]);
    expect(atomicRepo.replaceInstallmentsAtomic).toHaveBeenCalledWith(CLINIC_ID, BUDGET_ID, []);
  });

  it('delegates to atomic repo with mapped data and tenant', async () => {
    const mockRows = [{ id: 'i1', budgetId: BUDGET_ID, amount: '100.00' }];
    (atomicRepo.replaceInstallmentsAtomic as jest.Mock).mockResolvedValue(mockRows);

    const result = await replaceInstallments(CLINIC_ID, BUDGET_ID, [
      { amount: 100, dueDate: '2026-08-15' },
    ]);

    expect(result).toEqual(mockRows);
    expect(atomicRepo.replaceInstallmentsAtomic).toHaveBeenCalledWith(CLINIC_ID, BUDGET_ID, [
      { budgetId: BUDGET_ID, amount: '100', dueDate: '2026-08-15', status: 'pending' },
    ]);
  });
});

describe('listInstallments', () => {
  it('throws not_found when budget not in clinic and delegates to repo when found', async () => {
    const scopeRepo = await import('../../repositories/financeiro-scope-repository');
    (scopeRepo.getBudgetForClinic as jest.Mock).mockResolvedValueOnce(null);
    await expect(listInstallments(CLINIC_ID, BUDGET_ID)).rejects.toMatchObject({ code: 'not_found' });

    (scopeRepo.getBudgetForClinic as jest.Mock).mockResolvedValueOnce({ id: BUDGET_ID, clinicId: CLINIC_ID });
    const mockRows = [{ id: INSTALLMENT_ID }];
    (repo.listInstallmentsForClinic as jest.Mock).mockResolvedValue(mockRows);
    const result = await listInstallments(CLINIC_ID, BUDGET_ID);
    expect(result).toEqual(mockRows);
    expect(repo.listInstallmentsForClinic).toHaveBeenCalledWith(CLINIC_ID, BUDGET_ID);
  });
});

describe('getInstallment', () => {
  it('delegates to repo', async () => {
    const mockRow = { id: INSTALLMENT_ID };
    (repo.getInstallment as jest.Mock).mockResolvedValue(mockRow);
    const result = await getInstallment(INSTALLMENT_ID);
    expect(result).toEqual(mockRow);
    expect(repo.getInstallment).toHaveBeenCalledWith(INSTALLMENT_ID);
  });
});

describe('updateInstallment', () => {
  it('delegates to repo with patch', async () => {
    const patch = { amount: '150.00' };
    const mockRow = { id: INSTALLMENT_ID, amount: '150.00' };
    (repo.updateInstallment as jest.Mock).mockResolvedValue(mockRow);
    const result = await updateInstallment(INSTALLMENT_ID, patch);
    expect(result).toEqual(mockRow);
    expect(repo.updateInstallment).toHaveBeenCalledWith(INSTALLMENT_ID, patch);
  });
});

describe('deleteInstallment', () => {
  it('delegates to repo', async () => {
    await deleteInstallment(INSTALLMENT_ID);
    expect(repo.deleteInstallment).toHaveBeenCalledWith(INSTALLMENT_ID);
  });
});

describe('calculateRemainingBalance', () => {
  it('throws not_found when budget not in clinic', async () => {
    (repo.getBudgetForClinic as jest.Mock).mockResolvedValue(null);
    await expect(calculateRemainingBalance(CLINIC_ID, BUDGET_ID)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('returns 0 when budget finalValue is missing', async () => {
    (repo.getBudgetForClinic as jest.Mock).mockResolvedValue({ finalValue: null });
    (repo.listPaymentsByBudgetForClinic as jest.Mock).mockResolvedValue([]);
    const result = await calculateRemainingBalance(CLINIC_ID, BUDGET_ID);
    expect(result).toBe(0);
  });

  it('calculates remaining balance correctly', async () => {
    (repo.getBudgetForClinic as jest.Mock).mockResolvedValue({ finalValue: '500.00' });
    (repo.listPaymentsByBudgetForClinic as jest.Mock).mockResolvedValue([
      { amount: '100' },
      { amount: '50.50' },
    ]);
    const result = await calculateRemainingBalance(CLINIC_ID, BUDGET_ID);
    expect(result).toBe(349.5);
  });

  it('returns 0 when payments exceed budget', async () => {
    (repo.getBudgetForClinic as jest.Mock).mockResolvedValue({ finalValue: '100.00' });
    (repo.listPaymentsByBudgetForClinic as jest.Mock).mockResolvedValue([
      { amount: '200' },
    ]);
    const result = await calculateRemainingBalance(CLINIC_ID, BUDGET_ID);
    expect(result).toBe(0);
  });
});
