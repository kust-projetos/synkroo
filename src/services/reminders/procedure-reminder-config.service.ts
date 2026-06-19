/**
 * Procedure Reminder Config Service
 * Manages per-procedure-type reminder configurations with D-05 defaults
 * Migrated from Supabase to Drizzle ORM.
 */

import { eq, and, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointmentReminderConfigs, procedureTypes } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'
import { fillTemplate } from '@/services/whatsapp/message-templates.service'
import { type ReminderConfigPerProcedure } from '@/components/whatsapp/reminder-config-types'

export type { ReminderConfigPerProcedure }

// -- D-05 defaults per procedure type name

const D05_DEFAULTS: Record<string, number> = {
  'check-up': 48,
  consulta: 48,
  avaliacao: 48,
  procedimento: 24,
  tratamento: 24,
  cirurgia: 24,
}

const DEFAULT_HOURS = 24

// -- Public helpers (no DB) -----------------------------------------------

export function getDefaultReminderHours(procedureTypeName: string): number {
  const normalized = procedureTypeName.toLowerCase().trim()
  return D05_DEFAULTS[normalized] ?? DEFAULT_HOURS
}

export function getDefaultTemplate(procedureTypeName: string): string {
  return `Olá {{paciente_nome}}! Aqui é da clínica. Lembrando que você tem uma consulta de {{procedimento}} marcada para {{data}} às {{horario}} com {{dentista}}. Por favor, confirme sua presença.`
}

// -- DB operations ---------------------------------------------------------

export async function getProcedureReminderConfig(
  clinicId: string,
  procedureTypeId: string
): Promise<ReminderConfigPerProcedure | null> {
  const db = getDb()

  try {
    const rows = await db.select()
      .from(appointmentReminderConfigs)
      .where(and(
        eq(appointmentReminderConfigs.clinicId, clinicId),
        eq(appointmentReminderConfigs.procedureTypeId, procedureTypeId),
      ))
      .limit(1)

    if (!rows.length) return null

    const row = rows[0]
    return {
      id: row.id,
      procedure_type_id: row.procedureTypeId,
      procedure_type_name: '', // caller provides this
      hours_before: row.hoursBefore,
      message_template: row.messageTemplate,
      enabled: row.enabled ?? true,
      created_at: row.createdAt?.toISOString(),
      updated_at: row.updatedAt?.toISOString(),
    }
  } catch (error) {
    dbLogger.error('Error fetching procedure reminder config', error)
    return null
  }
}

export async function getAllProcedureReminderConfigs(
  clinicId: string
): Promise<ReminderConfigPerProcedure[]> {
  const db = getDb()

  try {
    const rows = await db.select()
      .from(appointmentReminderConfigs)
      .where(eq(appointmentReminderConfigs.clinicId, clinicId))

    return rows.map((row) => ({
      id: row.id,
      procedure_type_id: row.procedureTypeId,
      procedure_type_name: '',
      hours_before: row.hoursBefore,
      message_template: row.messageTemplate,
      enabled: row.enabled ?? true,
      created_at: row.createdAt?.toISOString(),
      updated_at: row.updatedAt?.toISOString(),
    }))
  } catch (error) {
    dbLogger.error('Error fetching all procedure reminder configs', error)
    return []
  }
}

export async function saveProcedureReminderConfig(
  clinicId: string,
  config: Omit<ReminderConfigPerProcedure, 'created_at' | 'updated_at'>
): Promise<{ success: boolean; config?: ReminderConfigPerProcedure; error?: string }> {
  const db = getDb()

  try {
    const [row] = await db.insert(appointmentReminderConfigs)
      .values({
        clinicId,
        procedureTypeId: config.procedure_type_id,
        hoursBefore: config.hours_before,
        messageTemplate: config.message_template,
        enabled: config.enabled,
      })
      .onConflictDoUpdate({
        target: [appointmentReminderConfigs.clinicId, appointmentReminderConfigs.procedureTypeId],
        set: {
          hoursBefore: config.hours_before,
          messageTemplate: config.message_template,
          enabled: config.enabled,
          updatedAt: new Date(),
        },
      })
      .returning()

    return {
      success: true,
      config: {
        id: row.id,
        procedure_type_id: row.procedureTypeId,
        procedure_type_name: config.procedure_type_name,
        hours_before: row.hoursBefore,
        message_template: row.messageTemplate,
        enabled: row.enabled ?? true,
        created_at: row.createdAt?.toISOString(),
        updated_at: row.updatedAt?.toISOString(),
      },
    }
  } catch (error) {
    dbLogger.error('Error saving procedure reminder config', error)
    return { success: false, error: 'Failed to save config' }
  }
}

export async function getProcedureTypes(
  _clinicId: string
): Promise<Array<{ id: string; name: string }>> {
  const db = getDb()

  try {
    // Note: Drizzle schema does not include clinic_id on procedure_types.
    // The table is a global reference. clinicId param preserved for API compat.
    const rows = await db.select({ id: procedureTypes.id, name: procedureTypes.name })
      .from(procedureTypes)
      .orderBy(asc(procedureTypes.name))

    return rows
  } catch (error) {
    dbLogger.error('Error fetching procedure types', error)
    return []
  }
}

// -- Validation ------------------------------------------------------------

export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const placeholderRegex = /\{\{(\w+)\}\}/g
  const matches = template.match(placeholderRegex) || []
  const placeholders = matches.map((m) => m.replace(/\{\{|\}\}/g, ''))

  const validPattern = /^[a-zA-Z0-9_]+$/
  for (const ph of placeholders) {
    if (!ph.match(validPattern)) {
      errors.push(`Placeholder inválido: {{${ph}}}`)
    }
  }

  const supportedPlaceholders = ['paciente_nome', 'data', 'horario', 'dentista', 'procedimento']
  for (const ph of placeholders) {
    if (!supportedPlaceholders.includes(ph)) {
      errors.push(`Placeholder não suportado: {{${ph}}}. Use: ${supportedPlaceholders.join(', ')}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function replacePlaceholders(
  template: string,
  values: {
    paciente_nome?: string
    data?: string
    horario?: string
    dentista?: string
    procedimento?: string
  }
): string {
  const fakeTemplate = { body: template } as Parameters<typeof fillTemplate>[0]
  return fillTemplate(fakeTemplate, values as Record<string, string>)
}

export async function getEffectiveConfig(
  clinicId: string,
  procedureTypeId: string,
  procedureTypeName: string
): Promise<ReminderConfigPerProcedure> {
  const customConfig = await getProcedureReminderConfig(clinicId, procedureTypeId)

  if (customConfig) return customConfig

  return {
    procedure_type_id: procedureTypeId,
    procedure_type_name: procedureTypeName,
    hours_before: getDefaultReminderHours(procedureTypeName),
    message_template: getDefaultTemplate(procedureTypeName),
    enabled: true,
  }
}
