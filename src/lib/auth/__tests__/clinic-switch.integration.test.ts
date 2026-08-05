import { Pool } from 'pg';
import { authOptions } from '../auth';
import { seedAuditTenants } from '@/__tests__/security/audit-remediation-fixtures';
import { closeDb } from '@/lib/db/client';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const ATTACKER_USER_ID = '00000000-0000-4000-8000-000000000201';
const CLINIC_A = '00000000-0000-4000-8000-000000000101';
const CLINIC_B = '00000000-0000-4000-8000-000000000102';
const VICTIM_ROLE_ID = '00000000-0000-4000-8000-000000000602';

async function updateClinic(clinicId: string) {
  const callback = authOptions.callbacks?.jwt;
  if (!callback) throw new Error('jwt callback is not configured');
  return callback({
    token: { id: ATTACKER_USER_ID, clinicId: CLINIC_A, sessionVersion: 0 },
    trigger: 'update',
    session: { user: { clinicId } },
  } as never);
}

describeIntegration('Auth.js clinic switching — PostgreSQL access boundary', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await seedAuditTenants(pool);
    await pool.query(
      `INSERT INTO user_clinic_access (user_id, clinic_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, clinic_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
      [ATTACKER_USER_ID, CLINIC_B, VICTIM_ROLE_ID],
    );
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM user_clinic_access WHERE user_id = $1 AND clinic_id = $2',
      [ATTACKER_USER_ID, CLINIC_B],
    );
    await pool.end();
    await closeDb();
  });

  it('accepts a clinic that user explicitly accesses', async () => {
    const token = await updateClinic(CLINIC_B);
    expect(token.clinicId).toBe(CLINIC_B);
  });

  it('keeps current clinic when update requests an inaccessible clinic', async () => {
    const token = await updateClinic('00000000-0000-4000-8000-000000000199');
    expect(token.clinicId).toBe(CLINIC_A);
  });
});
