# Inventário de Integrações — timeout × retry × dedup × replay (Etapa 6.1)

> Fonte de verdade operacional: esta tabela. Cada linha cita evidência
> `caminho:linha`. Lacunas marcadas **PENDENTE** são recomendações — nenhuma
> infra nova de timeout foi implementada neste ciclo (escopo da Etapa 6.1 é
> inventariar, não construir).

## 1. Outbound (nós chamamos o provider)

| Provider | Endpoint (código) | Auth | Timeout | Retry | Dedup / Idempotência | Teste |
|---|---|---|---|---|---|---|
| Asaas — criar cobrança | `src/modules/financeiro/gateways/providers/asaas/client.ts:72-76` | apiKey header | `DEFAULT_EXTERNAL_TIMEOUT_MS` (15s) — `src/lib/http/fetch-with-retry.ts:24` | `maxRetries: 0` no HTTP; retry com DLQ vive no outbox | `Idempotency-Key` | `src/modules/financeiro/gateways/__tests__/asaas-client-resilience.test.ts:51` |
| Asaas — consultar cobrança (GET) | `client.ts:92-95` | apiKey header | 15s (`fetch-with-retry.ts:24`) | padrão (2 retries, `fetch-with-retry.ts:25`) — GET idempotente | n/a (leitura) | `asaas-client-resilience.test.ts:72` |
| Asaas — cancelar cobrança | `client.ts:111-115` | apiKey header | 15s explícito | `maxRetries: 0`; retry no outbox | `Idempotency-Key` + `expectedStatuses` CAS | `asaas-client-resilience.test.ts:84` |
| Evolution API — envio (POST) | `src/modules/atendimento/services/evolution-service.ts:120-127` | apikey/instância | 15s (`DEFAULT_EXTERNAL_TIMEOUT_MS`) | só se `idempotent` (GET) — POST sem chave não retrya | com chave: envio direto, claim na facade | `src/modules/atendimento/services/__tests__/evolution-idempotency.test.ts:36` |
| WhatsApp Cloud — envio | `src/modules/atendimento/services/channel-service.ts:187-194` | token Graph API | 15s | padrão (GET-like idempotente) | `guarded.deduped` (`channel-service.ts:79`) | `src/modules/atendimento/services/__tests__/channel-idempotency.test.ts:58` |
| Playwright sidecar (fallback) | `channel-service.ts:240-314` (status/send/qrcode) | URL interna | 15s por chamada | padrão | dedup por chave na facade (`channel-service.ts:273`) | `channel-idempotency.test.ts:91` |
| LLM provider-zen (ia-agent outbound) | `src/core/ia-agent/provider-zen.ts:29` | `OPENCODE_ZEN_API_KEY` | `ZEN_CALL_TIMEOUT_MS` (9s); turn budget 20s; invoker RPC 25s (`provider-zen.ts:12-21`) | 1 retry em `complete()` (pior caso 18s < 20s) | métrica por tentativa (`onMetric`, `provider-zen.ts:39`) | `src/core/ia-agent/__tests__/timeout-budget.test.ts:1`, `provider-zen.test.ts:21` |
| LLM base (demais providers) | `src/lib/llm/providers/base.ts:139,194` | por provider | `timeoutMs` (default 30s) | fail-closed: 4xx sem retry; timeout respeita budget (`base.ts:162`) | n/a | `src/lib/llm/__tests__/llm-adapter.test.ts:120,202` |
| ia-bridge → actions (RPC) | `src/workers/ia-bridge/index.ts:1,222` (`WorkerEntrypoint`, binding-only) | `HANDLE_SECRET` + handle `jti` | **PENDENTE** — sem timeout explícito no RPC; budget herdado do caller (invoker 25s, `provider-zen.ts:20`) | sem retry de transporte; `idempotencyKey` por operação (`index.test.ts:297-333`) | `jti` seen-store em KV (`index.ts:53-64`) | `src/workers/ia-bridge/__tests__/index.test.ts:297` |

## 2. Inbound (provider nos chama — webhooks)

| Provider | Rota | Auth | Freshness | Dedup / Idempotência | Teste de replay |
|---|---|---|---|---|---|
| Asaas | `src/app/api/financeiro/webhooks/[provider]/route.ts:44-79` (token `asaas-access-token`/`x-asaas-token`, `timingSafeEqual` via SHA-256 `:24-29`; tenant derivado da credencial, `:144-151`) | token por gateway (não por query) | n/a (eventos de settlement; idempotência cobre) | `gateway_events` (`webhook.ts:69-70` + `processGatewayEventAtomically`, `webhook.ts:83`) | `src/modules/financeiro/gateways/__tests__/asaas-webhook.t4.test.ts:27` — mesmo payload 2× → 1º processa, 2º `{duplicate:true}`, atomic 1× |
| Evolution | `src/app/api/whatsapp/evolution/route.ts:63-72` (`X-Webhook-Secret`/token por instalação) | segredo por instalação | 409 fora da janela (`route.ts:109-115`); sem timestamp = fail-open com warn | downstream: `externalMessageId` → `persistInboundMessage` (`onConflictDoNothing`, `conversations-repository.ts:731`) | `src/app/api/whatsapp/evolution/__tests__/route.replay.test.ts` (replay determinístico) + `route.freshness.test.ts:58` |
| WhatsApp Cloud | `src/app/api/whatsapp/webhook/route.ts:24-28` (HMAC `x-hub-signature-256`, antes do rate limit) | `WHATSAPP_APP_SECRET` + verify token (`route.ts:12-21`) | n/a | contadores `processed/deduped/ignored` (`route.ts:52,132-144`); dedup no `appendInboundMessageDeduped` | `src/app/api/whatsapp/webhook/__tests__/route.test.ts:82` |
| Instagram | `src/app/api/instagram/webhook/route.ts:9-21` (HMAC sha256 `timingSafeEqual`); verify GET `:23-33` | `INSTAGRAM_APP_SECRET` + verify token | n/a | `storeResult.deduped` short-circuit (`webhook-processor-service.ts:193-203`) | `src/app/api/instagram/webhook/__tests__/route.test.ts` + `webhook-processor-service.test.ts:89` |
| Inbound genérico | `src/app/api/messages/inbound/route.ts:33-40` (segredo por instalação fail-closed + rate limit pós-auth) | segredo por instalação | sem janela por design (contrato sem timestamp, `route.ts:9-26`) | `onConflictDoNothing` em `(externalProvider, externalMessageId)` (`route.ts:17-23`) | `src/app/api/messages/inbound/__tests__/route.security.test.ts`, `route.freshness.test.ts` |
| Widget | `src/app/api/widget/messages/route.ts:82-91` (`Idempotency-Key` obrigatório → `externalMessageId`) | sessão/visitor + rate limit (`route.ts:79`) | n/a | idempotency-key = dedup key | `src/app/api/widget/messages/route.test.ts:39-68` |

## 3. Gaps (PENDENTE — recomendação, sem implementação neste ciclo)

1. **ia-bridge RPC sem timeout explícito** (`src/workers/ia-bridge/index.ts`): hoje o budget é
   herdado do caller (invoker 25s). Recomendação: `AbortSignal.timeout()` no entrypoint ou
   deadline propagado no `rpc-contract`, com teste de estouro.
2. **Freshness só na Evolution**: WhatsApp Cloud / Instagram / inbound genérico confiam
   exclusivamente em dedup por event-id (correto e suficiente contra replay, mas sem
   proteção contra reenvio tardio legítimo-duplicado fora de janela — aceito por design;
   revisitar se um provider começar a reemitir eventos antigos).
3. **GET verify do WhatsApp sem rate limit** (decisão documentada em
   `src/app/api/whatsapp/webhook/route.ts:31` — risco avaliado como menor; manter).
4. **Residuais de float no legado** (fora do core Etapa 5, sem teste que prove erro —
   dívida documentada, não refatorada):
   `src/services/reports/financial-reports.service.ts:146,154`,
   `src/services/installments/installment.service.ts`,
   `src/services/payments/payment.service.ts:39,118`,
   `src/services/budgets/budget.service.ts:507`,
   `src/modules/financeiro/actions/obter-dashboard.ts:18`,
   `src/services/dispatch-charge-job.ts:36`.
