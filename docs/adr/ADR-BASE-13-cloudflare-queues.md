# ADR-BASE-13: Cloudflare Queues para Jobs Externos

**Status:** 🟡 Em progresso  
**Data:** 2026-07-29 (bindings + idempotency criados, consumer pendente)

## Decisão

Cloudflare Queues para jobs assíncronos (follow-ups, campanhas, webhooks, retries). Garantia at-least-once com DLQ. Idempotency key em todo side effect assíncrono.

## Evidência

- `wrangler.toml`: Queue producer binding `SYNKROO_JOBS` (consumer comentado até Worker dedicado)
- `src/lib/idempotency/index.ts`: helper `withIdempotency()` com claim/complete/fail
- `src/lib/db/schema/infra.ts`: tabela `idempotency_keys` (key, jobType, status, expiresAt)

## Alternativas rejeitadas

- DO como fila geral: mistura responsabilidades, sem DLQ nativa
- Queue direto sem idempotency: duplicação em retry

## Gap

- Consumer Worker dedicado não criado (jobs ainda usam cron direto)
- Migration para Queue pendente (gradual, fora do escopo foundations)
- A fila ISR do OpenNext é uma preocupação distinta e agora usa `DOQueueHandler` conforme ADR-BASE-02; este ADR continua limitado a jobs de negócio.
