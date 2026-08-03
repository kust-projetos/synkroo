/**
 * pgvector Search & Upsert (ADR-BASE-04)
 *
 * Cosine similarity search via pgvector operator <=>.
 * Upsert stores or updates embedding for a knowledge_base row.
 */

import { sql, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { knowledgeBase } from '@/lib/db/schema/infra';
import { dbLogger } from '@/lib/logger';

export interface VectorSearchResult {
  id: string;
  category: string;
  question: string;
  answer: string;
  similarity: number; // 0..1, higher = more similar
}

/**
 * Search knowledge base by vector similarity (cosine distance).
 * Falls back to empty array on error.
 */
export async function searchByVector(
  clinicId: string,
  embedding: number[],
  limit = 5,
  threshold = 0.5,
): Promise<VectorSearchResult[]> {
  const db = getDb();
  try {
    // pgvector cosine similarity: 1 - (a <=> b)
    // <=> is cosine distance, so similarity = 1 - distance
    const vectorStr = `[${embedding.join(',')}]`;

    const rows = await db
      .select({
        id: knowledgeBase.id,
        category: knowledgeBase.category,
        question: knowledgeBase.question,
        answer: knowledgeBase.answer,
        similarity: sql<number>`1 - (${knowledgeBase.embedding} <=> ${vectorStr}::vector)`,
      })
      .from(knowledgeBase)
      .where(
        sql`${knowledgeBase.clinicId} = ${clinicId}
            AND ${knowledgeBase.isActive} = true
            AND ${knowledgeBase.embedding} IS NOT NULL
            AND 1 - (${knowledgeBase.embedding} <=> ${vectorStr}::vector) > ${threshold}`,
      )
      .orderBy(sql`1 - (${knowledgeBase.embedding} <=> ${vectorStr}::vector) DESC`)
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      question: r.question,
      answer: r.answer,
      similarity: Number(r.similarity),
    }));
  } catch (err) {
    dbLogger.error('Vector search failed', err);
    return [];
  }
}

/**
 * Store or update embedding for a knowledge base entry.
 */
export async function upsertEmbedding(
  knowledgeId: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  try {
    const vectorStr = `[${embedding.join(',')}]`;

    await db
      .update(knowledgeBase)
      .set({
        embedding: sql`${vectorStr}::vector`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, knowledgeId));

    return true;
  } catch (err) {
    dbLogger.error('Failed to upsert embedding', err, { knowledgeId });
    return false;
  }
}
