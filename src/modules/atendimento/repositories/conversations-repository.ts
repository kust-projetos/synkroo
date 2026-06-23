/**
 * Atendimento — conversations repository adapter.
 *
 * Wraps the existing @/repositories/conversations module,
 * adding specific operations required by atendimento actions.
 * Built on existing schema and repo patterns.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { conversations } from '../schema/conversations';
import * as repo from '@/repositories/conversations';

export async function findByClinic(clinicId: string, opts?: { status?: string; channel?: string; page?: number; limit?: number }) {
  return repo.findByClinic(clinicId, {
    status: opts?.status,
    channel: opts?.channel,
    limit: opts?.limit,
    offset: opts?.page ? (opts.page - 1) * (opts.limit ?? 50) : undefined,
  });
}

export async function findByIdWithJoins(id: string, clinicId: string) {
  return repo.findByIdWithJoins(id, clinicId);
}

export async function countByClinic(clinicId: string, opts?: { status?: string; channel?: string }) {
  return repo.countByClinic(clinicId, opts);
}

export async function findMessagesByConversation(conversationId: string, opts?: { limit?: number; page?: number }) {
  return repo.findMessagesByConversation(conversationId, {
    limit: opts?.limit,
    offset: opts?.page ? (opts.page - 1) * (opts.limit ?? 50) : undefined,
  });
}

export async function createConversation(data: {
  clinicId: string;
  channel: string;
  externalId: string;
  patientId?: string | null;
  status?: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(conversations)
    .values({
      clinicId: data.clinicId,
      channel: data.channel as any,
      externalId: data.externalId,
      patientId: data.patientId ?? null,
      status: (data.status ?? 'active') as any,
    } as any)
    .returning({ id: conversations.id });
  return { id: row.id };
}

export async function archiveConversation(id: string, clinicId: string) {
  const db = getDb();
  const [row] = await db
    .update(conversations)
    .set({ status: 'closed' as any, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.clinicId, clinicId)))
    .returning({ id: conversations.id });
  return row ?? null;
}

export async function escalateConversation(id: string, clinicId: string) {
  const db = getDb();
  const [row] = await db
    .update(conversations)
    .set({ status: 'escalated' as any, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.clinicId, clinicId)))
    .returning({ id: conversations.id });
  return row ?? null;
}
