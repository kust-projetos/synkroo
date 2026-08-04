import { seedAuditTenants } from './audit-remediation-fixtures';

describe('audit remediation fixtures', () => {
  it('creates attacker and victim in distinct clinics', async () => {
    const fixture = await seedAuditTenants();

    expect(fixture.attacker.clinicId).not.toBe(fixture.victim.clinicId);
  });
});
