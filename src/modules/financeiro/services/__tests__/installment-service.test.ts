/**
 * Tests for installment-service.ts
 */

import { randomUUID } from 'node:crypto';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}));

jest.mock('../../repositories/financeiro-repository', () => ({
  listInstallments: jest.fn(),
  getInstallment: jest.fn(),
  updateInstallment: jest.fn(),
  deleteInstallment: jest.fn(),
  listPaymentsByBudget: jest.fn(),
  getBudget: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('replaceInstallments', () => {
  it('returns empty array when installments input is empty', async () => {
    const result = await replaceInstallments(BUDGET_ID, []);
    expect(result).toEqual([]);
    expect(atomicRepo.replaceInstallmentsAtomic).not.toHaveBeenCalled();
  });

  it('delegates to atomic repo with mapped data', async () => {
    const mockRows = [{ id: 'i1', budgetId: BUDGET_ID, amount: '100.00' }];
    (atomicRepo.replaceInstallmentsAtomic as jest.Mock).mockResolvedValue(mockRows);

    const result = await replaceInstallments(BUDGET_ID, [
      { amount: 100, dueDate: '2026-08-15' },
    ]);

    expect(result).toEqual(mockRows);
    expect(atomicRepo.replaceInstallmentsAtomic).toHaveBeenCalledWith(BUDGET_ID, [
      { budgetId: BUDGET_ID, amount: '100', dueDate: '2026-08-15', status: 'pending' },
    ]);
  });
});

describe('listInstallments', () => {
  it('delegates to repo', async () => {
    const mockRows = [{ id: INSTALLMENT_ID }];
    (repo.listInstallments as jest.Mock).mockResolvedValue(mockRows);
    const result = await listInstallments(BUDGET_ID);
    expect(result).toEqual(mockRows);
    expect(repo.listInstallments).toHaveBeenCalledWith(BUDGET_ID);
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
  it('returns 0 when budget is not found', async () => {
    (repo.getBudget as jest.Mock).mockResolvedValue(null);
    const result = await calculateRemainingBalance(BUDGET_ID);
    expect(result).toBe(0);
  });

  it('returns 0 when budget finalValue is missing', async () => {
    (repo.getBudget as jest.Mock).mockResolvedValue({ finalValue: null });
    (repo.listPaymentsByBudget as jest.Mock).mockResolvedValue([]);
    const result = await calculateRemainingBalance(BUDGET_ID);
    expect(result).toBe(0);
  });

  it('calculates remaining balance correctly', async () => {
    (repo.getBudget as jest.Mock).mockResolvedValue({ finalValue: '500.00' });
    (repo.listPaymentsByBudget as jest.Mock).mockResolvedValue([
      { amount: '100' },
      { amount: '50.50' },
    ]);
    const result = await calculateRemainingBalance(BUDGET_ID);
    expect(result).toBe(349.5);
  });

  it('returns 0 when payments exceed budget', async () => {
    (repo.getBudget as jest.Mock).mockResolvedValue({ finalValue: '100.00' });
    (repo.listPaymentsByBudget as jest.Mock).mockResolvedValue([
      { amount: '200' },
    ]);
    const result = await calculateRemainingBalance(BUDGET_ID);
    expect(result).toBe(0);
  });
});
