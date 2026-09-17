/**
 * Etapa 5.1/5.2 — financial precision contract (test-first).
 *
 * Exact decimal semantics, half-up at the cent level:
 *  (a) budget totals free of binary-float artifacts (3×0.1, 10×1.005,
 *      0.1+0.2 class cases);
 *  (b) installment split sums EXACTLY to the total, remainder to first parts;
 *  (c) charge amount-vs-budget comparison in cents (legacy 1-cent tolerance
 *      preserved, provable without float error);
 *  (d) remaining-balance regression (exact expectations).
 */

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}));

jest.mock('../../repositories/financeiro-repository', () => ({
  getBudgetForClinic: jest.fn(),
  listPaymentsByBudgetForClinic: jest.fn(),
}));

jest.mock('../../repositories/financeiro-scope-repository', () => ({
  getBudgetForClinic: jest.fn(),
}));

jest.mock('../../repositories/installment-replacement-repository', () => ({
  replaceInstallmentsAtomic: jest.fn(),
}));

import { calculateBudgetTotals } from '../budget-service';
import { calculateRemainingBalance, splitTotalIntoInstallments } from '../installment-service';
import { chargeAmountMatchesBudget } from '../charge-service';
import * as repo from '../../repositories/financeiro-repository';

const CLINIC = 'clinic-precision';
const BUDGET = 'budget-precision';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Etapa 5.1 — budget totals (exact decimal, half-up)', () => {
  it('3 × 0.1 totals exactly 0.30 (no 0.30000000000000004)', () => {
    const t = calculateBudgetTotals([{ procedureName: 'X', quantity: 3, unitPrice: 0.1 }]);
    expect(t.totalValue).toBe(0.3);
    expect(t.finalValue).toBe(0.3);
  });

  it('0.1 + 0.2 class case totals exactly 0.30', () => {
    const t = calculateBudgetTotals([
      { procedureName: 'A', quantity: 1, unitPrice: 0.1 },
      { procedureName: 'B', quantity: 1, unitPrice: 0.2 },
    ]);
    expect(t.totalValue).toBe(0.3);
  });

  it('10 × 1.005 totals exactly 10.05 (millesimal unit price, single rounding)', () => {
    const t = calculateBudgetTotals([{ procedureName: 'X', quantity: 10, unitPrice: 1.005 }]);
    expect(t.totalValue).toBe(10.05);
  });

  it('discount is half-up at cent level: 10% of 0.30 → 0.03 discount, 0.27 final', () => {
    const t = calculateBudgetTotals(
      [{ procedureName: 'X', quantity: 3, unitPrice: 0.1 }],
      10,
    );
    expect(t.discountValue).toBe(0.03);
    expect(t.finalValue).toBe(0.27);
  });

  it('sanity: integer totals unchanged (300 − 10% = 270)', () => {
    const t = calculateBudgetTotals([
      { procedureName: 'A', quantity: 2, unitPrice: 50 },
      { procedureName: 'B', quantity: 1, unitPrice: 200 },
    ], 10);
    expect(t.totalValue).toBe(300);
    expect(t.discountValue).toBe(30);
    expect(t.finalValue).toBe(270);
  });
});

describe('Etapa 5.2 — installment split sums EXACTLY to total', () => {
  it('100.00 / 3 → [33.34, 33.33, 33.33], remainder on first', () => {
    const parts = splitTotalIntoInstallments('100.00', 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it('0.10 / 3 sums exactly to 0.10 (no lost cent)', () => {
    const parts = splitTotalIntoInstallments('0.10', 3);
    expect(parts).toHaveLength(3);
    // Sum in cents is exact: 4 + 3 + 3
    expect(parts).toEqual([0.04, 0.03, 0.03]);
  });

  it('even split has zero remainder drift (900 / 3)', () => {
    expect(splitTotalIntoInstallments('900.00', 3)).toEqual([300, 300, 300]);
  });

  it('rejects count < 1', () => {
    expect(() => splitTotalIntoInstallments('100.00', 0)).toThrow();
  });
});

describe('Etapa 5.2 — charge tolerance in cents', () => {
  it('exact match passes', () => {
    expect(chargeAmountMatchesBudget(100, '100.00')).toBe(true);
  });

  it('1-cent difference passes (legacy tolerance, now provable in cents)', () => {
    // Float impl: |100.01 − 100| = 0.010000000000005116 > 0.01 → wrongly rejects.
    expect(chargeAmountMatchesBudget(100.01, '100.00')).toBe(true);
  });

  it('2-cent difference fails', () => {
    expect(chargeAmountMatchesBudget(100.02, '100.00')).toBe(false);
  });

  it('large divergence fails', () => {
    expect(chargeAmountMatchesBudget(100, '200.00')).toBe(false);
  });
});

describe('Etapa 5.2 — remaining balance (cents regression)', () => {
  function mockLedger(finalValue: string, payments: string[]) {
    (repo.getBudgetForClinic as jest.Mock).mockResolvedValue({ finalValue });
    (repo.listPaymentsByBudgetForClinic as jest.Mock).mockResolvedValue(
      payments.map((amount) => ({ amount })),
    );
  }

  it('0.30 − (0.10 + 0.20) = exactly 0', async () => {
    mockLedger('0.30', ['0.10', '0.20']);
    await expect(calculateRemainingBalance(CLINIC, BUDGET)).resolves.toBe(0);
  });

  it('500.00 − (100 + 50.50) = 349.50', async () => {
    mockLedger('500.00', ['100', '50.50']);
    await expect(calculateRemainingBalance(CLINIC, BUDGET)).resolves.toBe(349.5);
  });

  it('floors at 0 on overpayment', async () => {
    mockLedger('100.00', ['200']);
    await expect(calculateRemainingBalance(CLINIC, BUDGET)).resolves.toBe(0);
  });
});
