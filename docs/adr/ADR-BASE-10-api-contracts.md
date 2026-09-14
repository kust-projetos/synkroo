# ADR-BASE-10: API camelCase com `{ data, meta? }`

**Status:** ✅ Implementado  
**Data:** 2026-07-29 (builders + contract tests criados)

## Decisão

Toda resposta de API segue contrato uniforme:
```ts
type ApiSuccess<T> = { data: T; meta?: { cursor?: string; total?: number } };
type ApiFailure = { error: { code: string; message: string; requestId: string } };
```
JSON e TypeScript usam `camelCase`. IDs são UUID. Datas ISO 8601 UTC.

## Evidência

- `src/lib/api/response.ts`: builders `apiSuccess()`, `apiFailure()`, `apiErrors`, `generateRequestId()`
- `src/__tests__/api/contract/response-format.test.ts`: 17 contract tests validando formato
- `src/lib/api/__tests__/response.test.ts`: unit tests para builders

## Alternativas rejeitadas

- snake_case: adotado camelCase por consistência com TypeScript/JS
- Envelopes ad hoc: contrato uniforme via builders

## Exceções deliberadas (2026-09-14)

Contratos fora do envelope, aceitos explicitamente — não são débito de migração:

| Superfície | Shape | Justificativa |
|---|---|---|
| `GET /api/health` | `{ status, timestamp, version }` | Liveness puro de processo (sem DB/dependências); readiness real em `/api/internal/readiness` |
| `GET /api/cron/cleanup` | `{ status, message, tasks, timestamp }` | Probe operacional de scheduler; o POST do mesmo handler segue o envelope |
| `/api/seed` | Contrato próprio de provisioning | Protegido por `SEED_SECRET` (middleware `transportAuth`); usado também no setup E2E — não é contrato público de recurso |
| `/api/budgets/[id]` (legado) | Payloads legados dependentes do método (`{ budget }`, `{ success: true }`, erros `{ error: string }`) + headers `Deprecation`/`Link rel=successor-version` | Strangler em extinção; sucessor canônico é `/api/financeiro/budgets/*` |

Regra para novas superfícies: qualquer resposta fora do envelope exige entrada nesta tabela com justificativa.

### Compatibilidade transitória de entrada (2026-09-14)

`PUT /api/knowledge/[id]` aceita `is_active` (snake_case legado) além do canônico `isActive`, com precedência de `isActive`. É shim de compatibilidade para clientes antigos — remover assim que confirmado zero consumidores legados (wave D2 futura). Não usar como precedente para novos campos.

## Gap (2026-08-28 W8 em progresso)

Família canônica `/api/financeiro/budgets/*` com adapter canônico `{data,meta}`/`{error:{code,message,requestId}}` e `x-request-id` harmonizado; `createActionRoute` corrigido para não vazar `error.message` bruto. Strangler legado `/api/budgets/*` com `Deprecation`, `Link rel=successor-version` e métrica ainda pendente. Marcar Implementado após matriz método-a-método e contract tests canonical/legacy.
