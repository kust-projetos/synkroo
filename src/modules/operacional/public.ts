/**
 * Operacional public seam — side-effect-free ports (W5.1).
 * Cada porta recebe valores confiáveis explícitos (clinicId, actorUserId) e aplica invariantes, nunca chama runAction.
 */
export async function registrarObservacaoPaciente(input: { clinicId: string; patientId: string; content: string; actorUserId: string | null }) {
  const { insertPatientObservation, findById } = await import('./repositories/patients-repository');
  const patient = await findById(input.clinicId, input.patientId);
  if (!patient) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Paciente não encontrado.');
  return insertPatientObservation({ clinicId: input.clinicId, patientId: input.patientId, content: input.content, createdBy: input.actorUserId });
}

export async function atualizarTagsPaciente(input: { clinicId: string; patientId: string; tags: string[]; actorUserId: string | null }) {
  const { updatePatientTags, findById, normalizeTags } = await import('./repositories/patients-repository');
  const patient = await findById(input.clinicId, input.patientId);
  if (!patient) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Paciente não encontrado.');
  const normalized = normalizeTags(input.tags);
  const res = await updatePatientTags(input.clinicId, input.patientId, normalized);
  return { id: res?.id ?? input.patientId, tags: normalized };
}

export async function mergePatients(input: { clinicId: string; winnerId: string; loserId: string }) {
  const { mergePatients: merge } = await import('./repositories/patients-repository');
  return merge(input.winnerId, input.loserId, input.clinicId);
}

export async function isMergedPatient(clinicId: string, patientId: string) {
  const { findById } = await import('./repositories/patients-repository');
  const p = await findById(clinicId, patientId);
  return (p as any)?.mergeStatus === 'merged';
}

export async function criarPaciente(input: { clinicId: string; name: string; phone: string; email?: string }) {
  const { insertPatient } = await import('./repositories/patients-repository');
  return insertPatient(input);
}

export async function obterPaciente(clinicId: string, patientId: string) {
  const { findById } = await import('./repositories/patients-repository');
  return findById(clinicId, patientId);
}

export async function atualizarPaciente(clinicId: string, patientId: string, patch: Record<string, unknown>) {
  const { updatePatient } = await import('./repositories/patients-repository');
  return updatePatient(clinicId, patientId, patch as any);
}

export async function agendarConsulta(input: { clinicId: string; patientId: string; dentistId?: string | null; procedureId?: string | null; scheduledAt: Date; durationMinutes?: number; notes?: string }) {
  const { agendarConsulta: agendar } = await import('./services/scheduling-service');
  return agendar(input);
}
