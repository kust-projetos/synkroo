/**
 * Embedding Generation
 *
 * Tenta OpenAI primeiro, fallback para Jina se OPENAI_API_KEY ausente.
 * Retorna null se nenhum provider configurado (keyword fallback).
 */

import { getEnv } from '@/lib/env';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const JINA_EMBEDDING_URL = 'https://api.jina.ai/v1/embeddings';

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
}

/**
 * Generate embedding vector from text.
 * Returns null if no embedding provider is configured.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const env = getEnv();

  // Try OpenAI first
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch(OPENAI_EMBEDDING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8191), // OpenAI token limit
        }),
      });

      if (!res.ok) {
        console.error('[embeddings] OpenAI error', res.status);
        return null;
      }

      const json = await res.json() as { data: Array<{ embedding: number[] }>; model: string };
      const vector = json.data?.[0]?.embedding;
      if (!vector) return null;

      return { vector, model: json.model || 'text-embedding-3-small', dimensions: vector.length };
    } catch (err) {
      console.error('[embeddings] OpenAI exception', err);
      // Fall through to Jina
    }
  }

  // Fallback: Jina
  if (env.JINA_API_KEY) {
    try {
      const res = await fetch(JINA_EMBEDDING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.JINA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v3',
          input: [text.slice(0, 8191)],
        }),
      });

      if (!res.ok) {
        console.error('[embeddings] Jina error', res.status);
        return null;
      }

      const json = await res.json() as { data: Array<{ embedding: number[] }>; model: string };
      const vector = json.data?.[0]?.embedding;
      if (!vector) return null;

      return { vector, model: json.model || 'jina-embeddings-v3', dimensions: vector.length };
    } catch (err) {
      console.error('[embeddings] Jina exception', err);
    }
  }

  return null;
}
