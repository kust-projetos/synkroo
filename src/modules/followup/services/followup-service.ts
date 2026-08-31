import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import { appointments, dentists, patientFeedback, patients, procedureGuidelines, procedures } from '@/modules/operacional/schema';
import { followUpConfigs } from '@/modules/followup/schema/campaigns';
import { dbLogger, whatsappLogger } from '@/lib/logger';
import { validateAndFormatPhone } from './phone-resolver';
import { createFeedback, findAppointmentForClinicPatient, findPatientForClinic } from '../repositories/followup-repository';
import { getEffectiveConfig } from '@/modules/operacional/public';
import { runInactivityDetection } from './inactive-service';
import { executarCampanhas } from './campaign-service';
import { ActionError } from '@/core/actions/types';

export interface ProcedureGuideline {
  id: string;
  clinicId: string;
  procedureId?: string;
  procedureName: string;
  title: string;
  instructions: string;
  emergencyContact: boolean;
  recoveryTimeDays?: number;
  restrictions?: string[];
  warningSigns?: string[];
}

export interface FollowUpConfig {
  id: string;
  clinicId: string;
  configType: 'post_consultation' | 'return_reminder' | 'budget_follow_up';
  procedureId?: string;
  procedureName?: string;
  delayHours?: number;
  delayDays?: number;
  delayMonths?: number;
  messageTemplate: string;
}

export interface PatientFeedback {
  patientId: string;
  patientName: string;
  patientPhone: string;
  appointmentId?: string;
  procedureName?: string;
  dentistName?: string;
  clinicId: string;
  clinicName: string;
  clinicPhone: string;
  completedAt: Date;
}

export async function getProcedureGuidelines(clinicId: string, procedureName: string): Promise<ProcedureGuideline | null> {
  const [row] = await getDb().select().from(procedureGuidelines).where(and(
    eq(procedureGuidelines.clinicId, clinicId),
    ilike(procedureGuidelines.procedureName, `%${procedureName.replace(/[%_\\]/g, '\\$&')}%`),
    eq(procedureGuidelines.isActive, true),
  )).limit(1);
  return row ? {
    id: row.id,
    clinicId: row.clinicId,
    procedureId: row.procedureId ?? undefined,
    procedureName: row.procedureName,
    title: row.title,
    instructions: row.instructions,
    emergencyContact: row.emergencyContact ?? false,
    recoveryTimeDays: row.recoveryTimeDays ?? undefined,
    restrictions: row.restrictions ?? undefined,
    warningSigns: row.warningSigns ?? undefined,
  } : null;
}

export async function getFollowUpConfig(clinicId: string, configType: string, procedureName?: string): Promise<FollowUpConfig | null> {
  const filters = [eq(followUpConfigs.clinicId, clinicId), eq(followUpConfigs.configType, configType), eq(followUpConfigs.isActive, true)];
  if (procedureName) filters.push(ilike(followUpConfigs.procedureName, `%${procedureName.replace(/[%_\\]/g, '\\$&')}%`));
  let [row] = await getDb().select().from(followUpConfigs).where(and(...filters)).limit(1);
  if (!row) {
    [row] = await getDb().select().from(followUpConfigs).where(and(
      eq(followUpConfigs.clinicId, clinicId),
      eq(followUpConfigs.configType, configType),
      isNull(followUpConfigs.procedureName),
      eq(followUpConfigs.isActive, true),
    )).limit(1);
  }
  return row ? {
    id: row.id,
    clinicId: row.clinicId,
    configType: row.configType as FollowUpConfig['configType'],
    procedureId: row.procedureId ?? undefined,
    procedureName: row.procedureName ?? undefined,
    delayHours: row.delayHours ?? undefined,
    delayDays: row.delayDays ?? undefined,
    delayMonths: row.delayMonths ?? undefined,
    messageTemplate: row.messageTemplate,
  } : null;
}

export async function getAppointmentsNeedingFollowUp(hoursAfter = 2): Promise<PatientFeedback[]> {
  const followUpTime = new Date(Date.now() - hoursAfter * 3_600_000);
  const rows = await getDb().select({
    id: appointments.id,
    scheduledAt: appointments.scheduledAt,
    updatedAt: appointments.updatedAt,
    patientId: patients.id,
    patientName: patients.name,
    patientPhone: patients.phone,
    dentistName: dentists.name,
    procedureName: procedures.name,
    clinicId: clinics.id,
    clinicName: clinics.name,
    clinicPhone: clinics.phone,
  }).from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(clinics, eq(appointments.clinicId, clinics.id))
    .leftJoin(dentists, eq(appointments.dentistId, dentists.id))
    .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
    .where(and(
      eq(appointments.status, 'completed' as any),
      gte(appointments.updatedAt, followUpTime),
      lte(appointments.updatedAt, new Date(followUpTime.getTime() + 5 * 60_000)),
    ));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const sent = await getDb().select({ appointmentId: patientFeedback.appointmentId })
    .from(patientFeedback).where(and(inArray(patientFeedback.appointmentId, ids), eq(patientFeedback.feedbackType, 'post_consultation')));
  const sentIds = new Set(sent.map((row) => row.appointmentId));
  return rows.filter((row) => !sentIds.has(row.id)).map((row) => ({
    patientId: row.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    appointmentId: row.id,
    procedureName: row.procedureName ?? undefined,
    dentistName: row.dentistName ?? undefined,
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    clinicPhone: row.clinicPhone,
    completedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(row.scheduledAt),
  }));
}

export function formatFollowUpMessage(patient: PatientFeedback, config: FollowUpConfig, guidelines?: ProcedureGuideline | null): string {
  return config.messageTemplate
    .replace(/{{patient_name}}/g, patient.patientName)
    .replace(/{{procedure_name}}/g, patient.procedureName || 'consulta')
    .replace(/{{dentist_name}}/g, patient.dentistName || '')
    .replace(/{{clinic_name}}/g, patient.clinicName)
    .replace(/{{clinic_phone}}/g, patient.clinicPhone)
    .replace(/{{procedure_guidelines}}/g, guidelines?.instructions || 'Cuide bem da sua saúde bucal!');
}

export async function sendFollowUpMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_TOKEN;
  if (!apiUrl || !token) return { success: false, error: 'WhatsApp API not configured' };
  const validation = validateAndFormatPhone(phone);
  if (!validation.ok) return { success: false, error: `Invalid recipient phone: ${validation.error}` };
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: validation.phone, type: 'text', text: { body: message } }),
    });
    const data = await response.json() as { error?: { message?: string }; messages?: Array<{ id?: string }> };
    if (!response.ok) {
      whatsappLogger.error('WhatsApp API error', null, { data });
      return { success: false, error: data.error?.message || 'Failed to send message' };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    whatsappLogger.error('Error sending follow-up', error);
    return { success: false, error: 'Internal error' };
  }
}

export async function recordPatientFeedback(params: {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  feedbackType: string;
  rating?: number;
  npsScore?: number;
  wouldRecommend?: boolean;
  comments?: string;
  channel?: string;
}): Promise<void> {
  await createFeedback(params);
}

export async function processPostConsultationFollowUps(clinicId: string): Promise<{ processed: number; sent: number; failed: number }> {
  const appointmentsToProcess = (await getAppointmentsNeedingFollowUp(2)).filter((appointment) => appointment.clinicId === clinicId);
  let sent = 0;
  let failed = 0;
  for (const appointment of appointmentsToProcess) {
    const config = await getFollowUpConfig(clinicId, 'post_consultation', appointment.procedureName);
    if (!config) continue;
    const guidelines = appointment.procedureName ? await getProcedureGuidelines(clinicId, appointment.procedureName) : null;
    const result = await sendFollowUpMessage(appointment.patientPhone, formatFollowUpMessage(appointment, config, guidelines));
    await recordPatientFeedback({
      clinicId,
      patientId: appointment.patientId,
      appointmentId: appointment.appointmentId,
      feedbackType: 'post_consultation',
      channel: 'whatsapp',
    });
    if (result.success) sent += 1;
    else failed += 1;
  }
  return { processed: appointmentsToProcess.length, sent, failed };
}

export async function getPatientsNeedingReturnReminder(monthsSinceLastVisit: number): Promise<any[]> {
  const targetDate = new Date(Date.now() - monthsSinceLastVisit * 30 * 86_400_000);
  const patientRows = await getDb().select({
    id: patients.id,
    name: patients.name,
    phone: patients.phone,
    lastVisit: patients.lastVisitAt,
    optOutReminders: patients.optOutReminders,
    clinicId: clinics.id,
    clinicName: clinics.name,
    clinicPhone: clinics.phone,
  }).from(patients).innerJoin(clinics, eq(patients.clinicId, clinics.id)).where(and(
    isNotNull(patients.lastVisitAt),
    gte(patients.lastVisitAt, new Date(targetDate.getTime() - 7 * 86_400_000)),
    lte(patients.lastVisitAt, targetDate),
  ));
  if (!patientRows.length) return [];
  const ids = patientRows.map((patient) => patient.id);
  const appointmentRows = await getDb().select({
    patientId: appointments.patientId,
    id: appointments.id,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    procedureName: procedures.name,
  }).from(appointments).leftJoin(procedures, eq(appointments.procedureId, procedures.id))
    .where(inArray(appointments.patientId, ids));
  return patientRows.map((patient) => ({
    id: patient.id,
    name: patient.name,
    phone: patient.phone,
    last_visit: patient.lastVisit,
    opt_out_reminders: patient.optOutReminders,
    clinics: { id: patient.clinicId, name: patient.clinicName, phone: patient.clinicPhone },
    appointments: appointmentRows.filter((appointment) => appointment.patientId === patient.id).map((appointment) => ({
      id: appointment.id,
      scheduled_at: appointment.scheduledAt,
      status: appointment.status,
      procedures: appointment.procedureName ? { name: appointment.procedureName } : null,
    })),
  }));
}

export async function processReturnReminders(clinicId: string): Promise<{ processed: number; sent: number; failed: number }> {
  let processed = 0;
  let sent = 0;
  let failed = 0;
  for (const months of [6, 12]) {
    const patientsToProcess = (await getPatientsNeedingReturnReminder(months)).filter((patient) => patient.clinics?.id === clinicId);
    for (const patient of patientsToProcess) {
      if (patient.opt_out_reminders) continue;
      const lastAppointment = patient.appointments?.filter((appointment: any) => appointment.status === 'completed')
        .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
      const config = await getFollowUpConfig(clinicId, 'return_reminder', lastAppointment?.procedures?.name);
      if (!config) continue;
      const result = await sendFollowUpMessage(patient.phone, config.messageTemplate.replace(/{{patient_name}}/g, patient.name));
      processed += 1;
      if (result.success) sent += 1;
      else failed += 1;
    }
  }
  return { processed, sent, failed };
}

export async function processAllFollowUps(clinicId: string): Promise<void> {
  await processPostConsultationFollowUps(clinicId);
  await processReturnReminders(clinicId);
}

export async function executarAll(clinicId: string): Promise<{ processed: number }> {
  await processAllFollowUps(clinicId);
  return { processed: 1 };
}

export async function executarPostConsulta(clinicId: string) {
  return processPostConsultationFollowUps(clinicId);
}

export async function executarLembretesRetorno(clinicId: string) {
  return processReturnReminders(clinicId);
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
  if (!(await findPatientForClinic(input.clinicId, input.patientId))) {
    throw new ActionError('not_found', 'Paciente não encontrado.');
  }
  if (input.appointmentId && !(await findAppointmentForClinicPatient(input.clinicId, input.patientId, input.appointmentId))) {
    throw new ActionError('not_found', 'Agendamento não encontrado.');
  }
  await recordPatientFeedback({ ...input, feedbackType: input.feedbackType ?? 'post_consultation' });
  return { success: true };
}

export async function listarPendentes(clinicId: string) {
  const items = (await getAppointmentsNeedingFollowUp(2)).filter((appointment) => appointment.clinicId === clinicId);
  return { items, total: items.length };
}

export async function listarRetornoPendentes(clinicId: string) {
  const items = (await getPatientsNeedingReturnReminder(6)).filter((patient) => patient.clinics?.id === clinicId);
  return { items, total: items.length };
}

export async function runInactivityForCron(): Promise<void> {
  const activeClinics = await getDb().select({ id: clinics.id }).from(clinics).where(isNull(clinics.deletedAt));
  for (const clinic of activeClinics) await runInactivityDetection(clinic.id);
}

export async function runCampaignsForCron(): Promise<void> {
  const activeClinics = await getDb().select({ id: clinics.id }).from(clinics).where(isNull(clinics.deletedAt));
  for (const clinic of activeClinics) await executarCampanhas(clinic.id);
}
