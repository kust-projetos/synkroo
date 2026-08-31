import { ActionError } from '@/core/actions/types';
import {
  findById,
  insertPatientObservation,
  normalizeTags,
  updatePatientTags as persistPatientTags,
} from '../repositories/patients-repository';

export interface PatientObservationInput {
  clinicId: string;
  patientId: string;
  content: string;
  actorUserId: string | null;
}

export interface PatientTagsInput {
  clinicId: string;
  patientId: string;
  tags: string[];
  actorUserId: string | null;
}

export async function registerPatientObservation(input: PatientObservationInput) {
  const patient = await findById(input.clinicId, input.patientId);
  if (!patient) {
    throw new ActionError('not_found', 'Paciente não encontrado.');
  }

  return insertPatientObservation({
    clinicId: input.clinicId,
    patientId: input.patientId,
    content: input.content,
    createdBy: input.actorUserId,
  });
}

export async function updatePatientTags(input: PatientTagsInput) {
  const patient = await findById(input.clinicId, input.patientId);
  if (!patient) {
    throw new ActionError('not_found', 'Paciente não encontrado.');
  }

  const tags = normalizeTags(input.tags);
  const updated = await persistPatientTags(input.clinicId, input.patientId, tags);
  if (!updated) {
    throw new ActionError('not_found', 'Paciente não encontrado.');
  }

  return { id: updated.id, tags };
}
