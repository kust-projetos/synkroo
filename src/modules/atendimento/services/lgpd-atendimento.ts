import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { conversations, messages, conversationStates, conversationSessions, conversationMemories } from '@/modules/atendimento/schema/conversations';

function hasIds(ids: readonly string[]): ids is [string, ...string[]] { return ids.length > 0; }
async function selectByIds(tx: any, table: any, column: any, ids: string[]) {
  if (!hasIds(ids)) return [];
  return tx.select().from(table).where(inArray(column as never, ids));
}

export async function exportAtendimentoForPatient(clinicId: string, patientId: string, tx: any) {
  const conversationRows = await tx.select().from(conversations).where(and(eq(conversations.clinicId, clinicId), eq(conversations.patientId, patientId)));
  const conversationIds = conversationRows.map((r: { id: string }) => r.id);
  const messageRows = await selectByIds(tx, messages, messages.conversationId, conversationIds);
  const conversationStateRows = await selectByIds(tx, conversationStates, conversationStates.conversationId, conversationIds);
  const conversationSessionRows = await selectByIds(tx, conversationSessions, conversationSessions.conversationId, conversationIds);
  const conversationMemoryRows = await tx.select().from(conversationMemories).where(
    hasIds(conversationIds)
      ? and(eq(conversationMemories.clinicId, clinicId), or(eq(conversationMemories.patientId, patientId), inArray(conversationMemories.conversationId, conversationIds)))
      : and(eq(conversationMemories.clinicId, clinicId), eq(conversationMemories.patientId, patientId)),
  );
  return {
    conversations: conversationRows,
    messages: messageRows,
    conversationStates: conversationStateRows,
    conversationSessions: conversationSessionRows,
    conversationMemories: conversationMemoryRows,
  };
}

export async function anonymizeAtendimentoForPatient(clinicId: string, patientId: string, tx: any) {
  const now = new Date();
  const { conversations: convRows } = await exportAtendimentoForPatient(clinicId, patientId, tx);
  const convIds = (convRows as any[]).map((r: any) => r.id);
  for (const conv of convRows as any[]) {
    await tx.update(conversations).set({ externalId: `conversation-${conv.id.slice(0, 8)}`, metadata: {}, updatedAt: now })
      .where(and(eq(conversations.id, conv.id), eq(conversations.clinicId, clinicId)));
  }
  if (hasIds(convIds)) {
    await tx.update(messages).set({ content: '', mediaUrl: null, metadata: {}, intent: null, entities: {}, embedding: null }).where(inArray(messages.conversationId, convIds));
    await tx.update(conversationStates).set({ state: {}, updatedAt: now }).where(inArray(conversationStates.conversationId, convIds));
    await tx.update(conversationSessions).set({ entries: [], extractedInfo: {}, lastActivityAt: now }).where(inArray(conversationSessions.conversationId, convIds));
    await tx.update(conversationMemories).set({ content: '', metadata: {}, embedding: null, updatedAt: now }).where(inArray(conversationMemories.conversationId, convIds));
  }
}
