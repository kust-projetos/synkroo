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

// ─── Cron-executable wrappers ───────────────────────────────────────────────────
// Exposed so cron/followups route can call all three cron tasks without
// importing @/services/followup directly.

export async function runInactivityForCron(clinicId: string): Promise<void> {
  await runInactivity(clinicId);
}

export async function runCampaignsForCron(clinicId: string): Promise<void> {
  await runCampaigns(clinicId);
}
