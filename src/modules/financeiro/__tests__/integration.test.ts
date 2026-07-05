/**
 * Integration test: Financeiro acceptance flow.
 *
 * Covers: budget creation → lead conversion → budget patientId persisted.
 * Requires real Postgres with migrations applied.
 */

/** @jest-environment node */

process.env.DATABASE_URL =
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { Pool } from 'pg';
import { closeDb } from '@/lib/db/client';
import { createBudget, acceptBudget } from '../services/budget-service';
import {
  createPaymentGateway,
  listBudgets as repoListBudgets,
  getBudget as repoGetBudget,
} from '../repositories/financeiro-repository';

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
