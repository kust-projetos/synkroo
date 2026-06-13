/**
 * Conversation Sessions Repository
 * Provides Drizzle-based access to conversation_sessions table
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { conversationSessions } from '@/lib/db/schema/conversations'
import { dbLogger } from '@/lib/logger'

export interface SessionRow {
  id: string
  conversationId: string
  entries: Array<{
    role: string
    content: string
    timestamp: Date | string
    intent?: string
    entities?: Record<string, unknown>
  }>
  extractedInfo: Record<string, unknown>
  createdAt: Date
  lastActivityAt: Date
}

/**
 * Get session by conversation ID
 */
export async function findByConversationId(conversationId: string): Promise<SessionRow | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.conversationId, conversationId))
    .limit(1)
  return (row as SessionRow) ?? null
}

/**
 * Create a new session for a conversation
 */
export async function createSession(conversationId: string): Promise<SessionRow> {
  const db = getDb()
  const now = new Date()
  const [row] = await db
    .insert(conversationSessions)
    .values({
      conversationId,
      entries: [],
      extractedInfo: {},
    })
    .returning()
  return row as SessionRow
}

/**
 * Update session entries and extracted info
 */
export async function updateSession(
  conversationId: string,
  data: {
    entries?: Array<{
      role: string
      content: string
      timestamp: string
      intent?: string
      entities?: Record<string, unknown>
    }>
    extractedInfo?: Record<string, unknown>
    lastActivityAt?: Date
  }
): Promise<SessionRow | null> {
  const db = getDb()
  const updateData: Record<string, unknown> = {}
  if (data.entries !== undefined) updateData.entries = data.entries
  if (data.extractedInfo !== undefined) updateData.extractedInfo = data.extractedInfo
  if (data.lastActivityAt) updateData.lastActivityAt = data.lastActivityAt
  updateData.lastActivityAt = data.lastActivityAt ?? new Date()

  const [row] = await db
    .update(conversationSessions)
    .set(updateData as any)
    .where(eq(conversationSessions.conversationId, conversationId))
    .returning()
  return (row as SessionRow) ?? null
}

/**
 * Delete session by conversation ID
 */
export async function deleteSession(conversationId: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db
    .delete(conversationSessions)
    .where(eq(conversationSessions.conversationId, conversationId))
    .returning({ id: conversationSessions.id })
  return row != null
}