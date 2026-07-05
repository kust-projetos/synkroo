/**
 * Comercial module — lead conversion service.
 *
 * Orchestrates:
 * - agendarAvaliacao: ensure patient exists → schedule appointment → convert lead
 * - converterLeadSemAgendar: ensure patient exists → convert lead (no appointment)
 *
 * Shared helper: ensurePatientForLead resolves or creates a patient from lead data.
 */

import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { findLeadByIdForClinic, updateLead } from '../repositories/leads-repository';
import { insertActivity } from '../repositories/activities-repository';

import { criarPaciente, atualizarPaciente, obterPaciente, agendarConsulta } from '@/modules/operacional/actions';

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
}

export interface ConverterLeadSemAgendarInput {
  leadId: string;
  clinicId: string;
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
  leadId: string,
  clinicId: string,
): Promise<EnsurePatientResult> {
  const lead = await findLeadByIdForClinic(leadId, clinicId);
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead already converted');

  let patientId = lead.patientId as string | null;

  if (!patientId) {
    const ctx = await buildSystemContext(clinicId);
    const createResult = await runAction(criarPaciente, {
      name: lead.name as string,
      phone: (lead.phoneNormalized as string) || (lead.phone as string),
      email: (lead.email as string) || undefined,
    }, ctx);

    if (!createResult.ok) throw new Error(createResult.error.message);
    patientId = (createResult.data as { id: string }).id;
  } else {
    // Check if lead data changed compared to current patient
    const ctx = await buildSystemContext(clinicId);
    const patientResult = await runAction(obterPaciente, { id: patientId }, ctx);
    if (patientResult.ok) {
      const patientData = patientResult.data as { name?: string; phone?: string; email?: string | null };
      const needsUpdate =
        (lead.name != null && lead.name !== patientData.name) ||
        (lead.phoneNormalized != null && lead.phoneNormalized !== patientData.phone);

      if (needsUpdate) {
        const patch: Record<string, unknown> = {};
        if (lead.name != null && lead.name !== patientData.name) patch.name = lead.name;
        if (lead.phoneNormalized != null && lead.phoneNormalized !== patientData.phone) patch.phone = lead.phoneNormalized;

        await runAction(atualizarPaciente, { id: patientId, ...patch }, ctx);
      }
    }
  }

  return { lead, patientId };
}

// ─── agendarAvaliacao (legacy flow) ─────────────────────────────────────────────

export async function agendarAvaliacao(input: AgendarAvaliacaoInput) {
  const { leadId, clinicId, scheduledAt, dentistId, procedureId, durationMinutes, notes } = input;

  // 1-2. Resolve patient (extracted helper)
  const { lead, patientId } = await ensurePatientForLead(leadId, clinicId);

  // 3. Schedule appointment
  const ctx = await buildSystemContext(clinicId);
  const scheduleResult = await runAction(agendarConsulta, {
    patientId,
    dentistId,
    procedureId,
    scheduledAt,
    durationMinutes: durationMinutes ?? 30,
    notes,
  }, ctx);

  if (!scheduleResult.ok) throw new Error(scheduleResult.error.message);
  const appointmentId = (scheduleResult.data as { id: string }).id;

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

  // 1-2. Resolve patient (shared helper)
  const { lead, patientId } = await ensurePatientForLead(leadId, clinicId);

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
