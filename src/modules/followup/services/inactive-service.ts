/**
 * Inactive patients — service bridge.
 *
 * Wraps legacy @/services/followup/inactive-patient.service.ts
 * and adds reactivatePatient (not present in legacy).
 */

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { patients } from '@/modules/operacional/schema';
import * as legacy from '@/services/followup/inactive-patient.service';
import type { InactivePatient } from '@/services/followup/inactive-patient.service';

export type { InactivePatient };
export type { InactivitySegment } from '@/services/followup/inactive-patient.service';

export const INACTIVITY_SEGMENTS = legacy.INACTIVITY_SEGMENTS;

export async function runInactivityDetection(): Promise<{ processed: number }> {
  await legacy.runInactivityDetection();
  return { processed: 1 };
}

export async function findInactivePatients(
  clinicId: string,
  minDays: number = 30
): Promise<InactivePatient[]> {
  return legacy.identifyInactivePatients(clinicId, minDays);
}

export async function reactivatePatient(patientId: string): Promise<{ success: boolean }> {
  const db = getDb();

  const [row] = await db
    .select({ tags: patients.tags, clinicId: patients.clinicId })
    .from(patients)
    .where(eq(patients.id, patientId));

  if (!row) {
    throw new Error(`Patient ${patientId} not found`);
  }

  const currentTags: string[] = (row.tags as string[]) || [];
  const cleanedTags = currentTags.filter(
    (tag: string) => !tag.startsWith('Inativo') && !tag.startsWith('inativo')
  );

  await db
    .update(patients)
    .set({
      status: 'active',
      tags: cleanedTags as any,
      riskScore: '0.00',
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));

  return { success: true };
}
