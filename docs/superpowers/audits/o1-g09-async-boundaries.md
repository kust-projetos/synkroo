# O1-G09 — Outbox, retry, dead-letter and async boundaries

Date: 2026-08-20
Roadmap IDs: F2.09, F2.10, F3.08
Status: local PostgreSQL and unit contracts GREEN; provider/Cloudflare Queue delivery remains external.

## Invariants verified

- `outbox_jobs` has a unique `(clinic_id, operation, business_key)` constraint.
- `enqueueOutbox` uses `ON CONFLICT DO NOTHING`, making duplicate producers converge to one job.
- Claims run inside a transaction with `FOR UPDATE SKIP LOCKED`; stale processing leases are reclaimable.
- Successful delivery transitions only `processing → delivered`.
- Retry transitions `processing → pending` with exponential delay capped at 3600 seconds; attempts >= 5 transition to `dead_letter`.
- Dispatcher supports operation allowlists and an observable dead-letter callback.
- Error persistence stores the error name/code only; payloads and provider responses are not logged by the tested paths.

## Receipts

- `npm test -- --runInBand src/lib/outbox/__tests__/dispatch-outbox.test.ts` — PASS, 1 suite / 3 tests.
- `TEST_DATABASE_URL=<loopback synkroo_test> npm run test:integration:run -- --runInBand src/lib/outbox` — PASS, 2 suites / 3 tests. Migration and deterministic seed completed before tests.
- `npm run lint -- --quiet` — PASS, exit 0.

The integration tests prove concurrent enqueue/claim, bounded retry/backoff, successful delivery and dead-letter after five failures. No PII or secret value was included in the receipts.

## External residuals

- Cloudflare Queue producer/consumer delivery, provider-success-then-consumer-crash reconciliation and real DLQ retention require an authorized staging binding and provider sandbox. They were not claimed as locally verified.
- A staging receipt must include queue binding, correlation ID, retry/DLQ observation, provider sandbox result and rollback/replay procedure without payload PII.
- Remaining async rollout is blocked by O1-X04 staging/provider authorization, not by local outbox tests.
