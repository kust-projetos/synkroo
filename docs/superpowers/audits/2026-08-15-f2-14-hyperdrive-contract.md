# F2.14 — Hyperdrive bridge contract

The ia-bridge runtime contract now requires `HYPERDRIVE.connectionString` together with `HANDLE_SECRET` and `IA_SEEN`. Bridge validation injects that connection string into the shared Drizzle client before RPC dependencies are built, preventing silent fallback to the app process environment.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/__tests__/runtime-env.test.ts --runInBand` | PASS — 3 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint focused | PASS |
| `git diff --check` | PASS |
Residual: worker-level Hyperdrive smoke remains external-only.

## 2026-08-15 smoke evidence

- Preflight: `npm run typecheck:ia-bridge` — PASS, exit 0, no diagnostics.
- Binding packaging: `npx wrangler deploy --dry-run --config wrangler.ia-bridge.jsonc` — PASS; Wrangler listed `env.HYPERDRIVE` and `env.IA_SEEN`; dry-run exited without deployment.
- Runtime smoke: NOT RUN. A real worker invocation requires an authorized Cloudflare deploy/staging endpoint; no deployment or secret value was performed/read in this session.
- Classification: `EXTERNAL` for the worker-level runtime smoke; local contract and binding packaging are verified.

## 2026-08-15 local workerd/Wrangler smoke

- Ephemeral `wrangler dev --local` config pointed Hyperdrive at loopback `synkroo_test`; no config/secret was persisted.
- `GET /db-health` returned `{ "ok": true }` through the Worker `AppService.dbHealth()` RPC path.
- Eight concurrent `dbHealth()` calls returned `{ "count": 8, "ok": true }`; temporary worker files were removed.
- Cloudflare staging/deployed Hyperdrive invocation remains `EXTERNAL`; local runtime evidence is now green.

## Wave 0 reconciliation — 2026-08-20

- The local workerd/Wrangler receipt above remains valid and is limited to an ephemeral local worker; it is not a Cloudflare staging or production receipt.
- No new authorized Cloudflare deployment, binding secret, or provider-side invocation was performed in this wave.
- Classification remains `PARTIAL` for F2.14/F3.17 until the owner-authorized staging smoke proves the deployed Hyperdrive binding, DB-backed RPC, concurrency behavior and rollback-compatible lifecycle.
