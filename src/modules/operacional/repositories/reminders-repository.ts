/**
 * Reminders repository — appointment reminder configs.
 * Uses operational schema.
 */

import { getDb } from '@/lib/db/client';
import { appointmentReminderConfigs, procedureTypes } from '../schema/appointments';
import { eq, and, isNull } from 'drizzle-orm';

export async function findReminderConfigById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appointmentReminderConfigs)
    .where(and(eq(appointmentReminderConfigs.id, id), isNull(appointmentReminderConfigs.clinicId)))
    .limit(1);
  return row ?? null;
}

export async function listReminderConfigs(clinicId: string) {
  const db = getDb();
  return db
    .select()
    .from(appointmentReminderConfigs)
    .where(eq(appointmentReminderConfigs.clinicId, clinicId));
}

export async function upsertReminderConfig(clinicId: string, data: {
  procedureTypeId: string;
  hoursBefore: number;
  messageTemplate: string;
  enabled: boolean;
}) {
  const db = getDb();
  const [row] = await db
    .insert(appointmentReminderConfigs)
    .values({ clinicId, ...data })
    .onConflictDoUpdate({
      target: [appointmentReminderConfigs.clinicId, appointmentReminderConfigs.procedureTypeId],
      set: { hoursBefore: data.hoursBefore, messageTemplate: data.messageTemplate, enabled: data.enabled, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function listProcedureTypes() {
  const db = getDb();
  return db.select().from(procedureTypes);
}

export async function findProcedureTypeById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(procedureTypes).where(eq(procedureTypes.id, id)).limit(1);
  return row ?? null;
}
