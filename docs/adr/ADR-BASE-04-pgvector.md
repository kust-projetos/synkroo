# ADR-BASE-04: pgvector como Vector Store Único v1

**Status:** ✅ Implementado  
**Data:** 2026-07-29 (embeddings service criado)

## Decisão

pgvector como vector store único para knowledge base da IA e busca semântica. Sem Vectorize simultâneo.

## Evidência

- `src/lib/db/schema/infra.ts`: tabela `knowledge_base` com coluna `embedding vector(1536)`
- `src/repositories/knowledge/index.ts`: repository com keyword search (fallback)
- `src/lib/embeddings/`: serviço de geração (OpenAI/Jina) + busca vetorial (pgvector cosine)
- `wrangler.toml`: removida referência ao Vectorize (ADR-BASE-04: pgvector único)

## Alternativas rejeitadas

- Vectorize simultâneo: duas fontes de verdade, custo de sincronização

## Gap

- Smoke test com embeddings reais pendente (requer OPENAI_API_KEY ou JINA_API_KEY)
- Índice IVF_FLAT ou HNSW no pgvector para performance em escala

## Ação

1. Habilitar extensão `vector` no PostgreSQL (migration)
2. Criar schema `embeddings` com coluna `vector(1536)` 
3. Implementar `src/lib/embeddings/` com generate + search
4. Integrar com knowledge base do agente IA (REQ-IA-06)
