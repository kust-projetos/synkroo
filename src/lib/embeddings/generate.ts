import { getEnv } from '@/lib/env';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
const REQUEST_TIMEOUT_MS = 10_000;

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
}

type EmbeddingResponse = { data?: Array<{ embedding?: unknown }>; model?: string };

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function parseEmbedding(response: EmbeddingResponse): EmbeddingResult | null {
  const vector = response.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) return null;
  if (!vector.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
  return { vector, model: response.model || EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS };
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const apiKey = getEnv().OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8191) }),
      signal: requestSignal(),
    });
    if (!response.ok) return null;
    return parseEmbedding(await response.json() as EmbeddingResponse);
  } catch {
    return null;
  }
}
