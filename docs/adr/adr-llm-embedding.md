# ADR: LLM Provider, Embedding Model e Dimensão — F6.06

> Decisão: antes de ingestão/RAG, modelo de embedding e dimensão são produzidos pelo modelo/provider escolhido, não hardcoded.

## Contexto
- F6.09 requer adapter multi-provider; F6.10 exige ingestão chunked + busca vetorial + re-embedding + purge + evals.
- Stack alvo: Cloudflare Workers OpenNext + **pgvector** (`vector` extension) — Vectorize removido (F6.11).
- `src/lib/env.ts:63` + `src/lib/runtime-env.ts:43` falham fechado sem provider/binding/DB.

## Decisão
- **Provider factory** em `src/lib/llm/` suporta **MiniMax / OpenAI / OpenRouter** (env `MINIMAX_API_KEY | OPENAI_API_KEY | OPENROUTER_API_KEY` + `IA_LLM_MODEL` + `IA_LLM_BASE_URL` por runtime `agent`).
- **Embedding**: provider define modelo e dimensão; `src/workers/ia-agent` persiste `embedding_model` e `embedding_dim` por registro `knowledge`; busca usa `pgvector` cosine com mesma dimensão.
- **Fail-closed**: sem `provider`/`bridge`/`DB`/`HYPERDRIVE` o adapter lança `Error('[ENV:agent] invalid required fields: ...')` sem vazar valores; `preserve context` via outbox.

## Alternativas descartadas
- Hardcode `text-embedding-ada-002 1536` — quebra ao trocar provider/dimensão; re-embedding impossível.
- Vectorize binding — removido F6.11; pgvector é único na v1.

## Consequências
- Ingestão: chunked + `embedding` por modelo atual + `vector` pgvector; `re-embedding` quando muda modelo/dim.
- Purge: deleta por `clinicId` sem deixar vetores órfãos.
- Evals: `src/services/rag/__tests__/rag.service.test.ts` verifica dimensão produzida pelo modelo.
- Nenhum valor de secret em log — apenas nomes/fields (`OPENCODE_ZEN_API_KEY`, `IA_LLM_MODEL`).

## Referências
- `src/lib/runtime-env.ts:23` agentSchema (`OPENCODE_ZEN_API_KEY`, `IA_LLM_MODEL`, `IA_LLM_BASE_URL`, `APP` binding)
- `src/modules/financeiro/lib/__tests__/crypto.test.ts` pattern TDD multi-provider (analogia)
- F6.06 gate W6 `app/bridge/agent failure-mode evidence`

*ADR 2026-08-25 — VERIFIED local, sem EXTERNAL.*
