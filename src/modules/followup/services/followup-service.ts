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
import { executarCampanhas as runCampaigns } from './campaign-service';
import { ActionError } from '@/core/actions/types';
import { findPatientForClinic, findAppointmentForClinicPatient, createFeedback } from '@/repositories/followup';
import { getDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import { isNull } from 'drizzle-orm';

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

export async function registrarFeedback(input: {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  feedbackType?: string;
  rating?: number;
  npsScore?: number;
  comments?: string;
}): Promise<{ success: boolean }> {
  const patient = await findPatientForClinic(input.clinicId, input.patientId);
  if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');

  if (input.appointmentId) {
    const appointment = await findAppointmentForClinicPatient(
      input.clinicId,
      input.patientId,
      input.appointmentId,
    );
    if (!appointment) throw new ActionError('not_found', 'Agendamento não encontrado.');
  }

  await createFeedback({
    clinicId: input.clinicId,
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    feedbackType: input.feedbackType ?? 'post_consultation',
    rating: input.rating,
    npsScore: input.npsScore,
    comments: input.comments,
  });

  return { success: true };
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

// ─── Cron-executable wrappers ───────────────────────────────────────────────────
// Exposed so cron/followups route can call all three cron tasks without
// importing @/services/followup directly.

export async function runInactivityForCron(): Promise<void> {
  const allClinics = await getDb().select({ id: clinics.id }).from(clinics).where(isNull(clinics.deletedAt));
  for (const c of allClinics) {
    await runInactivity(c.id);
  }
}

export async function runCampaignsForCron(): Promise<void> {
  const allClinics = await getDb().select({ id: clinics.id }).from(clinics).where(isNull(clinics.deletedAt));
  for (const c of allClinics) {
    await runCampaigns(c.id);
  }
}
