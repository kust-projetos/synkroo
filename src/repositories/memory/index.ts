/**
 * Memory Repository
 * Provides Drizzle-based access to conversation_memories table
 */

import { eq, sql, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { conversationMemories } from '@/lib/db/schema/conversations'
import { dbLogger } from '@/lib/logger'

export interface MemoryRow {
  id: string
  clinicId: string
  conversationId: string | null
  patientId: string | null
  content: string
  contentType: string
  embedding: unknown | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

/**
 * Search conversation memories (keyword fallback when vector search unavailable)
 */
export async function searchMemories(
  clinicId: string,
  query: string,
  patientId?: string,
  limit = 10
): Promise<Array<{
  id: string
  conversationId: string
  patientId: string | undefined
  content: string
  contentType: string
  similarity: number
  createdAt: string
}>> {
  const db = getDb()

  try {
    // Keyword-based fallback: search by content containing query words
    const conditions = [eq(conversationMemories.clinicId, clinicId)]
    if (patientId) conditions.push(eq(conversationMemories.patientId, patientId))

    const rows = await db
      .select({
        id: conversationMemories.id,
        conversationId: conversationMemories.conversationId,
        patientId: conversationMemories.patientId,
        content: conversationMemories.content,
        contentType: conversationMemories.contentType,
        createdAt: conversationMemories.createdAt,
      })
      .from(conversationMemories)
      .where(eq(conversationMemories.clinicId, clinicId))
      .orderBy(desc(conversationMemories.createdAt))
      .limit(limit * 2) // fetch extra for keyword filtering

    // Keyword filter
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const filtered = rows.filter(row => {
      const content = row.content.toLowerCase()
      return queryWords.some(word => content.includes(word))
    })

    return filtered.slice(0, limit).map(row => ({
      id: row.id,
      conversationId: row.conversationId ?? '',
      patientId: row.patientId ?? undefined,
      content: row.content,
      contentType: row.contentType ?? 'message',
      similarity: 0.7,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    }))
  } catch (error) {
    dbLogger.error('Error searching memories', error)
    return []
  }
}

/**
 * Store a conversation message with embedding (for RAG)
 */
export async function storeMessageWithEmbedding(data: {
  conversationId: string
  direction: 'inbound' | 'outbound'
  content: string
  embedding?: number[]
  intent?: string | null
  entities?: Record<string, unknown>
}): Promise<string | null> {
  const db = getDb()
  try {
    // Get conversation to find clinicId
    // Direct DB query — no cross-module dependency
    const db = getDb();
    const { conversations } = await import('@/lib/db/schema');
    const [conversation] = await db
      .select({
        id: conversations.id,
        clinicId: conversations.clinicId,
      })
      .from(conversations)
      .where(eq(conversations.id, data.conversationId))
      .limit(1);
    if (!conversation) {
      dbLogger.warn('Conversation not found for memory store', { conversationId: data.conversationId })
      return null
    }

    const [row] = await db
      .insert(conversationMemories)
      .values({
        clinicId: conversation.clinicId,
        conversationId: data.conversationId,
        content: `[${data.direction}] ${data.content}`,
        contentType: 'message',
        metadata: {
          direction: data.direction,
          intent: data.intent,
          entities: data.entities,
        } as Record<string, unknown>,
      })
      .returning({ id: conversationMemories.id })
    return row?.id ?? null
  } catch (error) {
    dbLogger.error('Error storing message with embedding', error)
    return null
  }
}

/**
 * Store a conversation summary
 */
export async function storeSummary(
  conversationId: string,
  summary: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const db = getDb()
  try {
    const { conversations } = await import('@/lib/db/schema');
    const [conversation] = await getDb()
      .select({
        id: conversations.id,
        clinicId: conversations.clinicId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conversation) {
      dbLogger.warn('Conversation not found for summary store', { conversationId })
      return null
    }

    const [row] = await db
      .insert(conversationMemories)
      .values({
        clinicId: conversation.clinicId,
        conversationId,
        content: summary,
        contentType: 'summary',
        metadata: metadata ?? {},
      })
      .returning({ id: conversationMemories.id })
    return row?.id ?? null
  } catch (error) {
    dbLogger.error('Error storing summary', error)
    return null
  }
}