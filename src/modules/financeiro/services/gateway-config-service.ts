/**
 * Financeiro — gateway config service.
 *
 * Gateway CRUD, credential masking/encryption, routing rule persistence.
 */

export async function saveGateway(input: {
  clinicId: string;
  id?: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel?: string;
  apiKey?: string;
}) {
  // TODO: mask apiKey, encrypt config, persist
  throw new Error('Not yet implemented');
}

export async function saveRoutingRule(input: {
  clinicId: string;
  id?: string;
  gatewayId: string;
  campaignId?: string;
  patientId?: string;
  leadId?: string;
}) {
  // TODO: enforce single scope, persist
  throw new Error('Not yet implemented');
}
