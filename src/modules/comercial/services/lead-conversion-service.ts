/**
 * Comercial module — lead conversion service.
 *
 * Orchestrates agendarAvaliacao flow:
 * 1. Ensure patient exists (calls operacional.criarPaciente if missing)
 * 2. Schedule appointment (calls operacional.agendarConsulta)
 * 3. Only convert lead if scheduling succeeds.
 */

import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { findLeadByIdForClinic, updateLead } from '../repositories/leads-repository';
import { insertActivity } from '../repositories/activities-repository';

import { criarPaciente } from '@/modules/operacional/actions/criar-paciente';
import { agendarConsulta } from '@/modules/operacional/actions/agendar-consulta';

export interface AgendarAvaliacaoInput {
  leadId: string;
  clinicId: string;
  scheduledAt: Date;
  dentistId?: string;
  procedureId?: string;
  durationMinutes?: number;
  notes?: string;
}

export async function agendarAvaliacao(input: AgendarAvaliacaoInput) {
  const { leadId, clinicId, scheduledAt, dentistId, procedureId, durationMinutes, notes } = input;

  // 1. Find lead
  const lead = await findLeadByIdForClinic(leadId, clinicId);
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead already converted');

  // 2. Resolve patient
  let patientId = lead.patientId;
  if (!patientId) {
    const ctx = await buildSystemContext(clinicId);
    const createResult = await runAction(criarPaciente, {
      name: lead.name,
      phone: lead.phoneNormalized || lead.phone,
      email: lead.email || undefined,
    }, ctx);

    if (!createResult.ok) throw new Error(createResult.error.message);
    patientId = (createResult.data as { id: string }).id;
  }

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
