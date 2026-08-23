# F6.10 — Knowledge CRUD, Document Ingestion & Vector Search on pgvector

**Data:** 2026-08-23  
**Branch:** main  
**Status:** PARTIAL — CRUD knowledge com isolamento multi-tenant, chunking de documentos, ingestão vetorial e busca semântica em pgvector com fallback por palavra-chave implementados e verificados via testes; live external embeddings smoke permanece para Gate O3-X02  
**Wave:** W6 (O3-G06) — Knowledge Lifecycle on pgvector

---

## Resumo

- **Requisito F6.10:** Restaurar CRUD de knowledge, ingestão com chunking, busca vetorial baseada em pgvector com dimensão 1536 e fallback híbrido.
- **Implementações:**
  1. **Serviço RAG Central (`src/services/rag/rag.service.ts` & `src/services/rag/index.ts`):**
     - **CRUD Tenant-Scoped:** `createKnowledge`, `getKnowledge`, `listKnowledge`, `updateKnowledge`, `deleteKnowledge`, `purgeKnowledge` aplicando filtro estrito por `clinicId`.
     - **Chunking de Documentos (`chunkText`):** Algoritmo de fatiamento de textos longos respeitando pontuação, parágrafos e limites de tamanho com sobreposição configurável (`chunkSize`, `chunkOverlap`).
     - **Ingestão com Embeddings (`ingestDocument`):** Fatiamento automático em seções, geração de embeddings de dimensão fixa (1536) e persistência no `knowledgeBase`.
     - **Busca Semântica Híbrida (`searchKnowledge`):** Busca vetorial primária por similaridade de cosseno em `pgvector` (`1 - (embedding <=> queryVector::vector)`), com degradação graciosa e automática para busca textual/palavra-chave (`searchKnowledgeBase`) caso a API de embeddings esteja indisponível.
  2. **API Routes de Knowledge (`src/app/api/knowledge/`):**
     - [`src/app/api/knowledge/search/route.ts`](file:///D:/projetos/synkroo/src/app/api/knowledge/search/route.ts): Integrado à busca vetorial semântica do `ragService` com fallback.
     - [`src/app/api/knowledge/ingest/route.ts`](file:///D:/projetos/synkroo/src/app/api/knowledge/ingest/route.ts): Novo endpoint para ingestão em lote de manuais, procedimentos e FAQs com chunking automático.
  3. **Dual-Store Absence / Arquitetura:**
     - Conformidade com ADR-BASE-04 e ADR-LLM-01: o runtime v1 utiliza exclusivamente `pgvector` (`vector(1536)`) sem dependência de Cloudflare Vectorize.

---

## Arquivos Criados / Modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/services/rag/rag.service.ts` | NEW | Serviço de RAG, CRUD, chunking, ingestão e busca vetorial |
| `src/services/rag/index.ts` | NEW | Exportações públicas do serviço RAG |
| `src/services/rag/__tests__/rag.service.test.ts` | NEW | 9 testes unitários e de contrato cobrindo ciclo de vida, chunking, isolamento e busca |
| `src/app/api/knowledge/search/route.ts` | MOD | Atualizado para usar `ragService.searchKnowledge` |
| `src/app/api/knowledge/ingest/route.ts` | NEW | Rota de ingestão de documentos estruturados |
| `docs/superpowers/audits/2026-08-23-f6-10-knowledge-rag.md` | NEW | Este relatório de auditoria |

---

## Testes Executados

| Suite / Comando | Resultado | Detalhes |
|---|---|---|
| `npx jest src/services/rag/__tests__/` | **PASS** | 1 suite, 9 testes verdes |
| `npx jest src/app/api/knowledge/__tests__/` | **PASS** | 1 suite, 6 testes verdes |
| `npx jest src/lib/embeddings/__tests__/` | **PASS** | 2 suites, 3 testes verdes |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 erros de tipagem TypeScript |
| `npm run lint` (`eslint . --max-warnings=0`) | **PASS** | 0 warnings / 0 erros |
| `npm run roadmap:check` | **PASS** | 143 itens consistentes |
