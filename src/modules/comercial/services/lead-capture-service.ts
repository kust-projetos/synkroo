/**
 * Comercial module — lead capture service.
 *
 * Orchestrates lead capture: upsert by phone_normalized,
 * then logs a lead_captured activity.
 * Calls only repositories — no direct DB or drizzle.
 */

import * as leadsRepo from '../repositories/leads-repository';
import * as activitiesRepo from '../repositories/activities-repository';

export interface CaptureLeadInput {
  clinicId: string;
  name: string;
  phone: string;
  source: string;
}

export interface CaptureLeadResult {
  leadId: string;
}

function normalizePhone(v: string): string {
  return v.replace(/\D/g, '');
}

/**
 * Capture a lead: upsert by normalized phone, write activity.
 *
 * Uses DB-level unique partial index (clinic_id, phone_normalized)
 * via the repository's upsertByPhoneNormalized.
 */
export async function captureLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
  const phoneNormalized = normalizePhone(input.phone);

  const { id: leadId } = await leadsRepo.upsertLeadByPhoneNormalized({
    clinicId: input.clinicId,
    name: input.name,
    phone: input.phone,
    phoneNormalized,
    source: input.source,
  });

  await activitiesRepo.insertActivity({
    leadId,
    activityType: 'lead_captured',
    description: `Lead captured via ${input.source}`,
    metadata: { source: input.source, name: input.name },
  });

  return { leadId };
}
