import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import {
  OUTBOX_OPERATIONS,
  type ContactChangedPayload,
} from '@/lib/outbox/operations';
import {
  recalculateDuplicatesForLead,
  recalculateDuplicatesForPatient,
} from './duplicate-detection-service';

function payloadFrom(job: OutboxJob): ContactChangedPayload {
  const payload = job.payload as Partial<ContactChangedPayload>;
  if (
    (payload.ownerType !== 'patient' && payload.ownerType !== 'lead')
    || typeof payload.ownerId !== 'string'
    || !payload.ownerId
  ) {
    throw new Error('INVALID_CONTACT_CHANGED_OUTBOX_PAYLOAD');
  }
  return payload as ContactChangedPayload;
}

export async function dispatchContactChangedJob(job: OutboxJob): Promise<void> {
  if (job.operation !== OUTBOX_OPERATIONS.CRM_CONTACT_CHANGED) {
    throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
  }

  const payload = payloadFrom(job);
  if (payload.ownerType === 'patient') {
    await recalculateDuplicatesForPatient({
      clinicId: job.clinicId,
      patientId: payload.ownerId,
    });
    return;
  }

  await recalculateDuplicatesForLead({
    clinicId: job.clinicId,
    leadId: payload.ownerId,
  });
}
