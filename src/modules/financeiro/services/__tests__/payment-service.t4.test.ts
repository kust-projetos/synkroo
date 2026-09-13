/**
 * T4 unit — payment-service forward-only balance and decimal safety
 * Adversarial: concurrent overpayment, zero/negative, cross-tenant, partial
 */

const mockGetDb = jest.fn();
jest.mock('@/lib/db/client', () => ({ getDb: () => mockGetDb(), closeDb: jest.fn() }));
jest.mock('../../repositories/financeiro-scope-repository', () => ({
  getBudgetForClinic: jest.fn(),
}));

import { registerManualPayment } from '../payment-service';
import { getBudgetForClinic } from '../../repositories/financeiro-scope-repository';

const CLINIC_A = 'clinic-a';
const BUDGET_ID = 'budget-1';
const CHARGE_ID = 'charge-1';
const USER_A = 'user-a';

function toCents(v: string | number): bigint {
  const s = typeof v === 'number' ? v.toFixed(2) : String(v);
  const [i, d = ''] = s.split('.');
  return BigInt(i) * 100n + BigInt((d + '00').slice(0, 2));
}

function mockTxForBudget(budget: any, existingPayments: any[], pendingInstallments: any[] = []) {
  // Import tables for reference comparison (avoid string matching)
  const { budgets: budgetsTable, payments: paymentsTable, paymentCharges: chargesTable, budgetInstallments: installmentsTable } = require('../../schema/financeiro');
  const mockDb: any = {
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation((table: any) => {
        let data: any[] = [];
        if (table === budgetsTable) data = budget ? [budget] : [];
        else if (table === paymentsTable) data = existingPayments;
        else if (table === chargesTable) data = budget?.charge ? [budget.charge] : [];
        else if (table === installmentsTable) data = pendingInstallments;
        else {
          const tableName = String((table as any)?.name || '').toLowerCase();
          if (tableName.includes('budgets')) data = budget ? [budget] : [];
          else if (tableName.includes('payments') && !tableName.includes('payment_charges')) data = existingPayments;
          else if (tableName.includes('payment_charges')) data = budget?.charge ? [budget.charge] : [];
          else if (tableName.includes('budget_installments')) data = pendingInstallments;
          else data = [];
        }

        const whereResult: any = Promise.resolve(data);
        whereResult.limit = jest.fn(() => {
          const limitResult: any = Promise.resolve(data.slice(0, 1));
          limitResult.for = jest.fn(() => Promise.resolve(data.slice(0, 1)));
          return limitResult;
        });
        whereResult.orderBy = jest.fn(() => Promise.resolve(data));
        return {
          where: jest.fn(() => whereResult),
          orderBy: jest.fn(() => Promise.resolve(data)),
        };
      }),
    })),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'pay-1', clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: '100.00', paymentMethod: 'pix' }]),
      }),
    })),
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })),
    delete: jest.fn(),
    transaction: jest.fn(async (cb: any) => cb(mockDb)),
  };
  // Make transaction call the callback with mockDb
  mockDb.transaction = jest.fn(async (cb: any) => cb(mockDb));
  return mockDb;
}

describe('T4 — registerManualPayment forward-only', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects amount <=0 and NaN', async () => {
    const budget = { id: BUDGET_ID, clinicId: CLINIC_A, patientId: 'p1', finalValue: '500.00', totalValue: '500.00' };
    const mockDb = mockTxForBudget(budget, []);
    mockGetDb.mockReturnValue(mockDb);
    (getBudgetForClinic as jest.Mock)?.mockResolvedValue?.(budget);

    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 0, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: -10, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: NaN as any, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toBeTruthy();
  });

  it('rejects amount above remaining balance (decimal safe)', async () => {
    const budget = { id: BUDGET_ID, clinicId: CLINIC_A, patientId: 'p1', finalValue: '500.00', totalValue: '500.00' };
    const existing = [{ amount: '400.00', clinicId: CLINIC_A, budgetId: BUDGET_ID }];
    const mockDb = mockTxForBudget(budget, existing);
    mockGetDb.mockReturnValue(mockDb);

    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 200, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'invalid_input' });
    // 100 should succeed (remaining is 100)
    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 100, paymentMethod: 'pix', actorUserId: USER_A })).resolves.toBeDefined();
    // 100.01 should fail (over by 1 cent)
    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 100.01, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('two concurrent manual payments do not exceed total (serializable via FOR UPDATE)', async () => {
    const budget = { id: BUDGET_ID, clinicId: CLINIC_A, patientId: 'p1', finalValue: '500.00', totalValue: '500.00' };
    // First call sees 0 paid, second should see 300 paid after first commits
    // Simulate serializable: second transaction's select returns updated sum
    let callCount = 0;
    const mockDb1 = mockTxForBudget(budget, []);
    const mockDb2 = mockTxForBudget(budget, [{ amount: '300.00' }]);

    mockGetDb.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockDb1 : mockDb2;
    });

    const p1 = registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 300, paymentMethod: 'pix', actorUserId: USER_A });
    const p2 = registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 300, paymentMethod: 'pix', actorUserId: USER_A });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    // One should succeed, one should be rejected due to overpayment
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as any).reason.code).toBe('invalid_input');
  });

  it('cross-tenant: rejects foreign budget', async () => {
    const mockDb: any = {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn(() => Promise.resolve([])),
          }),
        }),
      })),
      transaction: jest.fn(async (cb: any) => cb(mockDb)),
    };
    mockGetDb.mockReturnValue(mockDb);
    await expect(registerManualPayment({ clinicId: 'clinic-b', budgetId: BUDGET_ID, amount: 100, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('uses decimal string for persisted amount (not number float)', async () => {
    const budget = { id: BUDGET_ID, clinicId: CLINIC_A, patientId: 'p1', finalValue: '100.00', totalValue: '100.00' };
    let capturedAmount: any = null;
    const { budgets: budgetsTable, payments: paymentsTable, budgetInstallments: installmentsTable } = require('../../schema/financeiro');
    const mockDb: any = {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: any) => {
          let data: any[] = [];
          if (table === budgetsTable) data = [budget];
          else if (table === paymentsTable) data = [];
          else if (table === installmentsTable) data = [];
          else {
            const tableName = String((table as any)?.name || '').toLowerCase();
            if (tableName.includes('budgets')) data = [budget];
            else data = [];
          }
          const whereResult: any = Promise.resolve(data);
          whereResult.limit = jest.fn(() => {
            const lr: any = Promise.resolve(data.slice(0, 1));
            lr.for = jest.fn(() => Promise.resolve(data.slice(0, 1)));
            return lr;
          });
          whereResult.orderBy = jest.fn(() => Promise.resolve(data));
          return { where: jest.fn(() => whereResult), orderBy: jest.fn(() => Promise.resolve(data)) };
        }),
      })),
      insert: jest.fn().mockImplementation(() => ({
        values: jest.fn().mockImplementation((vals: any) => {
          capturedAmount = vals.amount;
          return { returning: jest.fn().mockResolvedValue([{ id: 'pay-1', amount: vals.amount }]) };
        }),
      })),
      update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
      transaction: jest.fn(async (cb: any) => cb(mockDb)),
    };
    mockDb.transaction = jest.fn(async (cb: any) => cb(mockDb));
    mockGetDb.mockReturnValue(mockDb);

    await registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_ID, amount: 0.1 + 0.2, paymentMethod: 'pix', actorUserId: USER_A });
    // 0.1+0.2 = 0.30000000000000004 as number, but should be stored as 0.30
    expect(capturedAmount).toBe('0.30');
    expect(typeof capturedAmount).toBe('string');
  });
});
