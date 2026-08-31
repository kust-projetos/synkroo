import { and, eq, inArray } from 'drizzle-orm';
import { campaigns, campaignRecipients, followUps } from '@/modules/followup/schema/campaigns';

function hasIds(ids: readonly string[]): ids is [string, ...string[]] { return ids.length > 0; }
async function selectByIds(tx: any, table: any, column: any, ids: string[]) {
  if (!hasIds(ids)) return [];
  return tx.select().from(table).where(inArray(column as never, ids));
}

export async function exportFollowupForPatient(clinicId: string, patientId: string, tx: any) {
  const campaignRows = await tx.select({ id: campaigns.id }).from(campaigns)
    .innerJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(eq(campaigns.clinicId, clinicId), eq(campaignRecipients.patientId, patientId)));
  const campaignIds = campaignRows.map((r: { id: string }) => r.id);
  const campaignRecipientRows = await selectByIds(tx, campaignRecipients, campaignRecipients.campaignId, campaignIds);
  const followUpRows = await tx.select().from(followUps).where(and(eq(followUps.clinicId, clinicId), eq(followUps.patientId, patientId)));
  return { campaignRecipients: campaignRecipientRows, followUps: followUpRows };
}

export async function anonymizeFollowupForPatient(clinicId: string, patientId: string, tx: any) {
  const now = new Date();
  const { campaignRecipients: recRows } = await exportFollowupForPatient(clinicId, patientId, tx);
  if (hasIds((recRows as any[]).map((r: any) => r.id))) {
    const ids = (recRows as any[]).map((r: any) => r.id);
    await tx.update(campaignRecipients).set({ responseContent: null, errorMessage: null }).where(inArray(campaignRecipients.id, ids));
  }
  await tx.update(followUps).set({ content: null, response: null, updatedAt: now }).where(and(eq(followUps.clinicId, clinicId), eq(followUps.patientId, patientId)));
}
