/**
 * Knowledge Base Repository
 * Provides Drizzle-based access to knowledge_base table
 */

import { eq, sql, or, like, and, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { dbLogger } from '@/lib/logger'

export interface KnowledgeRow {
  id: string
  clinicId: string
  category: string
  question: string
  answer: string
  keywords: string[]
  embedding: unknown | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Search knowledge base by text query (keyword/question matching)
 */
export async function searchKnowledgeBase(
  clinicId: string,
  query: string,
  limit = 5
): Promise<Array<{ id: string; category: string; question: string; answer: string; relevance: number }>> {
  const db = getDb()

  try {
    const rows = await db
      .select({
        id: knowledgeBase.id,
        category: knowledgeBase.category,
        question: knowledgeBase.question,
        answer: knowledgeBase.answer,
      })
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.clinicId, clinicId),
          eq(knowledgeBase.isActive, true),
          or(
            like(knowledgeBase.question, `%${query}%`),
            sql`${knowledgeBase.keywords}::text ILIKE ${`%${query}%`}`,
          ),
        )
      )
      .limit(limit)

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      question: r.question,
      answer: r.answer,
      relevance: 0.8,
    }))
  } catch (error) {
    dbLogger.error('Error searching knowledge base', error)
    return []
  }
}

/**
 * Get knowledge entry by ID
 */
export async function findKnowledgeById(id: string): Promise<KnowledgeRow | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.id, id))
    .limit(1)
  return (row as KnowledgeRow) ?? null
}

/**
 * Get all knowledge entries for a clinic
 */
export async function findKnowledgeByClinic(
  clinicId: string,
  opts: { category?: string; limit?: number; offset?: number } = {}
): Promise<{ entries: KnowledgeRow[]; total: number }> {
  const db = getDb()
  const { category, limit = 50, offset = 0 } = opts

  const conditions = [eq(knowledgeBase.clinicId, clinicId)]
  if (category) conditions.push(eq(knowledgeBase.category, category))

  const rows = await db
    .select()
    .from(knowledgeBase)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeBase)
    .where(and(...conditions))

  return {
    entries: rows as KnowledgeRow[],
    total: Number(countRow?.count ?? 0),
  }
}

/**
 * Create a knowledge entry
 */
export async function createKnowledgeEntry(data: {
  clinicId: string
  category: string
  question: string
  answer: string
  keywords?: string[]
}): Promise<KnowledgeRow> {
  const db = getDb()
  const [row] = await db
    .insert(knowledgeBase)
    .values({
      clinicId: data.clinicId,
      category: data.category,
      question: data.question,
      answer: data.answer,
      keywords: data.keywords ?? [],
    })
    .returning()
  return row as KnowledgeRow
}

/**
 * Update a knowledge entry
 */
export async function updateKnowledgeEntry(
  id: string,
  data: Partial<{
    category: string
    question: string
    answer: string
    keywords: string[]
    isActive: boolean
  }>
): Promise<KnowledgeRow | null> {
  const db = getDb()
  const [row] = await db
    .update(knowledgeBase)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(knowledgeBase.id, id))
    .returning()
  return (row as KnowledgeRow) ?? null
}

/**
 * Delete a knowledge entry
 */
export async function deleteKnowledgeEntry(id: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db
    .delete(knowledgeBase)
    .where(eq(knowledgeBase.id, id))
    .returning({ id: knowledgeBase.id })
  return row != null
}
