import { Pool } from 'pg';
import { cleanupAuditTenants, seedAuditTenants } from './audit-remediation-fixtures';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const DATABASE_URL = process.env.DATABASE_URL;

describeOrSkip('audit remediation fixtures — PostgreSQL', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    await cleanupAuditTenants(pool);
    await pool.end();
  });

  it('seeds two isolated tenants with victim records (legacy checks)', async () => {
    const fixture = await seedAuditTenants(pool);

    expect(fixture.attacker.clinicId).not.toBe(fixture.victim.clinicId);
    const result = await pool.query(
      `SELECT
         (SELECT count(*) FROM clinics WHERE id IN ($1, $2)) AS clinics,
         (SELECT count(*) FROM patients WHERE id = $3 AND clinic_id = $2) AS patients,
         (SELECT count(*) FROM appointments WHERE id = $4 AND clinic_id = $2) AS appointments,
         (SELECT count(*) FROM payment_gateways WHERE id = $5 AND clinic_id = $2) AS gateways`,
      [fixture.attacker.clinicId, fixture.victim.clinicId, fixture.victim.patientId, fixture.victim.appointmentId, fixture.victim.gatewayId],
    );

    expect(result.rows[0]).toMatchObject({ clinics: '2', patients: '1', appointments: '1', gateways: '1' });
  });

  it('seeds both clinics with full relational graph and cleanup is tenant-scoped', async () => {
    const fixture = await seedAuditTenants(pool);

    const result = await pool.query(
      `SELECT
         (SELECT count(*) FROM clinics WHERE id IN ($1, $2)) AS clinics,
         (SELECT count(*) FROM users WHERE id IN ($3, $4)) AS users,
         (SELECT count(*) FROM patients WHERE clinic_id = $1) AS attacker_patients,
         (SELECT count(*) FROM patients WHERE clinic_id = $2) AS victim_patients,
         (SELECT count(*) FROM dentists WHERE clinic_id = $1) AS attacker_dentists,
         (SELECT count(*) FROM dentists WHERE clinic_id = $2) AS victim_dentists,
         (SELECT count(*) FROM procedures WHERE clinic_id = $1) AS attacker_procedures,
         (SELECT count(*) FROM procedures WHERE clinic_id = $2) AS victim_procedures,
         (SELECT count(*) FROM appointments WHERE clinic_id = $1) AS attacker_appointments,
         (SELECT count(*) FROM appointments WHERE clinic_id = $2) AS victim_appointments,
         (SELECT count(*) FROM conversations WHERE clinic_id = $1) AS attacker_conversations,
         (SELECT count(*) FROM conversations WHERE clinic_id = $2) AS victim_conversations,
         (SELECT count(*) FROM budgets WHERE clinic_id = $1) AS attacker_budgets,
         (SELECT count(*) FROM budgets WHERE clinic_id = $2) AS victim_budgets,
         (SELECT count(*) FROM budget_installments WHERE budget_id = $5) AS attacker_installments,
         (SELECT count(*) FROM budget_installments WHERE budget_id = $6) AS victim_installments,
         (SELECT count(*) FROM payment_gateways WHERE clinic_id = $1) AS attacker_gateways,
         (SELECT count(*) FROM payment_gateways WHERE clinic_id = $2) AS victim_gateways,
         (SELECT count(*) FROM payment_charges WHERE clinic_id = $1) AS attacker_charges,
         (SELECT count(*) FROM payment_charges WHERE clinic_id = $2) AS victim_charges,
         (SELECT count(*) FROM payments WHERE clinic_id = $1) AS attacker_payments,
         (SELECT count(*) FROM payments WHERE clinic_id = $2) AS victim_payments`,
      [
        fixture.attacker.clinicId,
        fixture.victim.clinicId,
        fixture.attacker.userId,
        fixture.victim.userId,
        fixture.attacker.budgetId,
        fixture.victim.budgetId,
      ],
    );

    expect(result.rows[0]).toMatchObject({
      clinics: '2',
      users: '2',
      attacker_patients: '1',
      victim_patients: '1',
      attacker_dentists: '1',
      victim_dentists: '1',
      attacker_procedures: '1',
      victim_procedures: '1',
      attacker_appointments: '1',
      victim_appointments: '1',
      attacker_conversations: '1',
      victim_conversations: '1',
      attacker_budgets: '1',
      victim_budgets: '1',
      attacker_installments: '1',
      victim_installments: '1',
      attacker_gateways: '1',
      victim_gateways: '1',
      attacker_charges: '1',
      victim_charges: '1',
      attacker_payments: '1',
      victim_payments: '1',
    });

    // Legitimate relationships exist in both tenants
    const rel = await pool.query(
      `SELECT
         (SELECT clinic_id::text FROM appointments WHERE id = $1) AS appt_attacker_clinic,
         (SELECT clinic_id::text FROM appointments WHERE id = $2) AS appt_victim_clinic,
         (SELECT clinic_id::text FROM budgets WHERE id = $3) AS budget_attacker_clinic,
         (SELECT clinic_id::text FROM budgets WHERE id = $4) AS budget_victim_clinic`,
      [
        fixture.attacker.appointmentId,
        fixture.victim.appointmentId,
        fixture.attacker.budgetId,
        fixture.victim.budgetId,
      ],
    );
    expect(rel.rows[0].appt_attacker_clinic).toBe(fixture.attacker.clinicId);
    expect(rel.rows[0].appt_victim_clinic).toBe(fixture.victim.clinicId);
    expect(rel.rows[0].budget_attacker_clinic).toBe(fixture.attacker.clinicId);
    expect(rel.rows[0].budget_victim_clinic).toBe(fixture.victim.clinicId);
  });
});
