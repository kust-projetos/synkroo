/**
 * Integration test: Financeiro acceptance flow.
 *
 * Covers: budget creation → lead conversion → budget patientId persisted.
 * Requires real Postgres with migrations applied.
 */

/** @jest-environment node */

import { Pool } from 'pg';
import { closeDb } from '@/lib/db/client';
import { createBudget, acceptBudget } from '../services/budget-service';
import {
  createPaymentGateway,
  listBudgets as repoListBudgets,
  getBudget as repoGetBudget,
} from '../repositories/financeiro-repository';
import { replaceInstallments, listInstallments } from '../services/installment-service';
import { replaceInstallmentsAtomic } from '../repositories/installment-replacement-repository';
import { budgets, budgetInstallments } from '@/lib/db/schema';
import { getDb } from '@/lib/db/client';

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';
const LEAD_ID = '00000000-0000-0000-0000-000000000011';

let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`INSERT INTO clinics (id, name, slug, phone, email) VALUES ($1, 'IT Clinic', 'it-clinic', '11999999999', 'it@c.com') ON CONFLICT (id) DO NOTHING`, [CLINIC_ID]);
});

afterAll(async () => {
  await closeDb();
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM budget_items');
  await pool.query('DELETE FROM budgets');
  await pool.query('DELETE FROM payment_gateways');
  await pool.query('DELETE FROM leads');
  await pool.query('DELETE FROM patients');
});

describe('budget lead acceptance flow', () => {
  test('creates budget then accepts with lead conversion population', async () => {
    // Seed patients and leads for FK constraints
    await pool.query(`INSERT INTO patients (id, clinic_id, name, phone) VALUES ($1, $2, 'Test Patient', '11988887777') ON CONFLICT (id) DO NOTHING`, [PATIENT_ID, CLINIC_ID]);
    await pool.query(`INSERT INTO leads (id, clinic_id, name, phone, status, source) VALUES ($1, $2, 'Test Lead', '11999990000', 'new', 'whatsapp') ON CONFLICT (id) DO NOTHING`, [LEAD_ID, CLINIC_ID]);

    // Create a budget with leadId
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      leadId: LEAD_ID,
      items: [{ procedureName: 'Limpeza', quantity: 1, unitPrice: 150 }],
      title: 'Lead Budget',
    });
    expect(budget).toBeDefined();
    expect(budget.leadId).toBe(LEAD_ID);
    expect(budget.status).toBe('pending');

    // Accept the budget
    const accepted = await acceptBudget(budget.id, CLINIC_ID, {
      patientId: PATIENT_ID,
      convertedFromLeadId: LEAD_ID,
    });
    expect(accepted.status).toBe('accepted');
    expect(accepted.patientId).toBe(PATIENT_ID);
    expect(accepted.convertedFromLeadId).toBe(LEAD_ID);

    // Verify via DB read
    const reloaded = await repoGetBudget(budget.id);
    expect(reloaded).toBeDefined();
    expect(reloaded!.status).toBe('accepted');
    expect(reloaded!.patientId).toBe(PATIENT_ID);
  });

  test('persists budget with patientId and retrieves via list', async () => {
    await pool.query(`INSERT INTO patients (id, clinic_id, name, phone) VALUES ($1, $2, 'Patient Two', '11977776666') ON CONFLICT (id) DO NOTHING`, [PATIENT_ID, CLINIC_ID]);

    await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Extração', quantity: 1, unitPrice: 400 }],
    });

    const budgets = await repoListBudgets(CLINIC_ID);
    expect(budgets.length).toBeGreaterThanOrEqual(1);
    expect(budgets[0].clinicId).toBe(CLINIC_ID);
  });

  test('creates and reads payment gateway', async () => {
    const gw = await createPaymentGateway({
      clinicId: CLINIC_ID,
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
      maskedLabel: '****1234',
      encryptedConfig: null,
    });
    expect(gw.id).toBeTruthy();
    expect(gw.provider).toBe('asaas');
    expect(gw.isDefault).toBe(true);
  });
});

describe('installment replacement rollback', () => {
  const BUDGET_ID = '00000000-0000-0000-0000-00000000f001';

  // Children-before-parents cleanup order for FK integrity
  beforeEach(async () => {
    // Re-create the parent budget after the outer beforeEach deleted it.
    // Clean children first (defensive — installments, payments on this budget)
    await pool.query('DELETE FROM budget_installments WHERE budget_id = $1', [BUDGET_ID]);
    // Re-create parent budget
    await pool.query(
      `INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status)
       VALUES ($1, $2, 'Rollback Test Budget', '300.00', '300.00', 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [BUDGET_ID, CLINIC_ID],
    );
  });

  afterAll(async () => {
    // Children first, then parent
    await pool.query('DELETE FROM budget_installments WHERE budget_id = $1', [BUDGET_ID]);
    await pool.query('DELETE FROM budgets WHERE id = $1', [BUDGET_ID]);
  });

  test('failed insert preserves original installments (rollback — deterministic NOT NULL)', async () => {
    // Seed original installments via service layer
    const original = await replaceInstallments(BUDGET_ID, [
      { amount: 100, dueDate: '2026-08-15' },
      { amount: 200, dueDate: '2026-09-15' },
    ]);
    expect(original).toHaveLength(2);

    const originalIds = original.map(o => o.id);
    const originalAmounts = original.map(o => o.amount);
    const originalDueDates = original.map(o => o.dueDate);

    // Attempt replacement via atomic repo directly with amount:null.
    // NULL is a valid SQL parameter (not client-caught), but the column
    // has a NOT NULL constraint, so Postgres rejects it SERVER-SIDE
    // inside db.transaction() — proving the delete is rolled back.

    let caught: Error | null = null;
    try {
      await replaceInstallmentsAtomic(BUDGET_ID, [
        { budgetId: BUDGET_ID, amount: null as unknown as string, dueDate: '2026-10-01', status: 'pending' },
      ]);
    } catch (err: unknown) {
      caught = err instanceof Error ? err : new Error(String(err));
    }
    expect(caught).toBeInstanceOf(Error);

    // Verify original installments are preserved
    const remaining = await listInstallments(BUDGET_ID);
    expect(remaining).toHaveLength(2);
    expect(remaining.map(r => r.id).sort()).toEqual([...originalIds].sort());
    expect(remaining.map(r => r.amount).sort()).toEqual([...originalAmounts].sort());
    expect(remaining.map(r => r.dueDate).sort()).toEqual([...originalDueDates].sort());
  });

  test('normal replacement succeeds and returns new installments', async () => {
    // Seed original
    await replaceInstallments(BUDGET_ID, [
      { amount: 100, dueDate: '2026-08-15' },
    ]);

    // Replace with two new installments (valid data)
    const replaced = await replaceInstallments(BUDGET_ID, [
      { amount: 150, dueDate: '2026-10-01' },
      { amount: 150, dueDate: '2026-11-01' },
    ]);

    expect(replaced).toHaveLength(2);
    expect(replaced[0].budgetId).toBe(BUDGET_ID);

    // Only the new installments exist
    const all = await listInstallments(BUDGET_ID);
    expect(all).toHaveLength(2);
    expect(all.every(a => a.amount === '150.00')).toBe(true);
  });
});
