import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointments, patients, dentists, procedures, clinics } from '@/lib/db/schema';
import { getEffectiveConfig, replacePlaceholders } from '@/services/reminders/procedure-reminder-config.service';

async function getAppointmentWithJoins(id: string, clinicId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      patient: { id: patients.id, name: patients.name, phone: patients.phone },
      dentist: { name: dentists.name },
      procedure: { id: procedures.id, name: procedures.name },
      clinic: { id: clinics.id, name: clinics.name, phone: clinics.phone },
    })
    .from(appointments)
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(dentists, eq(dentists.id, appointments.dentistId))
    .leftJoin(procedures, eq(procedures.id, appointments.procedureId))
    .where(eq(appointments.id, id))
    .limit(1);

  if (!rows.length) return null;
  const apt = rows[0];
  if (apt.clinic.id !== clinicId) throw new ActionError('forbidden', 'Acesso negado.');
  return apt;
}

export const obterModeloLembrete = defineAction({
  name: 'operacional.obterModeloLembrete',
  module: 'operacional',
  requires: 'operacional:manage_reminders',
  label: 'Obter modelo de lembrete',
  input: z.object({
    id: z.string().uuid(),
    mode: z.enum(['preview', 'template']).default('template'),
  }),
  handler: async (input, ctx: ActionContext) => {
    const apt = await getAppointmentWithJoins(input.id, ctx.clinicId);
    if (!apt) throw new ActionError('not_found', 'Agendamento não encontrado.');

    const procedureTypeId = apt.procedure?.id || '';
    const procedureTypeName = apt.procedure?.name || '';
    const config = await getEffectiveConfig(ctx.clinicId, procedureTypeId, procedureTypeName);

    if (input.mode === 'preview') {
      const scheduledAt = new Date(apt.scheduledAt);
      const filledMessage = replacePlaceholders(config.message_template, {
        paciente_nome: apt.patient?.name || '',
        data: scheduledAt.toLocaleDateString('pt-BR'),
        horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dentista: apt.dentist?.name || '',
        procedimento: procedureTypeName,
      });
      return {
        preview: {
          original_template: config.message_template,
          filled_message: filledMessage,
          placeholders: {
            paciente_nome: apt.patient?.name || '',
            data: scheduledAt.toLocaleDateString('pt-BR'),
            horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            dentista: apt.dentist?.name || '',
            procedimento: procedureTypeName,
          },
        },
      };
    }

    const scheduledAt = new Date(apt.scheduledAt);
    const filledMessage = replacePlaceholders(config.message_template, {
      paciente_nome: apt.patient?.name || '',
      data: scheduledAt.toLocaleDateString('pt-BR'),
      horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dentista: apt.dentist?.name || '',
      procedimento: procedureTypeName,
    });

    return {
      template: {
        procedure_type: procedureTypeName,
        hours_before: config.hours_before,
        message_template: config.message_template,
        filled_message: filledMessage,
        enabled: config.enabled,
      },
    };
  },
});
