# F3.08 — Outbox, retry, idempotência e DLQ

As primitives locais existentes foram verificadas:

- `claimOutboxJob` usa transação, lease stale e `skipLocked`.
- `markOutboxRetry` aplica backoff limitado e muda para `dead_letter` após 5 tentativas.
- `dispatchNextOutbox` diferencia delivered/empty/retryable/dead_letter e suporta callback DLQ.
- `tryClaimIdempotencyKey` usa insert atomic com reclaim expirado; `withIdempotency` marca completed/failed e relança erro para retry.

| Verificação | Resultado |
|---|---|
| Outbox dispatcher | PASS — 3 testes |
| Idempotency helper | PASS — 6 testes |
| Total focado | PASS — 9 testes |

O artifact comprova as primitives locais; provisionamento/consumo real de Cloudflare Queue permanece dependente do gate W3.15/W3.16 e não é declarado como executado.
