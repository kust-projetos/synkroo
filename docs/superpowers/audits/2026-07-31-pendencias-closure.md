# Closure audit — verification, OpenNext/Cloudflare, and UI redesign

- **Worktree:** `D:/projetos/synkroo`
- **Branch:** `exec/fase1`
- **Scope:** close the OpenNext direct-mode queue warning.
- **Revalidated:** 2026-08-02

## Original gap

The previous closure audit recorded `queue: "direct"` in `open-next.config.ts`. That mode performs ISR revalidation directly and leaves the known OpenNext direct-mode queue warning in the Cloudflare build output.

## Resolution

- `open-next.config.ts` now imports the official OpenNext `doQueue` adapter.
- `wrangler.toml` now binds `NEXT_CACHE_DO_QUEUE` to `DOQueueHandler`.
- Wrangler migration `v1` provisions SQLite storage for `DOQueueHandler`.
- The application job queue in ADR-BASE-13 remains a separate concern; this change only handles OpenNext ISR revalidation.

## Verification contract

| Check | Evidence | Result |
| --- | --- | --- |
| OpenNext does not use direct queue mode | `open-next.config.ts` contains `queue: doQueue` and no `queue: "direct"` | PASS |
| Durable Object binding exists | `wrangler.toml` contains `NEXT_CACHE_DO_QUEUE` / `DOQueueHandler` | PASS |
| Durable Object migration exists | `wrangler.toml` contains `tag = "v1"` and `new_sqlite_classes = ["DOQueueHandler"]` | PASS |
| Configuration regression test | `src/__tests__/cloudflare/opennext-queue-config.test.ts` | PASS |
| OpenNext build and Wrangler validation | WSL `npx opennextjs-cloudflare build --skipNextBuild` + `npx wrangler deploy --dry-run --config wrangler.toml`; Worker saved and `NEXT_CACHE_DO_QUEUE` listed | PASS |

## Scope boundary

Cloudflare Queues for business jobs, retries, and outbox delivery remain tracked separately in ADR-BASE-13. They are not required to resolve the OpenNext ISR revalidation warning.

## Validation notes

- The generated worker exports `DOQueueHandler` from the OpenNext durable-object bundle.
- Wrangler dry-run listed `env.NEXT_CACHE_DO_QUEUE (DOQueueHandler)`.
- Total upload was `23245.69 KiB`; gzip size was `4060.16 KiB`.
- The only bundle warning was the pre-existing duplicate-case warning.
- No direct-mode queue warning was emitted.
- The Windows build path remains unsupported for reliable validation.
- WSL was used for the reproducible Cloudflare build.
- The two previous `NODE_ENV` readonly diagnostics were corrected with `Object.assign` in the auth test.
- `npm run typecheck -- --pretty false` completed with exit code `0` in WSL after the auth test correction.
- The focused auth suite passes 15/15 tests after the correction.

## Final status

The OpenNext direct-mode queue warning is resolved. The dry-run still reports the pre-existing duplicate-case bundle warning, but no direct-mode queue warning.

No secrets, cookies, connection strings, user emails, or patient records are included in this audit.
