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

  test('atomic replacement rollback on NOT NULL violation preserves originals', async () => {
    const db = getDb();

    try {
      // Seed original installments via atomic replacement
      const original = await replaceInstallmentsAtomic(CLINIC_ID, BUDGET_ID, [
        { budgetId: BUDGET_ID, amount: '100.00', dueDate: '2026-08-15', status: 'pending' },
        { budgetId: BUDGET_ID, amount: '200.00', dueDate: '2026-09-15', status: 'pending' },
      ]);
      expect(original).toHaveLength(2);

      const originalIds = [...original.map(r => r.id)].sort();
      const originalAmounts = original.map(r => r.amount).sort();
      const originalDueDates = original.map(r => r.dueDate).sort();

      // Attempt replacement with amount=null (type-forced to bypass TS)
      // PostgreSQL NOT NULL on budget_installments.amount rejects after DELETE
      // inside the transaction, forcing rollback.
      await expect(
        replaceInstallmentsAtomic(CLINIC_ID, BUDGET_ID, [
          { budgetId: BUDGET_ID, amount: null as unknown as string, dueDate: '2026-10-01', status: 'pending' },
        ]),
      ).rejects.toThrow();

      // Transaction rolled back — original installments intact
      const remaining = await listInstallments(CLINIC_ID, BUDGET_ID);
      expect(remaining).toHaveLength(2);

      const remainingSorted = [...remaining].sort((a, b) => a.id.localeCompare(b.id));
      const originalSorted = [...original].sort((a, b) => a.id.localeCompare(b.id));

      for (let i = 0; i < remainingSorted.length; i++) {
        expect(remainingSorted[i].id).toBe(originalSorted[i].id);
        expect(remainingSorted[i].amount).toBe(originalSorted[i].amount);
        expect(remainingSorted[i].dueDate).toBe(originalSorted[i].dueDate);
      }
    } finally {
      // Cleanup children, parent is cleared by outer beforeEach
      await pool.query('DELETE FROM budget_installments WHERE budget_id = $1', [BUDGET_ID]);
    }
  });

  test('normal replacement succeeds and returns new installments', async () => {
    // Seed original
    await replaceInstallments(CLINIC_ID, BUDGET_ID, [
      { amount: 100, dueDate: '2026-08-15' },
    ]);

    // Replace with two new installments (valid data)
    const replaced = await replaceInstallments(CLINIC_ID, BUDGET_ID, [
      { amount: 150, dueDate: '2026-10-01' },
      { amount: 150, dueDate: '2026-11-01' },
    ]);

    expect(replaced).toHaveLength(2);
    expect(replaced[0].budgetId).toBe(BUDGET_ID);

    // Only the new installments exist
    const all = await listInstallments(CLINIC_ID, BUDGET_ID);
    expect(all).toHaveLength(2);
    expect(all.every(a => a.amount === '150.00')).toBe(true);
  });
});
