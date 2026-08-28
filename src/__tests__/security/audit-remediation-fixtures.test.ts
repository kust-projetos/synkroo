import { AUDIT_FIXTURE_IDS, seedAuditTenants } from './audit-remediation-fixtures';

describe('audit remediation fixtures', () => {
  it('creates attacker and victim in distinct clinics', async () => {
    const fixture = await seedAuditTenants();

    expect(fixture.attacker.clinicId).not.toBe(fixture.victim.clinicId);
  });

  it('exposes deterministic distinct IDs for every tenant-owned entity', async () => {
    const fixture = await seedAuditTenants();

    // clinics, users, roles
    expect(fixture.attacker.clinicId).not.toBe(fixture.victim.clinicId);
    expect(fixture.attacker.userId).not.toBe(fixture.victim.userId);
    expect(fixture.attacker.roleId).not.toBe(fixture.victim.roleId);

    // per-clinic domain entities
    const entities: Array<keyof typeof AUDIT_FIXTURE_IDS.attacker> = [
      'patientId',
      'dentistId',
      'procedureId',
      'appointmentId',
      'conversationId',
      'budgetId',
      'installmentId',
      'gatewayId',
      'chargeId',
      'paymentId',
    ];
    for (const key of entities) {
      expect(fixture.attacker[key]).not.toBe(fixture.victim[key]);
      expect(fixture.attacker[key]).toBe(AUDIT_FIXTURE_IDS.attacker[key]);
      expect(fixture.victim[key]).toBe(AUDIT_FIXTURE_IDS.victim[key]);
    }
  });

  it('is import-safe without Pool and returns IDs only', async () => {
    const fixture = await seedAuditTenants();
    expect(fixture.attacker.clinicId).toBe(AUDIT_FIXTURE_IDS.attacker.clinicId);
    expect(fixture.victim.clinicId).toBe(AUDIT_FIXTURE_IDS.victim.clinicId);
  });

  it('maintains legacy victim shortcuts for backward compat', async () => {
    const fixture = await seedAuditTenants();
    // legacy code used victim.patientId/appointmentId/gatewayId as primary victim records — still present
    expect(fixture.victim.patientId).toBe('00000000-0000-4000-8000-000000000301');
    expect(fixture.victim.appointmentId).toBe('00000000-0000-4000-8000-000000000401');
    expect(fixture.victim.gatewayId).toBe('00000000-0000-4000-8000-000000000501');
  });
});
