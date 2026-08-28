import type { Pool } from 'pg';

export type AuditTenantClinicFixture = {
  clinicId: string;
  userId: string;
  roleId: string;
  patientId: string;
  dentistId: string;
  procedureId: string;
  appointmentId: string;
  conversationId: string;
  budgetId: string;
  installmentId: string;
  gatewayId: string;
  chargeId: string;
  paymentId: string;
};

export type AuditTenantFixture = {
  attacker: AuditTenantClinicFixture;
  victim: AuditTenantClinicFixture;
};

// Deterministic IDs — distinct across clinics, stable for tests.
// Preserve legacy IDs for backward compat (attacker 101/201, victim 102/202, victim patient 301 etc.)
// New entities per W0.2 contract use adjacent namespace 30x-90x.
export const AUDIT_FIXTURE_IDS = {
  attacker: {
    clinicId: '00000000-0000-4000-8000-000000000101',
    userId: '00000000-0000-4000-8000-000000000201',
    roleId: '00000000-0000-4000-8000-000000000601',
    patientId: '00000000-0000-4000-8000-000000000302',
    dentistId: '00000000-0000-4000-8000-000000000310',
    procedureId: '00000000-0000-4000-8000-000000000320',
    appointmentId: '00000000-0000-4000-8000-000000000402',
    conversationId: '00000000-0000-4000-8000-000000000410',
    budgetId: '00000000-0000-4000-8000-000000000701',
    installmentId: '00000000-0000-4000-8000-000000000710',
    gatewayId: '00000000-0000-4000-8000-000000000503',
    chargeId: '00000000-0000-4000-8000-000000000801',
    paymentId: '00000000-0000-4000-8000-000000000901',
  },
  victim: {
    clinicId: '00000000-0000-4000-8000-000000000102',
    userId: '00000000-0000-4000-8000-000000000202',
    roleId: '00000000-0000-4000-8000-000000000602',
    patientId: '00000000-0000-4000-8000-000000000301',
    dentistId: '00000000-0000-4000-8000-000000000311',
    procedureId: '00000000-0000-4000-8000-000000000321',
    appointmentId: '00000000-0000-4000-8000-000000000401',
    conversationId: '00000000-0000-4000-8000-000000000411',
    budgetId: '00000000-0000-4000-8000-000000000703',
    installmentId: '00000000-0000-4000-8000-000000000711',
    gatewayId: '00000000-0000-4000-8000-000000000501',
    chargeId: '00000000-0000-4000-8000-000000000803',
    paymentId: '00000000-0000-4000-8000-000000000902',
  },
} as const;

const FIXTURE: AuditTenantFixture = {
  attacker: { ...AUDIT_FIXTURE_IDS.attacker },
  victim: { ...AUDIT_FIXTURE_IDS.victim },
};

// Backwards-compatible flat shape (used by older tests that destructure .gatewayId etc.)
// Keep getters for legacy field names: clinicId/userId/patientId/appointmentId/gatewayId as alias to victim side where previously only victim had those entities.
export type LegacyAuditTenantFixture = AuditTenantFixture & {
  // legacy top-level victim shortcuts for code that expects fixture.victim.gatewayId etc. — already present via nested structure
};

export async function seedAuditTenants(pool?: Pool): Promise<AuditTenantFixture> {
  if (!pool) return FIXTURE;

  await pool.query('BEGIN');
  try {
    // 1. Clinics
    await pool.query(
      `INSERT INTO clinics (id, name, slug, phone, email)
       VALUES
         ($1, 'Audit Attacker Clinic', 'audit-attacker-clinic', '+5500000000101', 'audit-attacker@test.local'),
         ($2, 'Audit Victim Clinic', 'audit-victim-clinic', '+5500000000102', 'audit-victim@test.local')
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL`,
      [FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
    );

    // 2. Users
    await pool.query(
      `INSERT INTO users (id, clinic_id, email, name, role)
       VALUES
         ($1, $3, 'audit-attacker-user@test.local', 'Audit Attacker', 'owner'),
         ($2, $4, 'audit-victim-user@test.local', 'Audit Victim', 'owner')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, is_active = true`,
      [FIXTURE.attacker.userId, FIXTURE.victim.userId, FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
    );

    // 3. Roles
    await pool.query(
      `INSERT INTO roles (id, clinic_id, name, is_system)
       VALUES ($1, $3, 'audit-owner', true), ($2, $4, 'audit-owner', true)
       ON CONFLICT (id) DO NOTHING`,
      [FIXTURE.attacker.roleId, FIXTURE.victim.roleId, FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
    );

    // 4. Access
    await pool.query(
      `INSERT INTO user_clinic_access (user_id, clinic_id, role_id)
       VALUES ($1, $3, $5), ($2, $4, $6)
       ON CONFLICT (user_id, clinic_id) DO NOTHING`,
      [
        FIXTURE.attacker.userId,
        FIXTURE.victim.userId,
        FIXTURE.attacker.clinicId,
        FIXTURE.victim.clinicId,
        FIXTURE.attacker.roleId,
        FIXTURE.victim.roleId,
      ],
    );

    // 5. Patients (both clinics)
    await pool.query(
      `INSERT INTO patients (id, clinic_id, name, phone, email)
       VALUES
         ($1, $2, 'Audit Attacker Patient', '+5500000000302', 'audit-attacker-patient@test.local'),
         ($3, $4, 'Audit Victim Patient', '+5500000000301', 'audit-patient@test.local')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id`,
      [
        FIXTURE.attacker.patientId,
        FIXTURE.attacker.clinicId,
        FIXTURE.victim.patientId,
        FIXTURE.victim.clinicId,
      ],
    );

    // 6. Dentists
    await pool.query(
      `INSERT INTO dentists (id, clinic_id, name, cro)
       VALUES
         ($1, $2, 'Audit Attacker Dentist', 'CRO-ATTACKER-310'),
         ($3, $4, 'Audit Victim Dentist', 'CRO-VICTIM-311')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id`,
      [
        FIXTURE.attacker.dentistId,
        FIXTURE.attacker.clinicId,
        FIXTURE.victim.dentistId,
        FIXTURE.victim.clinicId,
      ],
    );

    // 7. Procedures
    await pool.query(
      `INSERT INTO procedures (id, clinic_id, name, duration_minutes, price)
       VALUES
         ($1, $2, 'Audit Attacker Procedure', 30, 150),
         ($3, $4, 'Audit Victim Procedure', 30, 150)
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id`,
      [
        FIXTURE.attacker.procedureId,
        FIXTURE.attacker.clinicId,
        FIXTURE.victim.procedureId,
        FIXTURE.victim.clinicId,
      ],
    );

    // 8. Appointments (each references its clinic's patient/dentist/procedure)
    await pool.query(
      `INSERT INTO appointments (id, clinic_id, patient_id, dentist_id, procedure_id, scheduled_at)
       VALUES
         ($1, $2, $3, $4, $5, '2099-01-02T12:00:00Z'),
         ($6, $7, $8, $9, $10, '2099-01-01T12:00:00Z')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, patient_id = EXCLUDED.patient_id,
         dentist_id = EXCLUDED.dentist_id, procedure_id = EXCLUDED.procedure_id`,
      [
        FIXTURE.attacker.appointmentId,
        FIXTURE.attacker.clinicId,
        FIXTURE.attacker.patientId,
        FIXTURE.attacker.dentistId,
        FIXTURE.attacker.procedureId,
        FIXTURE.victim.appointmentId,
        FIXTURE.victim.clinicId,
        FIXTURE.victim.patientId,
        FIXTURE.victim.dentistId,
        FIXTURE.victim.procedureId,
      ],
    );

    // 9. Conversations (one per clinic, linked to its patient)
    await pool.query(
      `INSERT INTO conversations (id, clinic_id, patient_id, channel, external_id, status)
       VALUES
         ($1, $2, $3, 'whatsapp', 'audit-attacker-external-410', 'active'),
         ($4, $5, $6, 'whatsapp', 'audit-victim-external-411', 'active')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, patient_id = EXCLUDED.patient_id`,
      [
        FIXTURE.attacker.conversationId,
        FIXTURE.attacker.clinicId,
        FIXTURE.attacker.patientId,
        FIXTURE.victim.conversationId,
        FIXTURE.victim.clinicId,
        FIXTURE.victim.patientId,
      ],
    );

    // 10. Budgets (one per clinic, linked to its patient+appointment)
    await pool.query(
      `INSERT INTO budgets (id, clinic_id, patient_id, appointment_id, title, total_value, final_value, status)
       VALUES
         ($1, $2, $3, $4, 'Audit Attacker Budget', 500, 500, 'approved'),
         ($5, $6, $7, $8, 'Audit Victim Budget', 600, 600, 'approved')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id`,
      [
        FIXTURE.attacker.budgetId,
        FIXTURE.attacker.clinicId,
        FIXTURE.attacker.patientId,
        FIXTURE.attacker.appointmentId,
        FIXTURE.victim.budgetId,
        FIXTURE.victim.clinicId,
        FIXTURE.victim.patientId,
        FIXTURE.victim.appointmentId,
      ],
    );

    // 11. Payment Gateways (one per clinic)
    // Keep victim 501 as 'audit' default; attacker 503 also audit. Leave 502 free for asaas integration test.
    await pool.query(
      `INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled, masked_label)
       VALUES
         ($1, $2, 'audit', true, true, 'audit-attacker-fixture'),
         ($3, $4, 'audit', true, true, 'audit-fixture')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, is_default = true, is_enabled = true`,
      [FIXTURE.attacker.gatewayId, FIXTURE.attacker.clinicId, FIXTURE.victim.gatewayId, FIXTURE.victim.clinicId],
    );

    // 12. Payment Charges (one per clinic, tied to its budget+gateway)
    await pool.query(
      `INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, external_charge_id, due_date, amount, status)
       VALUES
         ($1, $2, $3, $4, 'audit-attacker-charge-801', CURRENT_DATE, 500, 'pending'),
         ($5, $6, $7, $8, 'audit-victim-charge-803', CURRENT_DATE, 600, 'pending')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, status = 'pending'`,
      [
        FIXTURE.attacker.chargeId,
        FIXTURE.attacker.clinicId,
        FIXTURE.attacker.budgetId,
        FIXTURE.attacker.gatewayId,
        FIXTURE.victim.chargeId,
        FIXTURE.victim.clinicId,
        FIXTURE.victim.budgetId,
        FIXTURE.victim.gatewayId,
      ],
    );

    // 13. Budget Installments (one per clinic)
    await pool.query(
      `INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
       VALUES
         ($1, $2, 500, CURRENT_DATE, 'pending'),
         ($3, $4, 600, CURRENT_DATE, 'pending')
       ON CONFLICT (id) DO UPDATE SET budget_id = EXCLUDED.budget_id`,
      [FIXTURE.attacker.installmentId, FIXTURE.attacker.budgetId, FIXTURE.victim.installmentId, FIXTURE.victim.budgetId],
    );

    // 14. Payments (one per clinic, tied to budget+charge+patient)
    await pool.query(
      `INSERT INTO payments (id, patient_id, clinic_id, budget_id, charge_id, amount, payment_method, notes, created_by, status)
       VALUES
         ($1, $2, $3, $4, $5, 500, 'pix', 'audit attacker payment', $6, 'confirmed'),
         ($7, $8, $9, $10, $11, 600, 'pix', 'audit victim payment', $12, 'confirmed')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id`,
      [
        FIXTURE.attacker.paymentId,
        FIXTURE.attacker.patientId,
        FIXTURE.attacker.clinicId,
        FIXTURE.attacker.budgetId,
        FIXTURE.attacker.chargeId,
        FIXTURE.attacker.userId,
        FIXTURE.victim.paymentId,
        FIXTURE.victim.patientId,
        FIXTURE.victim.clinicId,
        FIXTURE.victim.budgetId,
        FIXTURE.victim.chargeId,
        FIXTURE.victim.userId,
      ],
    );

    await pool.query('COMMIT');
    return FIXTURE;
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

export async function cleanupAuditTenants(pool: Pool): Promise<void> {
  // Tenant-scoped cleanup: delete clinics cascades, but also explicitly clean to avoid orphan checks in partial states.
  const ids = [
    FIXTURE.attacker.clinicId,
    FIXTURE.victim.clinicId,
    FIXTURE.attacker.userId,
    FIXTURE.victim.userId,
    FIXTURE.attacker.patientId,
    FIXTURE.victim.patientId,
    FIXTURE.attacker.dentistId,
    FIXTURE.victim.dentistId,
    FIXTURE.attacker.procedureId,
    FIXTURE.victim.procedureId,
    FIXTURE.attacker.appointmentId,
    FIXTURE.victim.appointmentId,
    FIXTURE.attacker.conversationId,
    FIXTURE.victim.conversationId,
    FIXTURE.attacker.budgetId,
    FIXTURE.victim.budgetId,
    FIXTURE.attacker.gatewayId,
    FIXTURE.victim.gatewayId,
    FIXTURE.attacker.chargeId,
    FIXTURE.victim.chargeId,
    FIXTURE.attacker.installmentId,
    FIXTURE.victim.installmentId,
    FIXTURE.attacker.paymentId,
    FIXTURE.victim.paymentId,
  ];
  // Delete in reverse FK order, then clinics
  await pool.query(`DELETE FROM payments WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM budget_installments WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM payment_charges WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM budgets WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM conversations WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM appointments WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM procedures WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM dentists WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM patients WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM user_clinic_access WHERE clinic_id = ANY($1::uuid[])`, [
    [FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId],
  ]);
  await pool.query(`DELETE FROM roles WHERE id = ANY($1::uuid[])`, [[FIXTURE.attacker.roleId, FIXTURE.victim.roleId]]);
  await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[FIXTURE.attacker.userId, FIXTURE.victim.userId]]);
  await pool.query(`DELETE FROM clinics WHERE id = ANY($1::uuid[])`, [[FIXTURE.attacker.clinicId, FIXTURE.victim.clinicId]]);
}
