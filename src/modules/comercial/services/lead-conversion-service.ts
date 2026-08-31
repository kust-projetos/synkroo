/**
 * Comercial module — lead conversion service.
 *
 * Orchestrates:
 * - agendarAvaliacao: ensure patient exists → schedule appointment → convert lead
 * - converterLeadSemAgendar: ensure patient exists → convert lead (no appointment)
 *
 * Shared helper: ensurePatientForLead resolves or creates a patient from lead data.
 */

import { findLeadByIdForClinic, updateLead } from '../repositories/leads-repository';
import { insertActivity } from '../repositories/activities-repository';
import {
  agendarConsulta,
  atualizarPaciente,
  criarPaciente,
  obterPaciente,
} from '@/modules/operacional/public';

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface EnsurePatientResult {
  lead: Record<string, unknown>;
  patientId: string;
}

export interface AgendarAvaliacaoInput {
  leadId: string;
  clinicId: string;
  scheduledAt: Date;
  dentistId?: string;
  procedureId?: string;
  durationMinutes?: number;
  notes?: string;
  actorUserId?: string | null;
}

export interface ConverterLeadSemAgendarInput {
  leadId: string;
  clinicId: string;
  actorUserId?: string | null;
}

export interface EnsurePatientForLeadInput {
  leadId: string;
  clinicId: string;
  actorUserId: string | null;
}

// ─── Shared helper: ensure patient exists from lead data ────────────────────────

/**
 * Resolves or creates a patient for the given lead.
 *
 * - Leads with patientId → checks data diff and updates patient if lead info changed.
 * - Leads without patientId → creates a new patient from lead name/phone/email.
 *
 * Returns the lead row and resolved patientId.
 * Throws if lead is missing or already converted.
 */
export async function ensurePatientForLead(
  input: EnsurePatientForLeadInput,
): Promise<EnsurePatientResult> {
  const { leadId, clinicId, actorUserId } = input;
  const lead = await findLeadByIdForClinic(leadId, clinicId);
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead already converted');

  let patientId = lead.patientId as string | null;

  if (!patientId) {
    const created = await criarPaciente({
      clinicId,
      name: lead.name as string,
      phone: (lead.phoneNormalized as string) || (lead.phone as string),
      email: (lead.email as string) || undefined,
    });
    void actorUserId;
    patientId = created.id;
  } else {
    const patient: any = await obterPaciente(clinicId, patientId);
    if (!patient) throw new Error('Patient not found');
    const needsUpdate =
      (lead.name != null && lead.name !== patient.name) ||
      (lead.phoneNormalized != null && lead.phoneNormalized !== patient.phone);
    if (needsUpdate) {
      const patch: Record<string, unknown> = {};
      if (lead.name != null && lead.name !== patient.name) patch.name = lead.name as string;
      if (lead.phoneNormalized != null && lead.phoneNormalized !== patient.phone) patch.phone = lead.phoneNormalized as string;
      await atualizarPaciente(clinicId, patientId, patch);
    }
  }

  if (!patientId) throw new Error('Patient resolution failed');
  return { lead, patientId };
}

// ─── agendarAvaliacao (legacy flow) ─────────────────────────────────────────────

export async function agendarAvaliacao(input: AgendarAvaliacaoInput) {
  const { leadId, clinicId, scheduledAt, dentistId, procedureId, durationMinutes, notes } = input;
  const actorUserId = input.actorUserId ?? null;

  // 1-2. Resolve patient via public seam (no buildSystemContext, no runAction)
  const { patientId } = await ensurePatientForLead({ leadId, clinicId, actorUserId });

  // 3. Schedule appointment via operacional public seam (tenant-scoped)
  const res = await agendarConsulta({ clinicId, patientId, dentistId: dentistId ?? null, procedureId: procedureId ?? null, scheduledAt, durationMinutes: durationMinutes ?? 30, notes });
  const appointmentId = res.id;

  // 4. Convert lead only after successful scheduling
  await updateLead(leadId, clinicId, {
    status: 'converted',
    patientId,
  } as Record<string, unknown>);

  await insertActivity({
    leadId,
    activityType: 'lead_converted',
    description: `Lead converted via agendarAvaliacao. Appointment: ${appointmentId}`,
    metadata: { appointmentId, scheduledAt: scheduledAt.toISOString() },
  });

  return { leadId, patientId, appointmentId, status: 'converted' as const };
}

// ─── converterLeadSemAgendar (new bridge for Financeiro) ────────────────────────

/**
 * Converts a lead to a patient without creating an appointment.
 *
 * 1. Resolves or creates patient via ensurePatientForLead.
 * 2. Marks lead as converted.
 * 3. Logs activity.
 *
 * Used by Financeiro module when a lead budget is accepted.
 */
export async function converterLeadSemAgendar(input: ConverterLeadSemAgendarInput) {
  const { leadId, clinicId } = input;
  const actorUserId = input.actorUserId ?? null;

  // 1-2. Resolve patient (shared helper)
  const { patientId } = await ensurePatientForLead({ leadId, clinicId, actorUserId });

  // 3. Convert lead
  await updateLead(leadId, clinicId, {
    status: 'converted',
    patientId,
  } as Record<string, unknown>);

  await insertActivity({
    leadId,
    activityType: 'lead_converted',
    description: 'Lead converted via converterLeadSemAgendar (no appointment)',
    metadata: { convertedWithoutAppointment: true },
  });

  return { leadId, patientId, status: 'converted' as const };
}
