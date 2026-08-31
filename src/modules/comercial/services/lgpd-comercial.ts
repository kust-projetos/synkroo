import { and, eq, inArray, sql } from 'drizzle-orm';
import { leads, leadActivities } from '@/modules/comercial/schema/leads';
import { tasks } from '@/modules/comercial/schema/tasks';

function hasIds(ids: readonly string[]): ids is [string, ...string[]] { return ids.length > 0; }
async function selectByIds(tx: any, table: any, column: any, ids: string[]) {
  if (!hasIds(ids)) return [];
  return tx.select().from(table).where(inArray(column as never, ids));
}

export async function exportComercialForPatient(clinicId: string, patientId: string, tx: any) {
  const leadRows = await tx.select().from(leads).where(and(eq(leads.clinicId, clinicId), eq(leads.patientId, patientId)));
  const leadIds = leadRows.map((r: { id: string }) => r.id);
  const leadActivityRows = await selectByIds(tx, leadActivities, leadActivities.leadId, leadIds);
  const taskRows = hasIds(leadIds)
    ? await tx.select().from(tasks).where(and(eq(tasks.clinicId, clinicId), inArray(tasks.leadId, leadIds)))
    : [];
  return { leads: leadRows, leadActivities: leadActivityRows, tasks: taskRows };
}

export async function anonymizeComercialForPatient(clinicId: string, patientId: string, tx: any) {
  const now = new Date();
  const { leads: leadRows } = await exportComercialForPatient(clinicId, patientId, tx);
  const leadIds = (leadRows as any[]).map((r: any) => r.id);
  if (hasIds(leadIds)) {
    for (const lead of leadRows as any[]) {
      await tx.update(leads).set({
        name: 'Anonimizado',
        phone: `anon-lead-${lead.id.slice(0, 8)}`,
        email: null, interest: null, lostReason: null, notes: null, updatedAt: now,
      }).where(and(eq(leads.id, lead.id), eq(leads.clinicId, clinicId)));
    }
    await tx.update(leadActivities).set({ description: null, metadata: {} }).where(inArray(leadActivities.leadId, leadIds));
    await tx.update(tasks).set({ title: 'Tarefa anonimizada', description: null, updatedAt: now }).where(and(eq(tasks.clinicId, clinicId), inArray(tasks.leadId, leadIds)));
    await tx.execute(sql`UPDATE gateway_routing_rules SET lead_id = NULL, updated_at = ${now}
      WHERE clinic_id = ${clinicId} AND lead_id = ANY(${leadIds})`);
  }
}
