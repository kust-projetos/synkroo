import type { Pool } from 'pg';

export type AuditTenantFixture = {
  attacker: { userId: string; clinicId: string };
  victim: {
    userId: string;
    clinicId: string;
    patientId: string;
    appointmentId: string;
    gatewayId: string;
  };
};

const FIXTURE: AuditTenantFixture = {
  attacker: {
    userId: '00000000-0000-4000-8000-000000000201',
    clinicId: '00000000-0000-4000-8000-000000000101',
  },
  victim: {
    userId: '00000000-0000-4000-8000-000000000202',
    clinicId: '00000000-0000-4000-8000-000000000102',
    patientId: '00000000-0000-4000-8000-000000000301',
    appointmentId: '00000000-0000-4000-8000-000000000401',
    gatewayId: '00000000-0000-4000-8000-000000000501',
  },
};

export async function seedAuditTenants(pool?: Pool): Promise<AuditTenantFixture> {
  if (!pool) return FIXTURE;

  await pool.query('BEGIN');
  try {
    await pool.query(
      `INSERT INTO clinics (id, name, slug, phone, email)
       VALUES
         ($1, 'Audit Attacker Clinic', 'audit-attacker-clinic', '+5500000000101', 'audit-attacker@test.local'),
         ($2, 'Audit Victim Clinic', 'audit-victim-clinic', '+5500000000102', 'audit-victim@test.local')
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL`,
      [FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
    );
    await pool.query(
      `INSERT INTO users (id, clinic_id, email, name, role)
       VALUES
         ($1, $3, 'audit-attacker-user@test.local', 'Audit Attacker', 'owner'),
         ($2, $4, 'audit-victim-user@test.local', 'Audit Victim', 'owner')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, is_active = true`,
      [FIXTURE.attacker.userId, FIXTURE.victim.userId, FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
    );

    const roleIds = [
      '00000000-0000-4000-8000-000000000601',
      '00000000-0000-4000-8000-000000000602',
    ];
    await pool.query(
      `INSERT INTO roles (id, clinic_id, name, is_system)
       VALUES ($1, $3, 'audit-owner', true), ($2, $4, 'audit-owner', true)
       ON CONFLICT (id) DO NOTHING`,
      [roleIds[0], roleIds[1], FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
    );
    await pool.query(
      `INSERT INTO user_clinic_access (user_id, clinic_id, role_id)
       VALUES ($1, $3, $5), ($2, $4, $6)
       ON CONFLICT (user_id, clinic_id) DO NOTHING`,
      [FIXTURE.attacker.userId, FIXTURE.victim.userId, FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId, roleIds[0], roleIds[1]],
    );
    await pool.query(
      `INSERT INTO patients (id, clinic_id, name, phone, email)
       VALUES ($1, $2, 'Audit Victim Patient', '+5500000000301', 'audit-patient@test.local')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id`,
      [FIXTURE.victim.patientId, FIXTURE.victim.clinicId],
    );
    await pool.query(
      `INSERT INTO appointments (id, clinic_id, patient_id, scheduled_at)
       VALUES ($1, $2, $3, '2099-01-01T12:00:00Z')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, patient_id = EXCLUDED.patient_id`,
      [FIXTURE.victim.appointmentId, FIXTURE.victim.clinicId, FIXTURE.victim.patientId],
    );
    await pool.query(
      `INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled, masked_label)
       VALUES ($1, $2, 'audit', true, true, 'audit-fixture')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, is_default = true, is_enabled = true`,
      [FIXTURE.victim.gatewayId, FIXTURE.victim.clinicId],
    );
    await pool.query('COMMIT');
    return FIXTURE;
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
