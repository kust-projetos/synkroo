# O1-X04 — Staging runtime receipt

Date: 2026-08-22

## Deployment

- Worker: `synkroo-staging`
- Version: `7a7b0287-f455-4411-8532-9cc325c52fbd`
- URL: `https://synkroo-staging.walissonead.workers.dev`
- Deployment completed with Wrangler authenticated account; no secrets are recorded here.

## Bindings

Dry-run/deploy listed the expected staging bindings: Hyperdrive, KV `SYNKROO_CACHE`, Vectorize, `AGENT`, `NEXT_CACHE_DO_QUEUE`, `IA_BRIDGE`, `WORKER_SELF_REFERENCE` and assets.

## Smoke

```text
GET /api/health       -> HTTP 200
status                -> healthy
database.status       -> ok
environment.DATABASE_URL -> true
GET /api/health/db    -> auth redirect (protected endpoint)
GET /api/internal/readiness -> auth redirect (protected endpoint)
```

The public health check proves the deployed runtime can reach its database health path. Protected checks require an authenticated staging session and were not bypassed.
