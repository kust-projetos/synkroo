/**
 * Embedding Service for Synkroo RAG
 * Generates embeddings using OpenAI-compatible API
 *
 * Supported providers:
 * 1. OpenAI (paid) - best quality
 * 2. Voyage AI (paid) - good quality/price
 * 3. Jina AI (free tier: 1M tokens/month) - FREE option
 * 4. HuggingFace Inference (free tier) - FREE option
 * 5. Local Ollama (free, requires setup) - FREE option
 *
 * Note: MiniMax and OpenRouter don't have embedding APIs.
 */

import { withRetry } from '@/lib/retry'
import { aiLogger } from '@/lib/logger'

export interface EmbeddingResult {
  embedding: number[]
  tokens: number
}

export interface EmbeddingOptions {
  model?: string
  batchSize?: number
  dimensions?: number
}

// Default embedding dimension
const DEFAULT_EMBEDDING_DIMENSION = 1536

// Known embedding models and their dimensions
const MODEL_DIMENSIONS: Record<string, number> = {
  // OpenAI
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  // Voyage
  'voyage-3': 1024,
  'voyage-3-lite': 512,
  // Jina AI (FREE tier available)
  'jina-embeddings-v2-base-en': 768,
  'jina-embeddings-v2-small-en': 512,
  // Cohere
  'embed-english-v3.0': 1024,
  // HuggingFace models
  'sentence-transformers/all-MiniLM-L6-v2': 384,
  'BAAI/bge-small-en-v1.5': 384,
  'BAAI/bge-base-en-v1.5': 768,
}

// Free embedding providers configuration
const FREE_PROVIDERS = {
  jina: {
    url: 'https://api.jina.ai/v1/embeddings',
    model: 'jina-embeddings-v2-base-en',
    dimensions: 768,
    envKey: 'JINA_API_KEY',
  },
  huggingface: {
    url: 'https://api-inference.huggingface.co/pipeline/feature-extraction/',
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    envKey: 'HUGGINGFACE_API_KEY',
  },
  ollama: {
    url: 'http://localhost:11434/api/embeddings',
    model: 'nomic-embed-text',
    dimensions: 768,
    envKey: null, // Local, no key needed
  },
}

/**
 * Embedding Service
 * Generates vector embeddings for text using multiple providers
 */
export class EmbeddingService {
  private apiKey: string
  private apiUrl: string
  private model: string
  private batchSize: number
  private dimensions: number
  private provider: string

  constructor(options: EmbeddingOptions = {}) {
    // Priority: EMBEDDING_API_KEY > JINA_API_KEY > HUGGINGFACE_API_KEY > OPENAI_API_KEY
    this.apiKey = process.env.EMBEDDING_API_KEY
      || process.env.JINA_API_KEY
      || process.env.HUGGINGFACE_API_KEY
      || process.env.OPENAI_API_KEY
      || ''

    // Detect provider based on URL or key
    this.apiUrl = process.env.EMBEDDING_API_URL || this.detectApiUrl()
    this.provider = this.detectProvider()

    // Model selection based on provider
    this.model = options.model || process.env.EMBEDDING_MODEL || this.getDefaultModel()
    this.dimensions = options.dimensions
      || MODEL_DIMENSIONS[this.model]
      || DEFAULT_EMBEDDING_DIMENSION

    this.batchSize = options.batchSize || 100
  }

  private detectApiUrl(): string {
    if (process.env.JINA_API_KEY) {
      return FREE_PROVIDERS.jina.url
    }
    if (process.env.HUGGINGFACE_API_KEY) {
      return FREE_PROVIDERS.huggingface.url + FREE_PROVIDERS.huggingface.model
    }
    if (process.env.OLLAMA_EMBEDDINGS_URL || this.isOllamaAvailable()) {
      return FREE_PROVIDERS.ollama.url
    }
    return 'https://api.openai.com/v1/embeddings'
  }

  private detectProvider(): string {
    if (this.apiUrl.includes('jina.ai')) return 'jina'
    if (this.apiUrl.includes('huggingface')) return 'huggingface'
    if (this.apiUrl.includes('ollama') || this.apiUrl.includes('localhost:11434')) return 'ollama'
    if (this.apiUrl.includes('voyageai')) return 'voyage'
    if (this.apiUrl.includes('cohere')) return 'cohere'
    return 'openai'
  }

  private getDefaultModel(): string {
    switch (this.provider) {
      case 'jina': return FREE_PROVIDERS.jina.model
      case 'huggingface': return FREE_PROVIDERS.huggingface.model
      case 'ollama': return FREE_PROVIDERS.ollama.model
      default: return 'text-embedding-3-small'
    }
  }

  private isOllamaAvailable(): boolean {
    // Check if Ollama is running locally
    return process.env.OLLAMA_HOST !== undefined
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const results = await this.generateEmbeddings([text])
    return results[0]
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.apiKey) {
      // Return zero embeddings if no API key (dev mode)
      aiLogger.warn('No embedding API key configured. Set EMBEDDING_API_KEY or OPENAI_API_KEY for RAG to work properly.')
      return texts.map(() => ({
        embedding: new Array(this.dimensions).fill(0),
        tokens: 0,
      }))
    }

    // Clean and truncate texts
    const cleanedTexts = texts.map(t => this.cleanText(t))

    // Batch processing
    const results: EmbeddingResult[] = []

    for (let i = 0; i < cleanedTexts.length; i += this.batchSize) {
      const batch = cleanedTexts.slice(i, i + this.batchSize)
      const batchResults = await this.generateBatch(batch)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Check if embedding service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey
  }

  /**
   * Get current configuration
   */
  getConfig(): { model: string; dimensions: number; configured: boolean } {
    return {
      model: this.model,
      dimensions: this.dimensions,
      configured: this.isConfigured(),
    }
  }

  /**
   * Generate embeddings for a batch of texts
   */
  private async generateBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return withRetry(
      async () => {
        // Route to provider-specific implementation
        switch (this.provider) {
          case 'jina':
            return this.generateJinaEmbeddings(texts)
          case 'huggingface':
            return this.generateHuggingFaceEmbeddings(texts)
          case 'ollama':
            return this.generateOllamaEmbeddings(texts)
          default:
            return this.generateOpenAICompatibleEmbeddings(texts)
        }
      },
      {
        maxAttempts: 3,
        initialDelay: 500,
        onRetry: (attempt, error) => {
          aiLogger.warn('Embedding retry attempt', { attempt, error: error.message })
        },
      }
    )
  }

  /**
   * OpenAI-compatible embedding (OpenAI, Voyage, Cohere)
   */
  private async generateOpenAICompatibleEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const body: Record<string, any> = {
      model: this.model,
      input: texts,
    }

    if (this.model.includes('text-embedding-3') && this.dimensions !== MODEL_DIMENSIONS[this.model]) {
      body.dimensions = this.dimensions
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Embedding API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    let embeddings: number[][]
    let totalTokens = 0

    if (data.data && Array.isArray(data.data)) {
      const sortedData = data.data.sort((a: any, b: any) => a.index - b.index)
      embeddings = sortedData.map((item: any) => item.embedding)
      totalTokens = data.usage?.total_tokens || 0
    } else if (data.embeddings && Array.isArray(data.embeddings)) {
      embeddings = data.embeddings
      totalTokens = data.meta?.tokens?.input_tokens || 0
    } else {
      throw new Error('Unknown embedding API response format')
    }

    return embeddings.map((embedding) => ({
      embedding,
      tokens: totalTokens > 0 ? Math.floor(totalTokens / texts.length) : 0,
    }))
  }

  /**
   * Jina AI embeddings (FREE tier: 1M tokens/month)
   * API: https://api.jina.ai/v1/embeddings
   */
  private async generateJinaEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Jina API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    // Jina uses OpenAI-compatible format
    const sortedData = data.data.sort((a: any, b: any) => a.index - b.index)
    const embeddings = sortedData.map((item: any) => item.embedding)
    const totalTokens = data.usage?.total_tokens || 0

    return embeddings.map((embedding: number[]) => ({
      embedding,
      tokens: totalTokens > 0 ? Math.floor(totalTokens / texts.length) : 0,
    }))
  }

  /**
   * HuggingFace Inference API (FREE tier available)
   * Returns raw embeddings array
   */
  private async generateHuggingFaceEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = []

    // HuggingFace processes one text at a time
    for (const text of texts) {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ inputs: text }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`)
      }

      const embedding = await response.json()

      // HuggingFace returns the embedding directly or in an array
      const embeddingArray = Array.isArray(embedding[0]) ? embedding[0] : embedding

      results.push({
        embedding: embeddingArray,
        tokens: Math.ceil(text.length / 4), // Rough estimate
      })
    }

    return results
  }

  /**
   * Ollama local embeddings (FREE, requires Ollama running)
   * API: http://localhost:11434/api/embeddings
   */
  private async generateOllamaEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = []

    for (const text of texts) {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${response.status} - ${error}`)
      }

      const data = await response.json()

      results.push({
        embedding: data.embedding,
        tokens: Math.ceil(text.length / 4),
      })
    }

    return results
  }

  /**
   * Clean and truncate text for embedding
   */
  private cleanText(text: string): string {
    // Remove extra whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim()

    // Truncate to ~8000 tokens (roughly 32000 chars for most models)
    // Leave room for special tokens
    const maxLength = 30000
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '...'
    }

    return cleaned
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Calculate Euclidean distance between two embeddings
   */
  static euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension')
    }

    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }

    return Math.sqrt(sum)
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService()