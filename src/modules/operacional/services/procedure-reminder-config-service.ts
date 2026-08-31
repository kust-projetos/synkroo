import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointmentReminderConfigs, procedureTypes } from '@/modules/operacional/schema/appointments';
import { dbLogger } from '@/lib/logger';
import { fillTemplate } from '@/lib/templates/fill';
import { type ReminderConfigPerProcedure } from '@/components/whatsapp/reminder-config-types';

export type { ReminderConfigPerProcedure };

const D05_DEFAULTS: Record<string, number> = {
  'check-up': 48,
  consulta: 48,
  avaliacao: 48,
  procedimento: 24,
  tratamento: 24,
  cirurgia: 24,
};
const DEFAULT_HOURS = 24;

export function getDefaultReminderHours(procedureTypeName: string): number {
  return D05_DEFAULTS[procedureTypeName.toLowerCase().trim()] ?? DEFAULT_HOURS;
}

export function getDefaultTemplate(_procedureTypeName: string): string {
  return 'Olá {{paciente_nome}}! Aqui é da clínica. Lembrando que você tem uma consulta de {{procedimento}} marcada para {{data}} às {{horario}} com {{dentista}}. Por favor, confirme sua presença.';
}

function toConfig(row: typeof appointmentReminderConfigs.$inferSelect, procedureTypeName = ''): ReminderConfigPerProcedure {
  return {
    id: row.id,
    procedure_type_id: row.procedureTypeId,
    procedure_type_name: procedureTypeName,
    hours_before: row.hoursBefore,
    message_template: row.messageTemplate,
    enabled: row.enabled ?? true,
    created_at: row.createdAt?.toISOString(),
    updated_at: row.updatedAt?.toISOString(),
  };
}

export async function getProcedureReminderConfig(clinicId: string, procedureTypeId: string): Promise<ReminderConfigPerProcedure | null> {
  try {
    const [row] = await getDb().select().from(appointmentReminderConfigs).where(and(
      eq(appointmentReminderConfigs.clinicId, clinicId),
      eq(appointmentReminderConfigs.procedureTypeId, procedureTypeId),
    )).limit(1);
    return row ? toConfig(row) : null;
  } catch (error) {
    dbLogger.error('Error fetching procedure reminder config', error);
    return null;
  }
}

export async function getAllProcedureReminderConfigs(clinicId: string): Promise<ReminderConfigPerProcedure[]> {
  try {
    const rows = await getDb().select().from(appointmentReminderConfigs)
      .where(eq(appointmentReminderConfigs.clinicId, clinicId));
    return rows.map((row) => toConfig(row));
  } catch (error) {
    dbLogger.error('Error fetching all procedure reminder configs', error);
    return [];
  }
}

export async function saveProcedureReminderConfig(
  clinicId: string,
  config: Omit<ReminderConfigPerProcedure, 'created_at' | 'updated_at'>,
): Promise<{ success: boolean; config?: ReminderConfigPerProcedure; error?: string }> {
  try {
    const [row] = await getDb().insert(appointmentReminderConfigs).values({
      clinicId,
      procedureTypeId: config.procedure_type_id,
      hoursBefore: config.hours_before,
      messageTemplate: config.message_template,
      enabled: config.enabled,
    }).onConflictDoUpdate({
      target: [appointmentReminderConfigs.clinicId, appointmentReminderConfigs.procedureTypeId],
      set: {
        hoursBefore: config.hours_before,
        messageTemplate: config.message_template,
        enabled: config.enabled,
        updatedAt: new Date(),
      },
    }).returning();
    return { success: true, config: toConfig(row, config.procedure_type_name) };
  } catch (error) {
    dbLogger.error('Error saving procedure reminder config', error);
    return { success: false, error: 'Failed to save config' };
  }
}

export async function getProcedureTypes(_clinicId: string): Promise<Array<{ id: string; name: string }>> {
  try {
    return await getDb().select({ id: procedureTypes.id, name: procedureTypes.name })
      .from(procedureTypes).orderBy(asc(procedureTypes.name));
  } catch (error) {
    dbLogger.error('Error fetching procedure types', error);
    return [];
  }
}

export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const placeholders = (template.match(/\{\{(\w+)\}\}/g) || []).map((match) => match.replace(/\{\{|\}\}/g, ''));
  const supported = ['paciente_nome', 'data', 'horario', 'dentista', 'procedimento'];
  for (const placeholder of placeholders) {
    if (!/^[a-zA-Z0-9_]+$/.test(placeholder)) errors.push(`Placeholder inválido: {{${placeholder}}}`);
    else if (!supported.includes(placeholder)) errors.push(`Placeholder não suportado: {{${placeholder}}}. Use: ${supported.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

export function replacePlaceholders(template: string, values: {
  paciente_nome?: string;
  data?: string;
  horario?: string;
  dentista?: string;
  procedimento?: string;
}): string {
  const fakeTemplate = { body: template } as Parameters<typeof fillTemplate>[0];
  return fillTemplate(fakeTemplate, values as Record<string, string>);
}

export async function getEffectiveConfig(
  clinicId: string,
  procedureTypeId: string,
  procedureTypeName: string,
): Promise<ReminderConfigPerProcedure> {
  const customConfig = await getProcedureReminderConfig(clinicId, procedureTypeId);
  return customConfig ?? {
    procedure_type_id: procedureTypeId,
    procedure_type_name: procedureTypeName,
    hours_before: getDefaultReminderHours(procedureTypeName),
    message_template: getDefaultTemplate(procedureTypeName),
    enabled: true,
  };
}
