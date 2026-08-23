# F3.08 — Outbox, retry, idempotência e DLQ

As primitives locais existentes foram verificadas:

- `claimOutboxJob` usa transação, lease stale e `skipLocked`.
- `markOutboxRetry` aplica backoff limitado e muda para `dead_letter` após 5 tentativas.
- `dispatchNextOutbox` diferencia delivered/empty/retryable/dead_letter e suporta callback DLQ.
- `tryClaimIdempotencyKey` usa insert atomic com reclaim expirado; `withIdempotency` marca completed/failed e relança erro para retry.

| Verificação | Resultado |
|---|---|
| Outbox dispatcher | PASS — 3 testes (`src/lib/outbox/__tests__/dispatch-outbox.test.ts` 3/3 2026-08-23 Orca paralelo) |
| Idempotency helper | PASS — 6 testes (`src/lib/idempotency` 6/6 auditado) |
| Total focado | PASS — 9 testes |

Orca parallel 2026-08-23 (ctx_fe1a planner): revalidado `dispatchNextOutbox` 3/3, primitives locais `claimOutboxJob`/`markOutboxRetry`/`tryClaimIdempotencyKey` mantidas. Cloudflare Queue `wrangler.toml` `queues.producers/consumers` provisionamento real permanece gate `W3.15/W3.16` externo — não declarado executado. Mantém `PARTIAL`.

O artifact comprova as primitives locais; provisionamento/consumo real de Cloudflare Queue permanece dependente do gate W3.15/W3.16 e não é declarado como executado.
