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

export async function seedAuditTenants(): Promise<AuditTenantFixture> {
  return {
    attacker: { userId: 'audit-attacker', clinicId: 'audit-clinic-attacker' },
    victim: {
      userId: 'audit-victim',
      clinicId: 'audit-clinic-victim',
      patientId: 'audit-patient-victim',
      appointmentId: 'audit-appointment-victim',
      gatewayId: 'audit-gateway-victim',
    },
  };
}
