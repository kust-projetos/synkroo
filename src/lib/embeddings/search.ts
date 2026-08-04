import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { knowledgeBase } from '@/lib/db/schema/infra';
import { EMBEDDING_DIMENSIONS } from './generate';
import { dbLogger } from '@/lib/logger';

export interface VectorSearchResult {
  id: string;
  category: string;
  question: string;
  answer: string;
  similarity: number;
}

function vectorLiteral(embedding: number[]): string | null {
  if (embedding.length !== EMBEDDING_DIMENSIONS) return null;
  if (!embedding.every((value) => Number.isFinite(value))) return null;
  return `[${embedding.join(',')}]`;
}

export async function searchByVector(
  clinicId: string,
  embedding: number[],
  limit = 5,
  threshold = 0.5,
): Promise<VectorSearchResult[]> {
  const vectorStr = vectorLiteral(embedding);
  if (!vectorStr) return [];
  try {
    const rows = await getDb().select({
      id: knowledgeBase.id,
      category: knowledgeBase.category,
      question: knowledgeBase.question,
      answer: knowledgeBase.answer,
      similarity: sql<number>`1 - (${knowledgeBase.embedding} <=> ${vectorStr}::vector)`,
    }).from(knowledgeBase).where(sql`${knowledgeBase.clinicId} = ${clinicId}
      AND ${knowledgeBase.isActive} = true
      AND ${knowledgeBase.embedding} IS NOT NULL
      AND 1 - (${knowledgeBase.embedding} <=> ${vectorStr}::vector) > ${threshold}`)
      .orderBy(sql`1 - (${knowledgeBase.embedding} <=> ${vectorStr}::vector) DESC`).limit(limit);
    return rows.map((row) => ({ ...row, similarity: Number(row.similarity) }));
  } catch (error) {
    dbLogger.error('Vector search failed', error);
    return [];
  }
}

export async function upsertEmbedding(
  clinicId: string,
  knowledgeId: string,
  embedding: number[],
): Promise<boolean> {
  const vectorStr = vectorLiteral(embedding);
  if (!vectorStr) return false;
  try {
    await getDb().update(knowledgeBase).set({
      embedding: sql`${vectorStr}::vector`,
      updatedAt: new Date(),
    }).where(and(eq(knowledgeBase.id, knowledgeId), eq(knowledgeBase.clinicId, clinicId)));
    return true;
  } catch (error) {
    dbLogger.error('Failed to upsert embedding', error, { knowledgeId });
    return false;
  }
}
