/**
 * Follow-up service bridge.
 *
 * Wraps legacy @/services/followup/followup.service.ts functions
 * for use by Follow-up module actions.
 * Also exposes cron-executable wrappers (runInactivityDetection, runCampaigns)
 * so the cron route never imports @/services/followup directly.
 */

import * as legacy from '@/services/followup/followup.service';
import { runInactivityDetection as runInactivity } from './inactive-service';
import { executarCampanhas } from './campaign-service';
import { createFeedback, findPatientForClinic, findAppointmentForClinicPatient } from '@/repositories/followup';
import { ActionError } from '@/core/actions/types';

export async function executarAll(clinicId: string): Promise<{ processed: number; sent?: number; failed?: number }> {
  await legacy.processAllFollowUps(clinicId);
  return { processed: 1 };
}

export async function executarPostConsulta(clinicId: string): Promise<{ processed: number; sent: number; failed: number }> {
  const result = await legacy.processPostConsultationFollowUps(clinicId);
  return result;
}

export async function executarLembretesRetorno(clinicId: string): Promise<{ processed: number; sent: number; failed: number }> {
  const result = await legacy.processReturnReminders(clinicId);
  return result;
}

export async function listarPendentes(clinicId: string) {
  const needing = await legacy.getAppointmentsNeedingFollowUp(2);
  const clinicRows = needing.filter((a: any) => a.clinicId === clinicId);
  return { items: clinicRows, total: clinicRows.length };
}

export async function listarRetornoPendentes(clinicId: string) {
  const patientsNeeding = await legacy.getPatientsNeedingReturnReminder(6);
  const clinicRows = patientsNeeding.filter((p: any) => p.clinicId === clinicId);
  return { items: clinicRows, total: clinicRows.length };
}

// ─── Feedback ─────────────────────────────────────────────────────────────────────

/**
 * Register patient feedback with tenant ownership validation.
 * Rejects feedback for patients or appointments that don't belong to the clinic.
 */
export async function registrarFeedback(params: {
	clinicId: string;
	patientId: string;
	appointmentId?: string;
	feedbackType: string;
	rating?: number;
	npsScore?: number;
	wouldRecommend?: boolean;
	comments?: string;
	channel?: string;
}): Promise<{ success: boolean }> {
	// Validate patient belongs to this clinic
	const patient = await findPatientForClinic(params.clinicId, params.patientId);
	if (!patient) {
		throw new ActionError('not_found', 'Paciente não encontrado nesta clínica.');
	}

	// Validate appointment belongs to this clinic + patient (if provided)
	if (params.appointmentId) {
		const appointment = await findAppointmentForClinicPatient(
			params.clinicId,
			params.patientId,
			params.appointmentId,
			);
		if (!appointment) {
			throw new ActionError('not_found', 'Agendamento não encontrado nesta clínica.');
		}
	}

	await createFeedback(params);
	return { success: true };
}

// ─── Cron-executable wrappers ───────────────────────────────────────────────────
// Exposed so cron/followups route can call all three cron tasks without
// importing @/services/followup directly.

export async function runInactivityForCron(clinicId: string): Promise<void> {
  await runInactivity(clinicId);
}

export async function runCampaignsForCron(clinicId: string): Promise<void> {
  await executarCampanhas(clinicId);
}
