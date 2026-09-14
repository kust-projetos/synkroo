# ADR-BASE-16: Política de Timeout/Retry/Idempotência das Integrações

**Status:** ✅ Implementado
**Data:** 2026-09-14 (hardening V1, trilhas A2/A3/A4)

## Contexto

Integrações externas (Evolution/WhatsApp, Instagram, Asaas, sidecar Playwright) falham de formas que a aplicação não controla: timeouts, 429/5xx, duplicação de entrega de webhooks e retries de rede. Sem política única, cada client inventa seu próprio retry — com risco de duplo envio (cobrança duplicada, mensagem duplicada) ou de retry agressivo sobre operação não-idempotente.

## Decisão

1. **Timeout explícito em todo fetch externo**, via `AbortSignal`/budget por client (referência: `src/lib/llm/providers/base.ts` com `timeoutMs` default e abort; `src/lib/sidecar/client.ts` com `timeoutMs`).
2. **Retry somente para operações idempotentes** (GET ou POST com `Idempotency-Key`), apenas em erros retryable (rede/timeout/429/5xx), com backoff exponencial + jitter e budget único de retry por operação (mecanismo: `withRetry` em `src/lib/retry.ts` — tentativas limitadas, `retryableErrors`, jitter anti-thundering-herd).
3. **Claim antes do envio (facade de envio):** a idempotência de negócio usa `withIdempotency(key, jobType, handler)` (`src/lib/idempotency/index.ts`) — primeira execução processa, duplicata retorna o resultado anterior sem reexecutar side-effects. Estados de claim distinguem concluído / em progresso / retry adiado; **fail-open só em infra-failure** (nunca como atalho de regra de negócio).
4. **Outbox com DLQ para envios enfileiráveis:** `claimOutboxJob` com `SKIP LOCKED`, estados `pending → processing → delivered`, `dead_letter` após esgotar tentativas (`src/lib/outbox/outbox-repository.ts`, `src/lib/outbox/dispatch-outbox.ts`).
5. **Budgets/Asaas:** mutações com `Idempotency-Key` (`src/modules/financeiro/gateways/providers/asaas/client.ts`, `reqHeaders`) e `maxRetries 0` em mutação de cobrança sem chave estável — cobrança nunca é retentada às cegas; reemissão passa por outbox/DLQ (`src/modules/financeiro/services/charge-service.ts` via `withIdempotency`).
6. **Freshness de webhooks inbound:** payload fora da janela é rejeitado (Evolution/messages: janela curta de 600s/300s conforme o transporte; referência de padrão: freshness check em `src/app/api/instagram/webhook/route.ts`), combinado com secret por instalação (`src/modules/atendimento/integrations/resolve-channel-installation.ts`), dedup por event-id e idempotência downstream (`src/app/api/whatsapp/evolution/route.ts`, `src/app/api/messages/inbound/route.ts`).

## Evidência

- `src/lib/retry.ts` (+ `src/lib/__tests__/retry.test.ts`) — backoff+jitter, retryable errors
- `src/lib/llm/providers/base.ts` — timeout/abort + retry orçado por tentativa
- `src/lib/idempotency/index.ts` — claim de envio
- `src/lib/outbox/` — claim, retry com backoff limitado, DLQ
- `src/modules/financeiro/gateways/providers/asaas/client.ts` — `Idempotency-Key`
- `src/modules/financeiro/services/charge-service.ts` — cobrança idempotente
- Rotas inbound + `resolve-channel-installation.ts` — secret, dedup, freshness

## Alternativas rejeitadas

- Retry genérico em qualquer erro: causa duplo side-effect em POST não-idempotente — proibido.
- Confiar só na dedup do provider (ex.: Evolution): o provider pode não suportar assinatura/idempotência — controles compensatórios (secret + dedup + freshness + claim) são obrigatórios (trilha A4).

## Consequências

- Nenhum client externo novo sem timeout explícito e sem classificação idempotente/não-idempotente.
- `first execution → process; duplicate → ignore/return previous` é verificável por teste de integração em cada facade de envio.
