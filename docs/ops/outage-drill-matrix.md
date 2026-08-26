# Outage Drill Matrix — B-OUTAGE-DRILLS F12.04 (R4 MATRIX-DRAFTED)

**Status:** MATRIX-DRAFTED — nenhuma execução externa, apenas matriz planejada
**Data:** 2026-08-26
**Janela proposta:** `2026-09-01T02:00Z` (mesma do `pilot-charter.md`)
**Candidato:** `synkroo-staging` (`HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6`, `OUTBOX_WORKER_URL staging`)
**Fontes:** `docs/superpowers/plans/2026-08-16-roadmap-143-wave-5-release-pilot.md` O5-G08, `docs/ops/w11-rollout-runbook.md`, `src/services/followup/consent-guard.ts` (F7.08), `src/lib/outbox/__tests__/dispatch-dlq.test.ts`

> Gatilho O5-X03: cada drill requer autorização explícita do owner + staging candidato + monitoramento + notificação participantes + check integridade.

## Dependências & comportamento fail-closed esperado

| # | Dependência | Falha injetada (controlada) | Comportamento esperado (fail-closed) | Alerta / Runbook | Recuperação | Integridade |
|---|---|---|---|---|---|---|
| 1 | **Evolution** (WhatsApp) | `EVOLUTION_API_URL` down/timeout + replay fora da janela | Inbound deriva `clinicId` sem aceitar tenant livre (`F2.06`), `WEBHOOK_SECRET timingSafeEqual`, rejeita replay; outbound enfileira `outbox` com `idempotencyKey`, não inline-call (F7.02) | `webhook` alert (F11.09) → `docs/runbooks/alerts/webhook.md` | Restaurar Evolution; drain `outbox` → `dead_letter` se ≥5 tentativas; reconciliar | `messages.externalId` único + transação conversa; sem duplicata |
| 2 | **LLM** (MiniMax/OpenAI/OpenRouter) | Provider down / timeout / `LLM_API_KEY` inválida | `src/lib/llm/*` fail-closed, preserva contexto, não alucina; `agent` R0-R3 proof server-side imutável | `agent` alert → `docs/runbooks/alerts/agent.md` | Reativar provider; `retry` com backoff; `consent-guard` bloqueia envio não transacional | `knowledge` intacto; sem ingestão parcial |
| 3 | **DB / Hyperdrive** | `DATABASE_URL` / `HYPERDRIVE` timeout / pool leak | `db:health` fail, `readiness` `500` protegido por `CRON_SECRET timingSafeEqual`, liveness público mínimo continua (F11.07); `waitlist` `FOR UPDATE` não duplica | `db` alert (F11.09) → `w11-rollout-runbook rollback` | `pg_dump restore` ou `roll-forward`; verificar `drizzle-kit check` + 8-way `FOR UPDATE` test | `legal_hold` + audit 2a + gateway tx intactos |
| 4 | **Queue / Outbox** | Cloudflare Queue lag / `outbox` `dead_letter` storm | Retry bound + DLQ observável (`dispatch-dlq.test 3/3`), campaigns `partial/failed` (F7.05-06), opt-out preservado | `queue` alert → `outbox` runbook | Drain/reconciliar DLQ; `processGatewayEventAtomically` (F9.06) mantém tx | `gateway_events` + `payment_charges` sem duplicata |
| 5 | **Sidecar Playwright** `PLAYWRIGHT_SECRET` | `PLAYWRIGHT_SECRET` ausente/inválido + mTLS/HMAC nonce timeout + egress fora allowlist | Auth `mTLS+HMAC` (`src/workers/ia-agent` + `src/lib/llm`) rejeita; egress allowlist bloqueia; idempotência por `nonce` | `sidecar` alert (F11.09) → `f6-sidecar-mtls.md` runbook | Restaurar sidecar `PLAYWRIGHT_SECRET`; re-validar `mTLS+HMAC` handshake | `session` + `DO STATE_VERSION=2` não cruzam rollback |
| 6 | **Consent-guard** (cross-cutting) | `consent version` stale / `optOutMarketing=true` | `src/services/followup/consent-guard.ts: assertConsentVersion` throws `consent stale/opted-out`; dispatch rejeita antes de envio (F7.08) | `consent` gate → `w10-retention-policy` | Re-sinc consent; não reenviar sem version bump | Nenhum envio não transacional sem consent |

## Injeção (autorizada apenas em staging)

```bash
# Exemplo: Evolution down drill (owner autorizado, janela 02:00Z)
# 1. Ativar fault: firewall staging bloqueia EVOLUTION_API_URL (ou mock 503)
# 2. Enviar webhook inbound com WEBHOOK_SECRET válido + replay antigo
# 3. Observar: timingSafeEqual 401 para replay, outbox enfileirado para outbound
# 4. Restaurar + drain DLQ + verificar integridade (externalId único)
```

## Métricas / SLO (F11.09, metric-dictionary)

- `auth`, `db`, `webhook`, `queue`, `agent`, `provider`, `sidecar` — availability/latency/error/retry/DLQ, janela, burn threshold.
- Abort se: smoke/readiness fail, SLO breach acima threshold, migration/DO mismatch, `a11y` crítico.

## Recibo por drill (sanitizado)

| Campo | Valor (exemplo) |
|---|---|
| Dependência | Evolution / LLM / DB / Queue / Sidecar |
| Janela | `2026-09-01T02:00Z` |
| Injeção | `timeout 5s` / `503` / `secret missing (fingerprint ****)` |
| Alerta disparado | `webhook/db/queue/agent/sidecar` + `runbook URL` |
| Mitigação | `outbox dead_letter` / `pg_restore` / `wrangler rollback --env staging` |
| Recovery time | `mm:ss` |
| Integridade | `externalId único OK` / `tx OK` / `legal_hold OK` |

**Execução só após** `pilot-charter.md` O5-X01/X02 + candidato staging provisionado + `test:integration:run` 37/39 baseline.
