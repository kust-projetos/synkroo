/**
 * RAG & Knowledge Base Service (F6.10 / O3-G06)
 *
 * Implements tenant-scoped Knowledge CRUD, document ingestion with chunking,
 * embedding generation and vector similarity search (pgvector) with keyword fallback.
 */

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { knowledgeBase } from '@/lib/db/schema/infra';
import { generateEmbedding, searchByVector, upsertEmbedding } from '@/lib/embeddings';
import { searchKnowledgeBase } from '@/repositories/knowledge';
import { dbLogger } from '@/lib/logger';

export interface KnowledgeEntry {
  id: string;
  clinicId: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  embedding?: unknown | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeInput {
  category: string;
  question: string;
  answer: string;
  keywords?: string[];
  isActive?: boolean;
}

export interface UpdateKnowledgeInput {
  category?: string;
  question?: string;
  answer?: string;
  keywords?: string[];
  isActive?: boolean;
}

export interface SearchResult {
  id: string;
  category: string;
  question: string;
  /**
   * B1 (knowledge untrusted) — conteúdo recuperado da base é DADO externo
   * não confiável: NUNCA injetar em prompt como instrução; ao compor prompt,
   * envolver nos blocos `<dados_contexto>` (ver `personas.wrapContextData`).
   */
  answer: string;
  relevance: number;
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IngestDocumentInput {
  category: string;
  title?: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IngestDocumentResult {
  chunksCreated: number;
  chunkIds: string[];
}

/**
 * Splits text into overlapping chunks respecting sentence and word boundaries.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 500;
  const chunkOverlap = options.chunkOverlap ?? 50;

  const clean = text.trim().replace(/\r\n/g, '\n');
  if (clean.length <= chunkSize) {
    return [clean];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < clean.length) {
    const endIndex = startIndex + chunkSize;

    if (endIndex >= clean.length) {
      chunks.push(clean.slice(startIndex).trim());
      break;
    }

    // Try to find a sentence ending or whitespace near endIndex
    const lastPeriod = clean.lastIndexOf('. ', endIndex);
    const lastNewline = clean.lastIndexOf('\n', endIndex);
    const lastSpace = clean.lastIndexOf(' ', endIndex);

    let splitIndex = endIndex;
    if (lastPeriod > startIndex + chunkSize / 2) {
      splitIndex = lastPeriod + 1;
    } else if (lastNewline > startIndex + chunkSize / 2) {
      splitIndex = lastNewline + 1;
    } else if (lastSpace > startIndex + chunkSize / 2) {
      splitIndex = lastSpace + 1;
    }

    const chunk = clean.slice(startIndex, splitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = Math.max(splitIndex - chunkOverlap, startIndex + 1);
  }

  return chunks;
}

export class RagService {
  /**
   * Create a new knowledge entry with optional automatic embedding generation.
   */
  async createKnowledge(
    clinicId: string,
    input: CreateKnowledgeInput,
    options: { generateEmbedding?: boolean } = {},
  ): Promise<KnowledgeEntry> {
    const db = getDb();
    const [row] = await db
      .insert(knowledgeBase)
      .values({
        clinicId,
        category: input.category,
        question: input.question,
        answer: input.answer,
        keywords: input.keywords ?? [],
        isActive: input.isActive ?? true,
      })
      .returning();

    const entry: KnowledgeEntry = {
      id: row.id,
      clinicId: row.clinicId,
      category: row.category,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords ?? [],
      embedding: row.embedding,
      isActive: row.isActive ?? true,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };

    if (options.generateEmbedding) {
      const textToEmbed = `${input.question}\n${input.answer}`;
      try {
        const emb = await generateEmbedding(textToEmbed);
        if (emb?.vector) {
          await upsertEmbedding(clinicId, entry.id, emb.vector);
        }
      } catch (err) {
        dbLogger.error('Failed to compute embedding during creation', err, { id: entry.id });
      }
    }

    return entry;
  }

  /**
   * Retrieve a knowledge entry by ID (strictly tenant-scoped).
   */
  async getKnowledge(clinicId: string, id: string): Promise<KnowledgeEntry | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(knowledgeBase)
      .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.clinicId, clinicId)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      clinicId: row.clinicId,
      category: row.category,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords ?? [],
      embedding: row.embedding,
      isActive: row.isActive ?? true,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };
  }

  /**
   * List knowledge entries for a clinic with pagination and optional category filter.
   */
  async listKnowledge(
    clinicId: string,
    options: { category?: string; limit?: number; offset?: number } = {},
  ): Promise<{ entries: KnowledgeEntry[]; total: number }> {
    const db = getDb();
    const { category, limit = 50, offset = 0 } = options;

    const conditions = [eq(knowledgeBase.clinicId, clinicId)];
    if (category) {
      conditions.push(eq(knowledgeBase.category, category));
    }

    const rows = await db
      .select()
      .from(knowledgeBase)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeBase)
      .where(and(...conditions));

    const entries: KnowledgeEntry[] = rows.map((r) => ({
      id: r.id,
      clinicId: r.clinicId,
      category: r.category,
      question: r.question,
      answer: r.answer,
      keywords: r.keywords ?? [],
      embedding: r.embedding,
      isActive: r.isActive ?? true,
      createdAt: r.createdAt ?? new Date(),
      updatedAt: r.updatedAt ?? new Date(),
    }));

    return {
      entries,
      total: Number(countRow?.count ?? 0),
    };
  }

  /**
   * Update a knowledge entry (strictly tenant-scoped).
   */
  async updateKnowledge(
    clinicId: string,
    id: string,
    data: UpdateKnowledgeInput,
    options: { recomputeEmbedding?: boolean } = {},
  ): Promise<KnowledgeEntry | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.category !== undefined) updateData.category = data.category;
    if (data.question !== undefined) updateData.question = data.question;
    if (data.answer !== undefined) updateData.answer = data.answer;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [row] = await db
      .update(knowledgeBase)
      .set(updateData)
      .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.clinicId, clinicId)))
      .returning();

    if (!row) return null;

    const entry: KnowledgeEntry = {
      id: row.id,
      clinicId: row.clinicId,
      category: row.category,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords ?? [],
      embedding: row.embedding,
      isActive: row.isActive ?? true,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };

    if (options.recomputeEmbedding || data.question !== undefined || data.answer !== undefined) {
      const textToEmbed = `${entry.question}\n${entry.answer}`;
      try {
        const emb = await generateEmbedding(textToEmbed);
        if (emb?.vector) {
          await upsertEmbedding(clinicId, entry.id, emb.vector);
        }
      } catch (err) {
        dbLogger.error('Failed to recompute embedding during update', err, { id: entry.id });
      }
    }

    return entry;
  }

  /**
   * Delete a knowledge entry (strictly tenant-scoped).
   */
  async deleteKnowledge(clinicId: string, id: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db
      .delete(knowledgeBase)
      .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.clinicId, clinicId)))
      .returning({ id: knowledgeBase.id });

    return row !== undefined;
  }

  /**
   * Search knowledge base using vector similarity (pgvector) with automatic keyword fallback.
   *
   * B1 — bounds defensivos (a borda HTTP já faz clamp Zod; isto protege
   * callers internos): limit 1–50, threshold 0–1.
   *
   * UNTRUSTED: os `SearchResult` retornados são dado externo não confiável —
   * nunca instrução. Quem injetar em prompt deve delimitar como dado.
   */
  async searchKnowledge(
    clinicId: string,
    query: string,
    options: { limit?: number; threshold?: number } = {},
  ): Promise<SearchResult[]> {
    const limit = Math.min(50, Math.max(1, Math.floor(options.limit ?? 5) || 5));
    const threshold = Math.min(1, Math.max(0, options.threshold ?? 0.5));

    // 1. Try Vector Similarity Search via pgvector
    try {
      const embResult = await generateEmbedding(query);
      if (embResult?.vector && embResult.vector.length > 0) {
        const vectorResults = await searchByVector(clinicId, embResult.vector, limit, threshold);
        if (vectorResults.length > 0) {
          return vectorResults.map((r) => ({
            id: r.id,
            category: r.category,
            question: r.question,
            answer: r.answer,
            relevance: r.similarity,
          }));
        }
      }
    } catch (err) {
      dbLogger.warn('Vector search failed, falling back to keyword search', { clinicId, error: err });
    }

    // 2. Fallback: Keyword & Full-Text Search
    const keywordResults = await searchKnowledgeBase(clinicId, query, limit);
    return keywordResults;
  }

  /**
   * Ingest a long document by splitting into chunks and computing embeddings.
   */
  async ingestDocument(
    clinicId: string,
    input: IngestDocumentInput,
  ): Promise<IngestDocumentResult> {
    // B1 — bounds defensivos (borda HTTP já faz clamp Zod; isto protege
    // callers internos contra chunkSize absurdo/NaN).
    const clampInt = (v: number | undefined, lo: number, hi: number): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : undefined;
    const chunks = chunkText(input.content, {
      chunkSize: clampInt(input.chunkSize, 100, 2000),
      chunkOverlap: clampInt(input.chunkOverlap, 0, 500),
    });

    const chunkIds: string[] = [];

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const title = input.title ? `${input.title} (Parte ${idx + 1})` : `Seção ${idx + 1}`;

      const entry = await this.createKnowledge(
        clinicId,
        {
          category: input.category,
          question: title,
          answer: chunk,
          keywords: [input.category, ...(input.title ? [input.title] : [])],
        },
        { generateEmbedding: true },
      );

      chunkIds.push(entry.id);
    }

    return {
      chunksCreated: chunks.length,
      chunkIds,
    };
  }

  /**
   * Purge knowledge entries for a specific clinic.
   */
  async purgeKnowledge(clinicId: string, options: { category?: string } = {}): Promise<number> {
    const db = getDb();
    const conditions = [eq(knowledgeBase.clinicId, clinicId)];
    if (options.category) {
      conditions.push(eq(knowledgeBase.category, options.category));
    }

    const rows = await db
      .delete(knowledgeBase)
      .where(and(...conditions))
      .returning({ id: knowledgeBase.id });

    return rows.length;
  }
}

export const ragService = new RagService();
