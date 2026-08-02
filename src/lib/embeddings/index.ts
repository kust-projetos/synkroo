/**
 * Embedding Service (ADR-BASE-04: pgvector)
 *
 * Geração e busca semântica via pgvector.
 * Provider: OpenAI text-embedding-3-small (1536 dims) ou Jina embeddings.
 *
 * Fallback: busca por keyword (existing) quando embedding indisponível.
 */

export { generateEmbedding } from './generate';
export { searchByVector, upsertEmbedding } from './search';
