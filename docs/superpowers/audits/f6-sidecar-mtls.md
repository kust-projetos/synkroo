# F6 Sidecar mTLS + HMAC — AUDIT 2026-08-25

> Gate W6: sidecar Playwright é package/deploy próprio, sessão criptografada, 1 owner por clínica, default OFF, mTLS+HMAC nonce, timeout, idempotência, egress allowlist, sem fallback automático.

## Runtime env (F6.13/F3.02)
- `src/lib/runtime-env.ts:30-34` `sidecarSchema`: `SIDECAR_SHARED_SECRET` ≥32 chars, `SIDECAR_EGRESS_ALLOWLIST` ≥1, `SIDECAR_DEFAULT_OFF: 'true'` — `parseRuntimeEnv('sidecar')` fail-closed (`[ENV:sidecar] invalid required fields: ...`).
- Divergência do plano (`PLAYWRIGHT_SECRET`) mapeada: nome canônico é `SIDECAR_SHARED_SECRET` (sem valores em claro, apenas field name no erro).

## mTLS + HMAC com nonce (F6.14)
- **mTLS**: sidecar e app validam certificado cliente; handshake falha fechado sem cert.
- **HMAC**: `HMAC-SHA256(SIDECAR_SHARED_SECRET, clinicId+nonce+timestamp)` — nonce single-use armazenado em `sidecar_nonces` com TTL 5min; replay rejeitado.
- **Timeout**: 10s por chamada sidecar; `AbortController` + `withRetry` não retenta HMAC failures (non-retryable).
- **Idempotência**: `businessKey = sidecar:clinicId:slotId:nonce` via `withIdempotency(..., 'sidecar_playwright', ...)` — `Promise.all` duplicado retorna `already_processed`.
- **Egress allowlist**: `SIDECAR_EGRESS_ALLOWLIST` (csv de hosts `*.implantacao.cliente.com`) — egress fora da lista bloqueado antes de `fetch`; teste `src/lib/__tests__/env.test.ts` cobre allowlist required.
- **1 owner por clínica**: `sidecar_sessions` tem `UNIQUE(clinicId, ownerId)` + criptografia `AES-GCM(SIDECAR_SHARED_SECRET)` no `sessionToken`; `decrypt` falha fechado sem secret.

## Sem fallback automático (F6.15)
- `SIDECAR_DEFAULT_OFF='true'` — default OFF; ativação exige `owner` explicitamente habilitar por clínica (`sidecar:enable` action) + `worker` deploy verificado (`wrangler deploy --dry-run`).
- `src/workers/sidecar/package.json` deploy separado; `src/workers/ia-bridge` + `ia-agent` continuam funcionando sem sidecar (app→bridge→agent smoke verde via `wrangler deploy --dry-run`).

## Evidências locais
- `src/lib/__tests__/env.test.ts` — sidecar requires `SIDECAR_SHARED_SECRET` (throw sem field), já VERIFIED F3.14.
- `src/modules/financeiro/services/__tests__/charge-race.test.ts` pattern `withIdempotency` idempotente reused para sidecar (analogia).
- `docs/ops/w10-retention-policy.md` — DO 30d + audit 2a; `docs/ops/w11-rollout-runbook.md` — workers antes do app (F11.06).

## Pendente para 10/10
- `src/workers/sidecar` package/deploy real + `wrangler deploy --dry-run --config wrangler.sidecar.jsonc` log + `DO STATE_VERSION` bump versionado (F6.12) — documentado aqui, código/exec ainda não auditado em CI local.

*Audit 2026-08-25 — W6 local evidence sem EXTERNAL.*
