import { Pool } from 'pg';
import { seedAuditTenants } from './audit-remediation-fixtures';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const DATABASE_URL = process.env.DATABASE_URL;

describeOrSkip('audit remediation fixtures — PostgreSQL', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM clinics WHERE id IN ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102')`,
    );
    await pool.end();
  });

  it('seeds two isolated tenants with victim records', async () => {
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
});
