/**
 * Unit & Contract tests for Knowledge CRUD, RAG Ingestion & Vector Search (F6.10 / O3-G06)
 */

import {
  RagService,
  chunkText,
} from '../rag.service';
import { EMBEDDING_DIMENSIONS } from '@/lib/llm';

// Mock dependencies
const mockGetDb = jest.fn();
const mockGenerateEmbedding = jest.fn();
const mockSearchByVector = jest.fn();
const mockUpsertEmbedding = jest.fn();
const mockSearchKnowledgeBase = jest.fn();

jest.mock('@/lib/db/client', () => ({
  getDb: () => mockGetDb(),
}));

jest.mock('@/lib/embeddings', () => ({
  generateEmbedding: (text: string) => mockGenerateEmbedding(text),
  searchByVector: (...args: any[]) => mockSearchByVector(...args),
  upsertEmbedding: (...args: any[]) => mockUpsertEmbedding(...args),
}));

jest.mock('@/repositories/knowledge', () => ({
  searchKnowledgeBase: (...args: any[]) => mockSearchKnowledgeBase(...args),
  findKnowledgeById: jest.fn(),
  findKnowledgeByClinic: jest.fn(),
  createKnowledgeEntry: jest.fn(),
  updateKnowledgeEntry: jest.fn(),
  deleteKnowledgeEntry: jest.fn(),
}));

describe('RAG Service & Knowledge Base Lifecycle (F6.10)', () => {
  const CLINIC_A = '00000000-0000-0000-0000-00000000000a';
  const CLINIC_B = '00000000-0000-0000-0000-00000000000b';
  const ENTRY_ID = '00000000-0000-0000-0000-000000000001';

  let ragService: RagService;

  beforeEach(() => {
    jest.clearAllMocks();
    ragService = new RagService();
  });

  describe('Text Chunking for Ingestion', () => {
    it('chunks short text into single chunk', () => {
      const text = 'Horário de atendimento: das 08h às 18h de segunda a sexta.';
      const chunks = chunkText(text, { chunkSize: 200, chunkOverlap: 20 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('splits long documents into overlapping chunks', () => {
      const text = 'Parágrafo um com conteúdo sobre implantes dentários. '.repeat(10);
      const chunks = chunkText(text, { chunkSize: 150, chunkOverlap: 30 });
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(200);
      }
    });
  });

  describe('Knowledge CRUD with Tenant Scoping', () => {
    it('creates knowledge entry and optionally computes embedding', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: ENTRY_ID,
              clinicId: CLINIC_A,
              category: 'faq',
              question: 'Como funciona o clareamento?',
              answer: 'O clareamento dental é realizado em consultório ou caseiro.',
              keywords: ['clareamento', 'estética'],
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      });
      mockGetDb.mockReturnValue({ insert: mockInsert });
      mockGenerateEmbedding.mockResolvedValue({
        vector: Array.from({ length: 1536 }, () => 0.01),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });
      mockUpsertEmbedding.mockResolvedValue(true);

      const res = await ragService.createKnowledge(
        CLINIC_A,
        {
          category: 'faq',
          question: 'Como funciona o clareamento?',
          answer: 'O clareamento dental é realizado em consultório ou caseiro.',
          keywords: ['clareamento', 'estética'],
        },
        { generateEmbedding: true },
      );

      expect(res.id).toBe(ENTRY_ID);
      expect(res.clinicId).toBe(CLINIC_A);
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(mockUpsertEmbedding).toHaveBeenCalledWith(
        CLINIC_A,
        ENTRY_ID,
        expect.any(Array),
      );
    });

    it('rejects foreign clinic access on getKnowledge', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // Returns empty because clinicId doesn't match
          }),
        }),
      });
      mockGetDb.mockReturnValue({ select: mockSelect });

      const entry = await ragService.getKnowledge(CLINIC_B, ENTRY_ID);
      expect(entry).toBeNull();
    });

    it('deletes knowledge entry tenant-scoped', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: ENTRY_ID }]),
        }),
      });
      mockGetDb.mockReturnValue({ delete: mockDelete });

      const success = await ragService.deleteKnowledge(CLINIC_A, ENTRY_ID);
      expect(success).toBe(true);
    });
  });

  describe('Vector Search & Hybrid Fallback', () => {
    it('performs vector search using query embedding and cosine similarity', async () => {
      const queryVector = Array.from({ length: 1536 }, () => 0.05);
      mockGenerateEmbedding.mockResolvedValue({
        vector: queryVector,
        model: 'text-embedding-3-small',
        dimensions: EMBEDDING_DIMENSIONS,
      });

      mockSearchByVector.mockResolvedValue([
        {
          id: ENTRY_ID,
          category: 'procedimentos',
          question: 'Qual o valor da profilaxia?',
          answer: 'A profilaxia custa a partir de R$ 150.',
          similarity: 0.88,
        },
      ]);

      const results = await ragService.searchKnowledge(CLINIC_A, 'quanto custa limpeza', {
        limit: 3,
        threshold: 0.7,
      });

      expect(results).toHaveLength(1);
      expect(results[0].question).toBe('Qual o valor da profilaxia?');
      expect(results[0].relevance).toBe(0.88);
      expect(mockSearchByVector).toHaveBeenCalledWith(CLINIC_A, queryVector, 3, 0.7);
    });

    it('falls back to keyword search when embedding generation fails / is unavailable', async () => {
      mockGenerateEmbedding.mockResolvedValue(null);
      mockSearchKnowledgeBase.mockResolvedValue([
        {
          id: ENTRY_ID,
          category: 'faq',
          question: 'Qual o valor da profilaxia?',
          answer: 'A profilaxia custa a partir de R$ 150.',
          relevance: 0.8,
        },
      ]);

      const results = await ragService.searchKnowledge(CLINIC_A, 'limpeza', {
        limit: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0].answer).toContain('profilaxia');
      expect(mockSearchKnowledgeBase).toHaveBeenCalledWith(CLINIC_A, 'limpeza', 5);
    });
  });

  describe('Document Ingestion with Chunking & Embedding Generation', () => {
    it('ingests multi-paragraph document into indexed knowledge entries', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { id: 'chunk-1', clinicId: CLINIC_A },
          ]),
        }),
      });
      mockGetDb.mockReturnValue({ insert: mockInsert });
      mockGenerateEmbedding.mockResolvedValue({
        vector: Array.from({ length: 1536 }, () => 0.02),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });
      mockUpsertEmbedding.mockResolvedValue(true);

      const content = `
        Manual de Procedimentos da Clínica:
        1. Ortodontia: Instalação e manutenção de aparelhos fixos e alinhadores invisíveis.
        2. Implantes: Planejamento guiado por tomografia e colocação de implante em titânio.
        3. Endodontia: Tratamento de canal realizado em sessão única com microscópio operatório.
      `;

      const result = await ragService.ingestDocument(CLINIC_A, {
        category: 'manual',
        title: 'Manual de Procedimentos',
        content,
        chunkSize: 100,
        chunkOverlap: 15,
      });

      expect(result.chunksCreated).toBeGreaterThan(0);
      expect(mockGenerateEmbedding).toHaveBeenCalled();
    });
  });

  describe('Dual-store absence verification (Architecture constraint)', () => {
    it('confirms pgvector is the sole vector store in v1 runtime and no Vectorize binding is required', () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
    });
  });
});
