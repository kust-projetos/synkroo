# Outage Drill Receipts — F12.04 R4 MATRIX-DRAFTED → DRY-RUN 2026-08-26 21:46Z

**Contexto:** drills da matriz `docs/ops/outage-drill-matrix.md:1` executados em modo **dry-run / fail-closed local** contra `synkroo-staging 892581b5` sem injeção real de falha em produção. Cada drill avalia comportamento esperado, alerta e integridade sem expor `*_SECRET`. Injeção real autorizada apenas na janela `2026-09-01T02:00Z` com owner, monitoramento e `wrangler rollback --env staging`.

**Candidato staging:** `https://synkroo-staging.walissonead.workers.dev` `Version 892581b5` `HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6` `KV f2ad31` `CRON_SECRET vL9u****`
**Health baseline:** `/api/health 200 healthy latency 131-344` `database ok` `environment ok` `src/services/api-handlers/health.ts:5`
**Readiness:** `/api/internal/readiness 200 {"status":"ready"} vL9u**** timingSafeEqual src/app/api/internal/readiness/route.ts:5 src/middleware.ts:14` `wrong 401` `no-auth 401`

| # | Dependência | Falha simulada (dry-run) | Comportamento observado (fail-closed) | Alerta / Runbook | Recovery | Integridade |
|---|---|---|---|---|---:|---|
| 1 | Evolution (WhatsApp) `F6.02` | `EVOLUTION_API_URL` timeout mock + replay fora janela (curl --max-time 10 404) | Inbound `WEBHOOK_SECRET timingSafeEqual` rejeita replay, deriva `clinicId` via `channel_installations` `F2.06` sem aceitar tenant livre; outbound `outbox` `idempotencyKey` enfileirado `F7.02` | `webhook alert F11.09 → docs/runbooks/alerts/webhook.md` | Restaurar URL staging `evo.synkroo.com.br 404 fingerprint`; drain `outbox` `dead_letter ≥5` `dispatch-dlq 3/3` | `messages.externalId` único + transação conversa OK |
| 2 | LLM (MiniMax/OpenAI/OpenRouter) `F6.09` | Provider 503 + `IA_LLM_BASE_URL https://opencode.ai/zen/v1` timeout 10s | `src/lib/llm/*` fail-closed preserva contexto, `Agent R0-R3 proof` imutável `F6.07` | `agent alert → docs/runbooks/alerts/agent.md` | Retry `withRetry src/lib/retry.ts:72` backoff; `consent-guard` bloqueia `F7.08` | `knowledge` intacto sem ingestão parcial `F6.10` |
| 3 | DB / Hyperdrive `F3.04-06` | `DATABASE_URL` Hyperdrive `e0033` latency 344 + pool leak simulado | `db:health` `latency 131-344` OK, `readiness 200` com `CRON_SECRET vL9u****` protegido; liveness `200` mantido `F11.07` `waitlist FOR UPDATE` não duplica `F5.04` | `db alert F11.09 → w11-rollout-runbook rollback` | `pg_dump > backup-2026-08-26.sql + sha256` `drizzle-kit check Everything's fine` + `roll-forward F11.14` | `legal_hold src/modules/operacional/schema/patients.ts:30` + audit 2a OK |
| 4 | Queue / Outbox `F3.08` | Cloudflare Queue lag + `outbox dead_letter` storm `pending→dead_letter ≥5` | Retry bound + DLQ observável `dispatch-dlq.test 3/3` `F7.07` campaigns `partial/failed` `F7.05-06` opt-out preservado | `queue alert → outbox runbook` | Drain/reconciliar DLQ `processGatewayEventAtomically F9.06` tx `financeiro-repository.ts:402` | `gateway_events` + `payment_charges` sem duplicata `F9.08` 2/2 |
| 5 | Sidecar Playwright `F6.13-14` | `PLAYWRIGHT_SECRET` ausente + mTLS/HMAC nonce timeout + egress fora allowlist | `mTLS+HMAC` `src/workers/ia-agent` rejeita, egress allowlist bloqueia, `nonce` idempotência `F6.14` `f6-sidecar-mtls.md:9` | `sidecar alert F11.09 → f6-sidecar-mtls.md` | Revalidar `PLAYWRIGHT_SECRET` `****` + handshake `DO STATE_VERSION=2 src/workers/ia-agent/index.ts:36` | `session + DO` não cruzam rollback |
| 6 | Consent-guard `F7.08` | `consent version stale v0` + `optOutMarketing=true` (Fernanda Lima csv line 7) | `src/services/followup/consent-guard.ts: assertConsentVersion` throws `consent stale/opted-out`; dispatch rejeita antes de envio | `consent gate → w10-retention-policy.md` | Re-sync consent bump `v1→v2`; não reenviar sem version | Zero envio não transacional sem consent |

**Métricas SLO F11.09 `metric-dictionary.md`:** `auth DB webhook queue agent provider sidecar` availability/latency/error/retry/DLQ — baseline `health latency 131-344` staging, sem breach; abort se `readiness 401` ou `health 503`.

**Rollback:** `wrangler rollback --env staging` + redeploy `05ce1c01` + `pg_restore backup.sha256` `F11.14 roll-forward`; nunca `down` destrutivo.

**Recibo sanitizado por drill:**
- `Dependência / Janela 2026-08-26T21:46Z dry-run / Injeção timeout 10 / Alerta runbook / Mitigação outbox/pg_restore/rollback / Recovery mm:ss / Integridade externalId único tx OK / Operator agent / Version 892581b5` — sem `*_SECRET` valor.

*Gerado 2026-08-26 21:46Z dry-run — injeção real pendente janela `2026-09-01T02:00Z` owner autorizado.*
