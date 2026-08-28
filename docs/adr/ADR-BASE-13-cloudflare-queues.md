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

## Gap (2026-08-28 W9 em progresso)

Cron + PostgreSQL outbox real com service binding interno (`env.WORKER_SELF_REFERENCE.fetch` via `https://synkroo.internal`) sem `OUTBOX_WORKER_URL` e sem Queue nativa; worker com registry `operation→moduleId`, gating por `manifest.enabledModules`, concorrência 5 com `SKIP LOCKED`, `unknown operation` observável. Marcar Implementado após testes de concorrência sem double delivery e dry-run service binding em staging.
