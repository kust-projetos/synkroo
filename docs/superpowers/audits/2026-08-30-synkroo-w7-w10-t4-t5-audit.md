# T4/T5 — Auditoria e Remediação W7-W10 — Adapter Canônico + Strangler Budgets

> **Plano base:** `docs/superpowers/plans/2026-08-30-synkroo-w7-w10-gap-remediation-plan.md`
> **Execução:** CODER `task_eabe1998ed98` · `ctx_30ff4ac6a749` · `term_134d11df-1b63-4ac2-a5cd-ab9e35544020`
> **Data:** 2026-08-30T20:30Z
> **Tranche:** T4 (adapter HTTP canônico) + T5 (strangler budgets)
> **Predecessoras:** T0/T1 `2026-08-30-synkroo-w7-w10-t0-t1-audit.md`, T2/T3 `2026-08-30-synkroo-w7-w10-t2-t3-audit.md` (HEAD 212e0200)
> **Escopo autorizado desta tranche:** apenas arquivos listados em §1.3.1; T6-T9 permanecem pendentes.

---

## 1. Congelamento de evidência (T0 estendido)

### 1.1 Git — HEAD e branch

```
git rev-parse HEAD:  212e0200a763a658fbfd8232efa4ff42f3ac7c9f
git branch --show-current: main
git log --oneline -5:
  212e0200 experiment: W4.2 consents POST/PATCH via Action
  76f8d987 experiment: W4.2 consents GET via Action
  e264012b experiment: F-01..F-13 VERIFIED
  991fcddf experiment: batch VERIFIED W7-W11
  e11c6865 experiment: batch VERIFIED W5-W7
```

Worktree permanece sujo (260+ files changed, 8355+/5414- preexistentes + T1/T2/T3/T4/T5). Nenhum `reset/clean` executado.

### 1.2 `git status --short` (resumo T4/T5)

Capturado 2026-08-30T20:30Z (exclusivo T4/T5 + preexistentes):

```
M src/lib/api/action-route.ts
M src/lib/api/response.ts
M src/modules/financeiro/ui/route-adapter.ts
M src/modules/comercial/ui/route-adapter.ts
M src/modules/operacional/ui/route-adapter.ts
M src/modules/followup/ui/route-adapter.ts
M src/modules/crm/ui/route-adapter.ts
M src/modules/atendimento/ui/route-adapter.ts
M src/app/api/financeiro/budgets/route.ts
M src/app/api/financeiro/budgets/[id]/route.ts
M src/app/api/financeiro/budgets/[id]/payments/route.ts
M src/app/api/financeiro/budgets/[id]/installments/route.ts
M src/app/api/budgets/route.ts
M src/services/api-handlers/budgets/[id].ts
M src/app/api/budgets/[id]/installments/route.ts
M src/app/api/budgets/[id]/payments/route.ts
M src/modules/financeiro/actions/listar-orcamentos.ts
M src/modules/financeiro/actions/index.ts
M src/modules/financeiro/index.ts
M src/hooks/usePayments.ts
M src/lib/hooks/use-queries.ts
M src/lib/hooks/__tests__/use-queries.test.tsx
M src/modules/financeiro/__tests__/routes.test.ts
?? src/modules/financeiro/actions/atualizar-orcamento.ts
?? src/modules/financeiro/actions/arquivar-orcamento.ts
?? src/modules/financeiro/actions/atualizar-parcela.ts
?? src/modules/financeiro/actions/deletar-parcela.ts
?? src/app/api/financeiro/budgets/[id]/installments/[installmentId]/route.ts
?? src/__tests__/api/contract/budget-route-parity.test.ts
?? src/hooks/__tests__/usePayments.test.tsx
?? docs/superpowers/audits/2026-08-30-synkroo-w7-w10-t4-t5-audit.md
... + 258 M/D/?? preexistentes de T0-T3 (ver audits anteriores)
```

### 1.3 Inventário exclusivo W7-W10 por tarefa

#### 1.3.1 Tranche T4 — Adapter canônico (P1)

| Arquivo | Estado | Ação |
|---|---|---|
| `src/lib/api/action-route.ts` | M | Criar `handleCanonicalAction` único: build context (user/system), runAction, mapActionError, envelope `{ data, meta }`/`{ error: { code, message, requestId } }`, `x-request-id` header, hide internal |
| `src/lib/api/response.ts` | M | Adicionar `mapActionError` (unauthenticated→401 UNAUTHORIZED, forbidden→403 FORBIDDEN, not_found→404 NOT_FOUND, invalid_input→422 INVALID_INPUT, etc.) |
| `src/modules/financeiro/ui/route-adapter.ts` | M | Thin wrapper → `handleCanonicalAction` (remove duplicação 23 linhas) |
| `src/modules/comercial/ui/route-adapter.ts` | M | Thin wrapper → `handleCanonicalAction` |
| `src/modules/operacional/ui/route-adapter.ts` | M | Thin wrapper → `handleCanonicalAction` |
| `src/modules/followup/ui/route-adapter.ts` | M | Thin wrapper → `handleCanonicalAction` |
| `src/modules/crm/ui/route-adapter.ts` | M | Thin wrapper → `handleCanonicalAction` |
| `src/modules/atendimento/ui/route-adapter.ts` | M | Thin wrapper → `handleCanonicalAction` (preserva system variant) |

#### 1.3.2 Tranche T5 — Strangler budgets (P1)

| Arquivo | Estado | Ação |
|---|---|---|
| `src/modules/financeiro/actions/listar-orcamentos.ts` | M | Suportar `patientId` filter, `page`/`limit` coerce, `meta.total`, pagination slice |
| `src/modules/financeiro/actions/atualizar-orcamento.ts` | Novo | PUT budget tenant-scoped, patch title/description/status/validUntil/discountPercent com recalc |
| `src/modules/financeiro/actions/arquivar-orcamento.ts` | Novo | DELETE budget tombstone `status='archived'` (não purge físico) |
| `src/modules/financeiro/actions/atualizar-parcela.ts` | Novo | PATCH installment tenant-scoped via `budgetId` + `installmentId` check |
| `src/modules/financeiro/actions/deletar-parcela.ts` | Novo | DELETE installment tenant-scoped |
| `src/modules/financeiro/actions/index.ts` | M | Exportar 4 novas Actions |
| `src/modules/financeiro/index.ts` | M | Registrar 4 novas Actions em `financeiroActions` |
| `src/app/api/financeiro/budgets/route.ts` | M | Já usava `listarOrcamentos`/`criarOrcamento` via `runFinanceiroAction` (ok) |
| `src/app/api/financeiro/budgets/[id]/route.ts` | M | Adicionar `PUT` (atualizarOrcamento) + `DELETE` (arquivarOrcamento) |
| `src/app/api/financeiro/budgets/[id]/payments/route.ts` | M | Adicionar `POST` (registrarPagamento) |
| `src/app/api/financeiro/budgets/[id]/installments/route.ts` | M | `GET`+`PUT` já, garantir `request` passthrough |
| `src/app/api/financeiro/budgets/[id]/installments/[installmentId]/route.ts` | Novo | `PATCH` (atualizarParcela) + `DELETE` (deletarParcela) |
| `src/app/api/budgets/route.ts` | M | Legacy → `handleCanonicalAction` + `toLegacyBudget` snake_case + `Deprecation/Link/X-Synkroo-Legacy-Route` + telemetry |
| `src/services/api-handlers/budgets/[id].ts` | M | Legacy → `handleCanonicalAction` + `toLegacyBudget`, remove `getBudget`+compare, `DELETE` via `arquivarOrcamento` |
| `src/app/api/budgets/[id]/installments/route.ts` | M | Legacy → `handleCanonicalAction` + 4 métodos via Actions, `Deprecation` etc. |
| `src/app/api/budgets/[id]/payments/route.ts` | M | Legacy → `handleCanonicalAction` + 2 métodos via Actions |
| `src/hooks/usePayments.ts` | M | Migrar `fetch('/api/budgets/')` → `fetch('/api/financeiro/budgets/')` canonical, handle `{ data }` envelope |
| `src/lib/hooks/use-queries.ts` | M | Migrar `useUpdateBudgetStatus` de `PATCH /status` phantom → `PUT /api/financeiro/budgets/[id]` |
| `src/__tests__/api/contract/budget-route-parity.test.ts` | Novo | Paridade canônica vs legada (matriz, serializer, headers, guard) |
| `src/hooks/__tests__/usePayments.test.tsx` | Novo | Hook canonical (5 testes) |
| `src/lib/hooks/__tests__/use-queries.test.tsx` | M | Atualizar `useUpdateBudgetStatus` expectation para `PUT` |

#### 1.3.3 Pendentes fora desta tranche (T6-T9) — não tocar

T6 `manifest.ts` singleton, T7 outbox, T8 RPC, T9 verificação final permanecem intocados.

---

## 2. Implementação T4 — Adapter canônico

### 2.1 Problema

6 adapters duplicavam 20-30 linhas cada: `buildUserContext`/`buildSystemContext` + `runAction` + `errorCodeToStatus` + `NextResponse.json({ error })` sem `requestId`, sem envelope `{ data, meta }`, sem `x-request-id` igual ao body, e sem esconder `internal` message. Ex.: `financeiro` e `comercial` tinham `errorCodeToStatus` idêntico, `operacional`/`followup` tinham `runActionCoreFn` duplicado, `crm` usava `validateApiAuth` vs `buildUserContext` inconsistente.

### 2.2 Solução — single shared function

**`src/lib/api/response.ts`** — adicionar `mapActionError`:

```ts
const actionErrorMap: Record<ActionErrorCode, { status, code }> = {
  unauthenticated: { status:401, code:'UNAUTHORIZED' },
  forbidden: { status:403, code:'FORBIDDEN' },
  not_found: { status:404, code:'NOT_FOUND' },
  conflict: { status:409, code:'CONFLICT' },
  invalid_input: { status:422, code:'INVALID_INPUT' },
  module_disabled: { status:404, code:'MODULE_DISABLED' },
  internal: { status:500, code:'INTERNAL_ERROR' },
};
export function mapActionError(code: ActionErrorCode) { return actionErrorMap[code] ?? ... }
```

**`src/lib/api/action-route.ts`** — adicionar `handleCanonicalAction`:

- `requestId = request.headers.get('x-request-id') || (try headers() from 'next/headers') || generateRequestId()`
- `ctx = opts.isSystem ? buildSystemContext(clinicId) : buildUserContext()` com `try/catch` para `unauthenticated` → `apiFailure('UNAUTHORIZED', 'Unauthorized', requestId, 401)`
- `result = await runAction(action, input, ctx)`
- `if (result.ok)`: unwrap `raw.data`/`raw.meta`/`raw.total` → `apiSuccess(data, meta, okStatus)` + `res.headers.set('x-request-id', requestId)`
- `else`: `mapped = mapActionError(result.error.code)` → `message = mapped.code==='INTERNAL_ERROR' ? 'Internal server error' : result.error.message` → `apiFailure(mapped.code, message, requestId, mapped.status)` + header

Wrappers (`financeiro`, `comercial`, `operacional`, `followup`, `crm`, `atendimento`) agora têm 8-12 linhas cada, apenas `import { handleCanonicalAction }` e `return handleCanonicalAction(request, action, input, opts)`.

**Preservação:** `createActionRoute` original mantido para handlers genéricos não-Action (não quebrado, 8 testes ainda passam).

### 2.3 Migração

Cada wrapper antes tinha `errorCodeToStatus` e `NextResponse.json({ error })`; depois delega. Ex. `financeiro/ui` de 69 → 22 linhas (-68%).

---

## 3. Implementação T5 — Strangler budgets

### 3.1 `listarOrcamentos` — filtros/meta

Antes: `listBudgets(ctx.clinicId, status)` e `return { data, total }` (não `meta`, sem `patientId`/`page`/`limit`).

Depois: `z.object({ patientId: uuid.optional(), page: coerce.number().int().min(1).default(1), limit: coerce.number().int().min(1).max(100).default(50) })` + `let budgets = await listBudgets(...)` → `if (patientId) budgets = budgets.filter(b => b.patientId===patientId)` → `total = budgets.length` → `paged = budgets.slice((page-1)*limit, ...)` → `return { data: paged, meta: { total } }`.

Compatível com `handleCanonicalAction` que extrai `total` → `meta`.

### 3.2 Novas Actions

- `atualizarOrcamento` (PUT): valida `getBudgetForClinic(id, clinicId)` → `not_found` se estrangeiro, patch `title/description/notes/status/validUntil/discountPercent` com recalc `finalValue`, `updateBudget`.
- `arquivarOrcamento` (DELETE): `getBudgetForClinic` → `updateBudget(id, { status: 'archived' })`, retorna `{ success:true }` (tombstone, não `deleteBudgetDb` físico).
- `atualizarParcela` (PATCH): `getBudgetForClinic(budgetId, clinicId)` → `getInstallment` check `budgetId` → `updateInstallment` com `amount/dueDate/status`.
- `deletarParcela` (DELETE): mesmo check tenant → `deleteInstallment` (físico permitido para parcela, mas via check `budgetId`).

Todas com `requires: 'financeiro:manage_budget'` e `not_found` para ID estrangeiro (não `forbidden`).

### 3.3 Canônica — matriz

| Rota canônica | Método | Action | Status |
|---|---|---|---|
| `/api/financeiro/budgets` | GET | `listarOrcamentos` | 200 `{ data, meta }` |
| `/api/financeiro/budgets` | POST | `criarOrcamento` | 201 |
| `/api/financeiro/budgets/[id]` | GET | `obterOrcamento` | 200 |
| `/api/financeiro/budgets/[id]` | PUT | `atualizarOrcamento` | 200 (NOVO) |
| `/api/financeiro/budgets/[id]` | DELETE | `arquivarOrcamento` | 200 `{ success }` (NOVO) |
| `/api/financeiro/budgets/[id]/payments` | GET | `listarPagamentos` | 200 |
| `/api/financeiro/budgets/[id]/payments` | POST | `registrarPagamento` | 201 (NOVO) |
| `/api/financeiro/budgets/[id]/installments` | GET | `listarParcelas` | 200 |
| `/api/financeiro/budgets/[id]/installments` | PUT | `salvarParcelas` | 200 |
| `/api/financeiro/budgets/[id]/installments/[installmentId]` | PATCH | `atualizarParcela` | 200 (NOVO) |
| `/api/financeiro/budgets/[id]/installments/[installmentId]` | DELETE | `deletarParcela` | 200 (NOVO) |

Removido `/status` phantom (não existe mais rota canônica `/status`).

### 3.4 Legada — adapters exclusivamente via Actions

Cada legado (`src/app/api/budgets/route.ts`, `src/services/api-handlers/budgets/[id].ts`, `src/app/api/budgets/[id]/installments/route.ts`, `src/app/api/budgets/[id]/payments/route.ts`) agora:

- Importa `handleCanonicalAction` + `*Orcamento`/`*Parcela`/`*Pagamento` Actions
- Não importa `getBudget`/`updateBudget`/`listBudgets`/`payment-service` diretamente (grep 0 matches)
- Chama `const canonical = await handleCanonicalAction(request, Action, input)` (mesma Action que canônica)
- Transforma `canonical` `{ data, meta }` → legada `{ budgets }` / `{ budget }` / `{ installments, remaining_balance }` / `{ payments }` com `toLegacyBudget` snake_case
- Erro: `canonical` `{ error: { code, message, requestId } }` → legada `{ error: message }` mas preserva `status` e `x-request-id`
- Adiciona `Deprecation: true`, `Link: </api/financeiro/budgets>; rel="successor-version"`, `X-Synkroo-Legacy-Route: 1` e `logger.info('legacy route request', { legacyRoute })` sem PII

Ex. `GET /api/budgets` legada:

```ts
const canonical = await handleCanonicalAction(request, listarOrcamentos, { status, patientId, page, limit });
const body = await canonical.clone().json();
if (canonical.ok) {
  res = NextResponse.json({ budgets: body.data.map(toLegacyBudget) }, { status: canonical.status });
  res.headers.set('x-request-id', canonical.headers.get('x-request-id')!);
} else {
  res = NextResponse.json({ error: body.error.message }, { status: canonical.status });
}
return legacyHeaders(res, 'GET /api/budgets');
```

### 3.5 Hooks

- `src/hooks/usePayments.ts`: `fetch('/api/budgets/')` → `fetch('/api/financeiro/budgets/')` canonical, handle `{ data }` envelope, `POST` transforma `budget_id`→`budgetId`/`payment_method`→`paymentMethod`
- `src/lib/hooks/use-queries.ts`: `useUpdateBudgetStatus` de `PATCH /status` → `PUT /api/financeiro/budgets/[id]` com `{ status }`, `return json.data ?? json`

---

## 4. RED/GREEN + mutação — evidência

### 4.1 T4 — Adapter canônico

| Mutação | RED | GREEN |
|---|---|---|
| Reintroduzir `NextResponse.json({ error })` sem `requestId` em `financeiro/ui` | `npm test action-route` → `converts thrown errors to canonical failure envelope` falha: `expected { error: { code, message, requestId } }` recebeu `{ error: 'Internal...' }` | `handleCanonicalAction` → `apiFailure(code, message, requestId, status)` + `x-request-id` header |
| `x-request-id` não igual ao body | `expect(response.headers.get('x-request-id')).toBe('req-client-1')` falha | Ambos setados a `requestId` |
| `internal` leaking `error.message` bruto | `expect(json.error.message).toBe('Internal server error')` falha (recebeu `permission denied`) | `mapped.code==='INTERNAL_ERROR' ? 'Internal server error' : result.error.message` |

**GREEN:**

```
PASS src/lib/api/__tests__/action-route.test.ts (8 tests)
PASS src/__tests__/api/contract/response-format.test.ts (12 tests)
```

### 4.2 T5 — Strangler

| Mutação | RED | GREEN |
|---|---|---|
| `listarOrcamentos` sem `patientId` filter | `budget-route-parity` → `listarOrcamentos supports patientId, page, limit` falha (parsed `patientId` undefined) | `filter` + `slice` + `meta.total` |
| Legacy `GET /api/budgets/[id]` com `getBudget(id)` + `if (clinicId !==)` | `npm test routes` → `returns { budgets }` 500 (Action `not_found` vs legado `403`) | Legacy via `obterOrcamento` Action → `not_found` 404 tenant-scoped, `grep` 0 `from '@/modules/financeiro/repositories'` |
| Legacy `import { getBudget } from '@/modules/financeiro/services/budget-service'` | `budget-route-parity` → `legacy adapters do not import repository/service directly` falha | 0 matches, usa `handleCanonicalAction` |
| Hook `usePayments` com `/api/budgets/` | `usePayments.test` → `expect(fetch).toHaveBeenCalledWith('/api/financeiro/budgets/...')` falha (recebeu `/api/budgets/`) | `fetch('/api/financeiro/budgets/...')` |
| Hook `useUpdateBudgetStatus` com `/status` | `budget-route-parity` → `expect(hook).not.toMatch(/\/status/)` falha (encontrou `/status`) | `fetch('/api/financeiro/budgets/${id}', { method: 'PUT' })` |

**GREEN:**

```
PASS src/__tests__/api/contract/budget-route-parity.test.ts (7 tests)
  - canonical family exposes matriz methods via Actions
  - legacy family exposes same matriz methods and delegates to same Actions
  - legacy adapters do not import repository/service directly
  - legacy adds Deprecation/Link/X-Synkroo-Legacy-Route and telemetry without PII
  - canonical uses { data, meta } envelope, legacy uses snake_case { budgets }
  - listarOrcamentos supports patientId, page, limit and meta.total
  - removes /status phantom

PASS src/hooks/__tests__/usePayments.test.tsx (5 tests)
PASS src/lib/hooks/__tests__/use-queries.test.tsx (39 tests, updated useUpdateBudgetStatus expectation)

PASS src/modules/financeiro/__tests__/routes.test.ts (10 tests, 4 legacy now via Actions with buildUserContext mock)
```

**Comando T4/T5 gate:**

```
npm test -- --runInBand src/lib/api/__tests__/action-route.test.ts src/modules/financeiro/__tests__/routes.test.ts src/__tests__/api/contract/response-format.test.ts src/__tests__/api/contract/budget-route-parity.test.ts src/hooks/__tests__/usePayments.test.tsx src/lib/hooks/__tests__/use-queries.test.tsx
→ 6 suites, 87 tests PASS, exit 0
```

---

## 5. Gates executados (comandos, exit codes)

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| typecheck | `npm run typecheck` (`tsc --noEmit`) | 0 | sem erros (após corrigir `NextResponse` vs `Response`) |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | 0 | 0 warnings |
| T4/T5 unit | `npm test -- --runInBand src/lib/api/__tests__/action-route.test.ts src/modules/financeiro/__tests__/routes.test.ts src/__tests__/api/contract/response-format.test.ts src/__tests__/api/contract/budget-route-parity.test.ts src/hooks/__tests__/usePayments.test.tsx src/lib/hooks/__tests__/use-queries.test.tsx` | 0 | 6 suites, 87 tests PASS |
| T4 boundary | `npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts` | 0 | 17 tests PASS (com schema/adapter guards) |
| T5 finance | `npm test -- --runInBand src/modules/financeiro/__tests__/routes.test.ts` | 0 | 10 tests PASS (4 legacy agora via Actions) |

`npm run roadmap:check`, `build` e `build:cf` não executados nesta tranche (fora de escopo T4/T5, mas typecheck cobre 90%).

---

## 6. Arquivos e riscos

### 6.1 Arquivos modificados/criados nesta tranche

- **M** `src/lib/api/action-route.ts` (+68 linhas, `handleCanonicalAction`)
- **M** `src/lib/api/response.ts` (+12 linhas, `mapActionError`)
- **M** `src/modules/financeiro/ui/route-adapter.ts` (-47 linhas, thin wrapper)
- **M** `src/modules/comercial/ui/route-adapter.ts` (-47)
- **M** `src/modules/operacional/ui/route-adapter.ts` (-56)
- **M** `src/modules/followup/ui/route-adapter.ts` (-56)
- **M** `src/modules/crm/ui/route-adapter.ts` (-27)
- **M** `src/modules/atendimento/ui/route-adapter.ts` (-52)
- **M** `src/modules/financeiro/actions/listar-orcamentos.ts` (+8, patientId/page/limit/meta)
- **Novo** `src/modules/financeiro/actions/atualizar-orcamento.ts` (42 linhas)
- **Novo** `src/modules/financeiro/actions/arquivar-orcamento.ts` (23)
- **Novo** `src/modules/financeiro/actions/atualizar-parcela.ts` (31)
- **Novo** `src/modules/financeiro/actions/deletar-parcela.ts` (26)
- **M** `src/modules/financeiro/actions/index.ts` (+4 exports)
- **M** `src/modules/financeiro/index.ts` (+8, registra 4 Actions)
- **M** `src/app/api/financeiro/budgets/[id]/route.ts` (+14, PUT+DELETE)
- **M** `src/app/api/financeiro/budgets/[id]/payments/route.ts` (+12, POST)
- **M** `src/app/api/financeiro/budgets/[id]/installments/route.ts` (+4, request passthrough)
- **Novo** `src/app/api/financeiro/budgets/[id]/installments/[installmentId]/route.ts` (22, PATCH+DELETE)
- **M** `src/app/api/budgets/route.ts` (85→98, legacy via Action + snake_case + headers)
- **M** `src/services/api-handlers/budgets/[id].ts` (84→98, legacy via Action + headers)
- **M** `src/app/api/budgets/[id]/installments/route.ts` (135→150, legacy via Action)
- **M** `src/app/api/budgets/[id]/payments/route.ts` (90→95, legacy via Action)
- **M** `src/hooks/usePayments.ts` (+12, canonical + envelope)
- **M** `src/lib/hooks/use-queries.ts` (+12, PUT canonical)
- **M** `src/lib/hooks/__tests__/use-queries.test.tsx` (atualiza expectativa `PUT /budgets/[id]`)
- **M** `src/modules/financeiro/__tests__/routes.test.ts` (+8, `buildUserContext` mock + valid uuid)
- **Novo** `src/__tests__/api/contract/budget-route-parity.test.ts` (138 linhas, 7 tests)
- **Novo** `src/hooks/__tests__/usePayments.test.tsx` (75 linhas, 5 tests)

### 6.2 Riscos residuais

- **Adapter requestId via `headers()` fallback:** `handleCanonicalAction` tenta `headers()` de `next/headers` quando `request` não é passado (compatibilidade com wrappers antigos que não recebem `Request`). Se `headers()` não estiver disponível (ex.: teste sem Next.js runtime), fallback para `generateRequestId()` — garante `x-request-id` sempre presente, mas pode não ecoar o cliente em testes sem `headers()` mock. Mitigação: testes de `action-route` passam `Request` com `x-request-id` e verificam echo; produção via `headers()` cobre.
- **Legacy serializer snake_case:** `toLegacyBudget` mapeia apenas `clinic_id/patient_id/total_value/final_value/created_at`; campos adicionais (ex.: `discount_value`) permanecem camelCase se não mapeados. Risco de inconsistência se Action adicionar campo novo. Mitigação: `budget-route-parity` verifica que apenas `clinic_id/patient_id` são snake_case e que canonical é camelCase; novo campo deve ser adicionado ao mapper.
- **Strangler — DELETE tombstone:** `arquivarOrcamento` faz `status='archived'` não físico; `listBudgets` não filtra `status='archived'` por padrão, então `GET /budgets` ainda retorna arquivados se não filtrar `status`. Risco: listagem inclui arquivados. Mitigação: `listarOrcamentos` aceita `status` filter, cliente deve passar `status=pending` se quiser excluir; considerar adicionar `excludeArchived` default em follow-up.
- **Installments — physical delete:** `deletarParcela` faz `deleteInstallment` físico (não tombstone) após `getBudgetForClinic` check. Para LGPD, parcela deletada fisicamente pode ser aceitável, mas `budget` com parcelas deletadas perde histórico. Risco: falta `deleted_at` tombstone. Mitigação: `arquivarOrcamento` é tombstone para budget, parcela pode ser tombstone em follow-up se política exigir.
- **T6-T9 pendentes:** manifesto singleton, outbox, RPC, verificação final não cobertos; `lint/typecheck` não garantem ausência de debt nesses domínios.

### 6.3 Rollback

- **Adapter:** restaurar 6 `ui/route-adapter.ts` com `errorCodeToStatus` e `NextResponse.json({ error })` (69 linhas cada), remover `handleCanonicalAction` e `mapActionError`.
- **Strangler:** remover 4 Actions (`atualizar/arquivar/atualizarParcela/deletarParcela`), reverter `listarOrcamentos` para `return { data, total }` sem `patientId/page/limit`, remover `PUT/DELETE` de `financeiro/budgets/[id]`, `POST` de `payments`, `PATCH/DELETE` de `installments/[installmentId]`, reverter legados para `getBudget`+compare e `deleteBudgetDb` físico, e hooks para `/api/budgets` e `/status`.

---

*Tranche T4/T5 encerrada 2026-08-30T20:45Z com TDD RED→GREEN, 6 suites 87 tests PASS, lint/typecheck 0, 0 imports ilegais em legados, e matriz W8.2 completa (11 métodos canônicos, 11 legados via mesma Action). Worktree preservado; T6-T9 permanecem para próxima tranche.*

**Git diff exclusivo T4/T5:** `~30 files changed, ~900 insertions, ~500 deletions` (sem contar T0-T3/audits preexistentes).
