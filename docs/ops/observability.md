# Observabilidade — Synkroo (Etapa 11)

## Log estruturado — campos

Toda entrada de log usa o envelope de `src/lib/logger.ts`:

| Campo | Origem |
|---|---|
| `timestamp` | ISO-8601 gerado em `formatEntry` |
| `level` | `debug`/`info`/`warn`/`error` |
| `message` | texto estático do código (nunca payload externo) |
| `service` | nome do logger (`api`, `db`, `ai`, `whatsapp`, …) |
| `requestId` | elevado de `context.requestId` para o topo |
| `correlationId` | elevado de `context.correlationId` para o topo |
| `context` | demais campos, após redaction |

Em produção a saída é JSON por linha; em dev, prefixo legível.

## Contrato requestId

1. Gerado no envelope da API (`generateRequestId` em `src/lib/api/response.ts`).
2. Corpo de erro carrega o `requestId`.
3. Ecoado no header `x-request-id` (action routes em `src/lib/api/action-route.ts`, gates em `src/core/modules/gates.ts`).
4. No `/api/ia/chat`: correlação ponta a ponta via `resolveCorrelationId` → DO `AgentOrchestrator` → provider (telemetria `provider_call` com `correlationId`, `attempt`, `usage`).

## Política de redaction

`redactLogValue` (exportado de `src/lib/logger.ts`) é recursivo, case-insensitive,
ignora `-`/`_` e redige por **chave exata** para `[REDACTED]`.

Lista (`SENSITIVE_LOG_KEYS`): segredos (`apikey`, `authorization`, `password`,
`token`, `refreshtoken`, `secret`, `cookie`, `setcookie`, `connectionstring`,
`databaseurl`) + PII LGPD (§21: `cpf`, `cnpj`, `rg`, `telefone`, `phone`,
`phonenumber`, `celular`, `whatsapp`, `email`, `endereco`/`endereço`, `address`,
`carteirinha`, `insurance`).

O que nunca logar: conteúdo de mensagem do paciente, corpo de provider/LLM,
exceções cruas como texto livre (usar `code` da allowlist na telemetria).

Por que `name`/`patient` NÃO estão na lista: chaves genéricas demais —
redigi-las apagaria contexto operacional (ids, contadores, status) sem proteger
PII real, que viaja em chaves específicas acima. Telemetria edge
(`src/core/ia-agent/telemetry.ts`) vai além: só emite códigos da allowlist
sintática + descrições estáticas, nunca texto derivado de input externo.

Worker `ia-agent`: não importa `@/lib/logger` (acoplado a `process.env`,
incompatível com o bundle edge); usa `createTelemetryLogger` + validação de id
contra o formato fechado (`isValidCorrelationId`, senão `[REDACTED]`).

## Métricas a coletar (inventário)

- HTTP: taxa de 5xx, p50/p95/p99 de latência por rota (`route`, `status`, `latencyMs`).
- DB: latência de queries, conexões ativas/limite, timeouts.
- Integrações (Evolution/WhatsApp, gateways, LLM): `success`/`failure`/`retry`/`timeout` por provedor.
- Jobs (`/api/cron/*`): `queued`/`completed`/`failed`/`dead-letter`.
- IA: tokens in/out, custo estimado, latência por modelo, taxa de fallback.

## Alertas mínimos acionáveis

| Alerta | Sinal |
|---|---|
| Error rate alto | 5xx > limiar por rota/5min |
| DB indisponível | falha de health ou pool esgotado |
| Latência anormal | p95 acima do SLO por 10min |
| Webhook failures | falhas consecutivas inbound/Evolution |
| AI cost spike | custo/hora acima do teto |

## Pendência de runtime (NÃO implementado)

Coleta/agregação de métricas é **VALIDAR EM RUNTIME** (Cloudflare
analytics/logs, `observability.enabled` no wrangler). Este documento define o
contrato; nenhum pipeline de métricas foi provisionado nesta etapa.
