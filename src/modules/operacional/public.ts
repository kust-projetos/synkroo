/**
 * Operacional public seam — side-effect-free ports (W5.1).
 * Cada porta recebe valores confiáveis explícitos e nunca chama runAction.
 */
export {
  registerPatientObservation as registrarObservacaoPaciente,
  updatePatientTags as atualizarTagsPaciente,
} from './services/patient-owner-service';
export {
  processConfirmationResponse,
  processWaitlistConfirmation,
} from './services/confirmation-service';
export {
  getEffectiveConfig,
} from './services/procedure-reminder-config-service';
export {
  detectIncompleteTreatments,
  getIncompleteTreatmentAlerts,
} from './services/incomplete-treatment-service';
export type { IncompleteTreatment } from './services/incomplete-treatment-service';
export { markReminderDelivered } from './repositories/reminders-repository';

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

export async function buscarPacientePorTelefone(clinicId: string, phone: string) {
  const { findByPhone } = await import('./repositories/patients-repository');
  return findByPhone(clinicId, phone);
}
