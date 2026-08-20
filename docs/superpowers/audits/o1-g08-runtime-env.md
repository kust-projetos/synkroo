# O1-G08 — Runtime-specific environment contracts

Date: 2026-08-20
Roadmap IDs: F3.02, F3.03
Status: local validation GREEN; provider/staging secret provisioning remains external.

## Contract matrix

| Runtime | Required contract |
|---|---|
| app | `AUTH_SECRET` min 32, `JWT_SECRET` min 16, and `DATABASE_URL` or `HYPERDRIVE`; `NODE_ENV` enum/default. |
| bridge | `HANDLE_SECRET` min 32, truthy `IA_SEEN`, `HYPERDRIVE.connectionString`. |
| agent | non-empty `OPENCODE_ZEN_API_KEY`, `IA_LLM_MODEL`, valid `IA_LLM_BASE_URL`, truthy `APP`. |
| sidecar | `SIDECAR_SHARED_SECRET` min 32, non-empty `SIDECAR_EGRESS_ALLOWLIST`, literal `SIDECAR_DEFAULT_OFF=true`. |

`parseRuntimeEnv` reports only runtime and invalid field names. It does not include input values. Bridge bootstrap calls `parseRuntimeEnv('bridge', ...)`; agent bootstrap calls `parseRuntimeEnv('agent', ...)` in the Durable Object constructor and fetch path.

## Verification receipts

- `npm test -- --runInBand src/lib/__tests__/env.test.ts` — PASS, 1 suite / 3 tests. Covers missing, short and valid production `AUTH_SECRET`.
- `npm run typecheck:ia-bridge` — PASS, exit 0.
- `npm run typecheck:ia-agent` — PASS, exit 0.
- `npm run build:cf` — PASS, Next compilation, lint/type validity, 120 static pages, OpenNext worker bundle and pg/Hyperdrive injection completed.
- Build emitted known non-blocking warnings: Windows OpenNext compatibility, duplicate generated switch case in reports export. No credentials or environment values were logged by the verification commands.

## Residual gates

- `src/lib/__tests__/runtime-env.test.ts` should remain part of the broader runtime contract suite; this receipt intentionally records the plan's focused app-env command separately.
- Real Cloudflare binding presence, provider secrets, Hyperdrive connectivity and staging startup smoke require owner-authorized environments. No staging, secret rotation or production action was performed.
- F3.02/F3.03 local implementation evidence is complete; external runtime evidence remains pending until the approved staging gate is executed.
