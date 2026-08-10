# ADR-BASE-13: Cloudflare Queues para Jobs Externos

**Status:** ✅ Implementado via Cloudflare Cron + PostgreSQL outbox
**Data:** 2026-08-10 (consumer agendado e retries/DLQ verificáveis)
## Decisão

Cloudflare Queues para jobs assíncronos (follow-ups, campanhas, webhooks, retries). Garantia at-least-once com DLQ. Idempotency key em todo side effect assíncrono.

## Evidência

- `wrangler.toml`: cron `*/5 * * * *` invokes `worker-entry.mjs` scheduled handler
- `worker-entry.mjs`: authenticated POST to `/api/cron/outbox`
- `src/lib/outbox/worker.ts`: operation routing, retries and dead-letter callback
- `src/lib/idempotency/index.ts`: helper `withIdempotency()` com claim/complete/fail
- `src/lib/db/schema/infra.ts`: tabela `idempotency_keys` (key, jobType, status, expiresAt)
## Alternativas rejeitadas

- DO como fila geral: mistura responsabilidades, sem DLQ nativa
- Queue direto sem idempotency: duplicação em retry

## Gap

- Consumer agendado implementado; Cloudflare Queue nativa permanece alternativa futura, não requisito do outbox atual
- A fila ISR do OpenNext é uma preocupação distinta e agora usa `DOQueueHandler` conforme ADR-BASE-02; este ADR continua limitado a jobs de negócio.
