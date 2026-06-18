/**
 * Cloudflare Workers globals — declarações de tipo para o runtime Workers.
 * W4.2: Hyperdrive binding (Postgres pooler).
 * W4.4: VectorizeIndex e KVNamespace (embeddings + cache).
 * Tipos completos em worker-configuration.d.ts (gerado via wrangler types).
 */
declare const EdgeRuntime: string | undefined;

interface Hyperdrive {
  connectionString: string;
}

/** Vectorize: index de embeddings para busca por similaridade (RAG). */
interface VectorizeIndex {
  describe(): Promise<any>;
  query(vector: number[] | Float32Array, options?: Record<string, unknown>): Promise<{ matches: Array<{ id: string; score: number; values?: number[] }>; count: number }>;
  insert(vectors: Array<{ id: string; values: number[] | Float32Array }>): Promise<{ ids: string[]; count: number }>;
  upsert(vectors: Array<{ id: string; values: number[] | Float32Array }>): Promise<{ ids: string[]; count: number }>;
  deleteByIds(ids: string[]): Promise<{ ids: string[]; count: number }>;
  getByIds(ids: string[]): Promise<Array<{ id: string; values: number[] }>>;
}

/** KV: key-value store para cache e estado leve. */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }>;
}
