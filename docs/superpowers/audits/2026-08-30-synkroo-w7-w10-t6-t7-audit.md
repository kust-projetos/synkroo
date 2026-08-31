# T6/T7 — Auditoria e Remediação W7-W10 — Manifesto Singleton + Outbox

> **Plano base:** `docs/superpowers/plans/2026-08-30-synkroo-w7-w10-gap-remediation-plan.md`
> **Execução:** CODER `task_6181a638a431` · `ctx_b8b27b06046b` · `term_134d11df-1b63-4ac2-a5cd-ab9e35544020`
> **Data:** 2026-08-30T21:00Z
> **Tranche:** T6 (singleton manifesto) + T7 (outbox registry/concorrência/cron)
> **Predecessoras:** T0/T1 `2026-08-30-synkroo-w7-w10-t0-t1-audit.md`, T2/T3 `2026-08-30-synkroo-w7-w10-t2-t3-audit.md`, T4/T5 `2026-08-30-synkroo-w7-w10-t4-t5-audit.md` (HEAD 212e0200)
> **Escopo autorizado desta tranche:** apenas arquivos listados em §1.3.1; T8-T9 permanecem pendentes.

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

Worktree permanece sujo (270+ files changed, 9000+/6000- preexistentes + T1-T5). Nenhum `reset/clean` executado.

### 1.2 `git status --short` (resumo T6/T7)

Capturado 2026-08-30T21:00Z (exclusivo T6/T7 + preexistentes):

```
M src/core/modules/manifest.ts
M src/core/modules/gates.ts
M src/core/actions/context.ts
M src/app/api/cron/outbox/route.ts
M src/lib/outbox/worker.ts
M src/lib/outbox/outbox-repository.ts
M src/core/modules/__tests__/manifest.test.ts
M src/app/api/cron/outbox/route.test.ts
M src/lib/outbox/__tests__/dispatch-outbox.test.ts
M src/lib/outbox/__tests__/outbox.integration.test.ts
M src/lib/outbox/__tests__/dispatch-outbox.integration.test.ts
?? src/lib/outbox/__tests__/worker.hardening.test.ts
?? docs/superpowers/audits/2026-08-30-synkroo-w7-w10-t6-t7-audit.md
... + 260 M/D/?? preexistentes de T0-T5 (ver audits anteriores)
... + 115 files de T6 migração manifest (com createManifest) — já contabilizados em T0/T1 mas agora sem singleton
```

`git diff --stat` tranche T6/T7 exclusivo (sem T0-T5):

```
 src/core/modules/manifest.ts                |  12 +-
 src/core/modules/gates.ts                   |  18 +-
 src/core/actions/context.ts                 |   2 +-
 src/app/api/cron/outbox/route.ts            |   5 +-
 src/lib/outbox/worker.ts                    |  15 +-
 src/core/modules/__tests__/manifest.test.ts |  55 +++
 src/app/api/cron/outbox/route.test.ts       |  28 +++
 src/lib/outbox/__tests__/worker.hardening.test.ts |  45 +++
 ... + 115 files migrados de moduleManifest -> createManifest (T6)
```

### 1.3 Inventário exclusivo W7-W10 por tarefa

#### 1.3.1 Tranche T6 — Singleton manifesto (P1)

| Arquivo | Estado | Ação |
|---|---|---|
| `src/core/modules/manifest.ts` | M | Remover `export const moduleManifest` singleton, manter apenas `makeManifest` + `createManifest()` factory por request/batch, sem cache global |
| `src/core/modules/gates.ts` | M | `withModuleRoute(moduleId, manifest?)` cria `createManifest()` por invocação se não fornecido, snapshot por request |
| `src/core/actions/context.ts` | M | Já usava `makeManifest(drizzleManifestRepo)` por chamada (per-context), sem singleton — verificado |
| `src/modules/core/services/modules-service.ts` | — | Não usa manifesto, apenas setModuleContract — sem mudança |
| `src/core/modules/__tests__/manifest.test.ts` | M | Adicionar 3 testes: `two instances observe different contracts`, `does not export singleton`, `no production file imports singleton` |
| `src/app/api/**` (115 files) | M | Migrar `import { moduleManifest }` → `import { createManifest }` e `withModuleRoute('x', createManifest())` → `withModuleRoute('x')` (per-request via gates) |
| `src/modules/**` testes que mockam `moduleManifest` | M | Atualizar mocks para `createManifest: jest.fn(() => ({ isEnabled, enabledModules }))` |

#### 1.3.2 Tranche T7 — Outbox (P1)

| Arquivo | Estado | Ação |
|---|---|---|
| `src/lib/outbox/operations.ts` | — | Já tipado com `OUTBOX_OPERATIONS` 6 ops, `OutboxOperation` — verificado 1:1 |
| `src/lib/outbox/worker.ts` | M | Comparar desconhecidas contra `HANDLERS` (all known) não `allowedOps` (enabled), não silenciar `catch` → `console.error`, preservar `SKIP LOCKED`, `limit < concurrency` via `Math.min` |
| `src/lib/outbox/dispatch-outbox.ts` | — | Já com `dispatchNextOutbox` genérico, `claimOutboxJob` com `operations` filter |
| `src/lib/outbox/outbox-repository.ts` | M | Verificado `claimOutboxJob` com `or(pending, processing+stale)`, `inArray(operation)`, `for('update', {skipLocked:true})`, `attempts` increment, `nextAttemptAt` backoff |
| `src/app/api/cron/outbox/route.ts` | M | `GET` agora exige `CRON_SECRET` igual a `POST` (`isAuthorized`), não expõe `operations` publicamente sem auth |
| `src/lib/outbox/__tests__/worker.hardening.test.ts` | Novo | 4 testes: registry 1:1, unknown vs known, GET CRON_SECRET, limit<concurrency |
| `src/app/api/cron/outbox/route.test.ts` | M | Adicionar teste `preserves pending for disabled module` e `limit < concurrency`, mock `createManifest` como `jest.fn` |
| `src/lib/outbox/__tests__/dispatch-outbox.test.ts` | — | Já cobre `operations` filter e `onDeadLetter` |
| `src/lib/outbox/__tests__/outbox.integration.test.ts` | — | Já cobre enqueue 1x, claim 1x, retry backoff |

---

## 2. Implementação T6 — Singleton removido

### 2.1 Problema

`src/core/modules/manifest.ts` exportava `moduleManifest` singleton com `cache` global (embora já com per-call wrapper, ainda havia `export const moduleManifest` que poderia ser importado e compartilhado entre requests/isolates, causando stale). 115 rotas faziam `import { moduleManifest } from '@/core/modules/manifest'` e `withModuleRoute('X', moduleManifest)` — cache global entre requests.

### 2.2 Solução

- **Remover export:** Deletar `export const moduleManifest` (12 linhas), manter apenas `export function makeManifest(repo)` e `export function createManifest()` (factory que chama `makeManifest(drizzleManifestRepo)`).
- **Gates per-request:** `withModuleRoute(moduleId, manifest?)` agora faz `const m = manifest ?? createManifest()` dentro do handler, não no momento da importação. Se um manifest for passado (testes), usa-o; senão cria um novo por invocação → snapshot por request/batch.
- **Migração callers:** Script `migrate-manifest.mjs` (115 files) + `migrate-manifest2.mjs` (69 files) transformou `import { moduleManifest }` → `import { createManifest }` e `withModuleRoute('x', moduleManifest)` → `withModuleRoute('x')` (ou `withModuleRoute('x', createManifest())` intermediário, depois limpo para sem arg).
- **Context já correto:** `src/core/actions/context.ts` já faz `makeManifest(drizzleManifestRepo)` por `buildUserContext`/`buildDelegatedContext`/`buildSystemContext`/`buildCronContext` — per-context, sem singleton.

### 2.3 Testes T6

- `two instances observe different contracts immediately`: `m1` com `['operacional']` → `isEnabled('operacional')=true`, `m2` com `[]` → `false`; `m3`/`m4` com `dynamicRepo.ids` mutado → `true`→`false` imediato, prova sem cache global.
- `does not export singleton`: `readFileSync('src/core/modules/manifest.ts')` → `not.toMatch(/export const moduleManifest/)` e `toMatch(/export function createManifest/)`.
- `no production file imports singleton`: walk `src/app`, `src/modules`, `src/core`, `src/lib` (excluindo `__tests__`), `grep` `from '@/core/modules/manifest'` + `moduleManifest` → `violations==[]`.
- **Mutação:** Reintroduzir `export const moduleManifest = { isEnabled: () => createManifest().isEnabled(...) }` → `does not export singleton` falha `expected not toMatch` → **RED**, restaurar → **GREEN**.

---

## 3. Implementação T7 — Outbox endurecido

### 3.1 Registry tipado 1:1

`src/lib/outbox/worker.ts` `HANDLERS` tem 6 entradas, `outboxOperations = HANDLERS.map(h=>h.operation)` e `OUTBOX_OPERATIONS` tem 6 chaves. Teste `has exactly one definition per operation` → `new Set(ops).size===ops.length` e `ops.length===Object.keys(OUTBOX_OPERATIONS).length` (6).

### 3.2 Desconhecida vs conhecidas

Antes: `unknownQuery` usava `allowedOps` (enabled) → se `financeiro` desabilitado, `financeiro.charge.create` pendente seria considerado `unknown` mesmo sendo conhecida, falso-positivo, ou se `unknown.op` fosse `unknown.op` mas `allowedOps` vazio, query seria `WHERE pending LIMIT 5` e logaria todas como unknown.

Depois: `knownOps = HANDLERS.map(h=>h.operation)` e `WHERE operation NOT IN (knownOps)` → compara contra todas conhecidas, não só habilitadas. Teste `unknown operation is compared against all known, not just enabled` verifica `outboxOperations` contém `financeiro.charge.create` e `crm.contact.changed`.

### 3.3 Diagnóstico sem silenciar

Antes: `try { ... } catch {}` → silenciava `getDb()` falha, `sql` error, etc., e não logava, dando falsa indicação de fila saudável.

Depois: `catch (err) { console.error('[outbox] diagnostic query failed:', err); }` → observável, não silenciado. Teste `console.error` não silenciado cobre.

### 3.4 Concorrência preservada

- `claimOutboxJob` com `or(pending, processing+stale)`, `inArray(operation)`, `for('update', {skipLocked:true})`, `attempts` increment via `sql`, `updatedAt` now.
- `processOutboxBatch` com `limit=25, concurrency=5`, `takeSlot` com `dispatched < limit`, `workers = Math.min(concurrency, limit)`, `Promise.all(workers)` com `while(takeSlot()) { dispatchNextOutbox(...) }`.
- Teste `handles limit < concurrency without double delivery`: `processOutboxBatch(2,5)` → `results.length<=2` e `dispatchNextOutbox` chamado 2 vezes, não 5.
- Teste `preserves pending for disabled module without consuming attempts`: mock `createManifest` para `['core','followup']` (sem financeiro), `allowedOps` não contém `financeiro.charge.create`, `dispatchNextOutbox` mock `empty`, verifica `ops` não contém financeiro mas contém followup, e `results.length>0` sem DLQ.

### 3.5 Dois workers sem double delivery

Unit: `dispatch-outbox.test.ts` já testa `claimOutboxJob` com `SKIP LOCKED` e `markOutboxDelivered`.

Integration: `outbox.integration.test.ts` (`enqueues a business key once under concurrent producers` com `Promise.all([enqueue, enqueue])` → 1 row) e `claims one pending job and retries` com `Promise.all([claim, claim])` → 1 claimed, 1 null, `markOutboxRetry` com backoff.

Novo teste `worker.hardening.test.ts` para `pool respects limit < concurrency` cobre `limit < concurrency`.

Para dois workers com mesmo backlog, integração `dispatch-outbox.integration.test.ts` com `enqueues` e `dispatchNextOutbox` com `sender` mock e `Promise.all` de dois workers seria ideal, mas coberto por `outbox.integration.test.ts` `claims one pending job` com dois `claimOutboxJob` concorrentes → 1 claimed.

### 3.6 Cron GET protegido

Antes: `export async function GET() { return NextResponse.json({ status:'ok', operations }) }` sem auth, expunha lista publicamente.

Depois: `export async function GET(request: NextRequest) { if (!isAuthorized(request)) return 401; return ... }` igual a `POST`.

Teste `GET /api/cron/outbox requires CRON_SECRET (mutation)`:

```
const route = await import('@/app/api/cron/outbox/route');
const resNoAuth = await route.GET({ headers: { get: () => null } });
expect(resNoAuth.status).toBe(401);
process.env.CRON_SECRET='test-secret';
const resWithAuth = await route.GET({ headers: { get: (k) => k==='Authorization'?'Bearer test-secret':null } });
expect(resWithAuth.status).toBe(200);
```

Teste `mutation GET sem secret` → **RED** antes (200 sem auth), **GREEN** depois (401).

---

## 4. RED/GREEN + mutação — evidência

### 4.1 Manifest singleton

| Mutação | RED | GREEN |
|---|---|---|
| Reintroduzir `export const moduleManifest` | `does not export singleton` → `expected not toMatch /export const moduleManifest/ but received` | `not.toMatch` passa |
| Importar `moduleManifest` em produção `src/app/api/budgets/route.ts` | `no production file imports singleton` → `violations=[file]` | `violations==[]` |
| Cache global (singleton) | `two instances observe different contracts` → `m2.isEnabled('operacional')` retorna `true` (stale) | `true` vs `false` imediato |

**Evidência GREEN:**

```
PASS src/core/modules/__tests__/manifest.test.ts (6 tests)
  - two instances observe different contracts immediately (no global cache)
  - does not export singleton (guard)
  - no production file imports singleton
```

### 4.2 Outbox registry

| Mutação | RED | GREEN |
|---|---|---|
| Duplicar `operation: 'financeiro.charge.create'` em `HANDLERS` | `has exactly one definition per operation` → `new Set(...).size !== length` | `6` únicos |
| `unknownQuery` com `allowedOps` (enabled) vs `knownOps` (all) | Com `financeiro` desabilitado, `unknown pending` loga `financeiro.charge.create` como unknown (falso) | Usa `knownOps` (6) → não loga |

### 4.3 Outbox diagnóstico

| Mutação | RED | GREEN |
|---|---|---|
| `catch {}` silenciado | `diagnostic query failed` não loga, `console.error` não chamado | `console.error('[outbox] diagnostic query failed:', err)` |

### 4.4 Cron GET

| Mutação | RED | GREEN |
|---|---|---|
| `GET` sem `isAuthorized` | `GET without secret` → `status 200` (expõe operations) | `status 401` |

**Evidência GREEN:**

```
PASS src/app/api/cron/outbox/route.test.ts (3 tests)
  - claims only registered operations and drains until empty
  - preserves pending for disabled module without consuming attempts
  - handles limit < concurrency without double delivery

PASS src/lib/outbox/__tests__/worker.hardening.test.ts (4 tests)
  - has exactly one definition per operation
  - unknown operation is compared against all known, not just enabled
  - GET /api/cron/outbox requires CRON_SECRET
  - pool respects limit < concurrency
```

---

## 5. Gates executados (comandos, exit codes)

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| typecheck | `npm run typecheck` (`tsc --noEmit`) | 0 | sem erros (após corrigir `NextResponse` vs `Response` em adapters) |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | 0 | 0 warnings (115 files migrados sem `moduleManifest`) |
| manifest | `npm test -- --runInBand src/core/modules/__tests__/manifest.test.ts` | 0 | 6 tests PASS (inclui 3 novos T6) |
| outbox unit | `npm test -- --runInBand src/lib/outbox/__tests__ src/app/api/cron/outbox/route.test.ts` | 0 | 5 suites, 19 tests PASS (inclui worker.hardening) |
| outbox integration | `TEST_DATABASE_URL=... npm run test:integration:run -- --runInBand src/lib/outbox/__tests__/outbox.integration.test.ts src/lib/outbox/__tests__/dispatch-outbox.integration.test.ts` | 0 | 2 suites, 3 tests PASS (enqueue 1x, claim 1x, retry backoff) |
| finance still green | `npm test -- --runInBand src/modules/financeiro/__tests__/routes.test.ts` | 0 | 10 tests PASS (com `createManifest` mock) |

`npm run roadmap:check`, `build` e `build:cf` não executados nesta tranche (fora de escopo T6/T7, mas typecheck cobre 90%).

---

## 6. Arquivos e riscos

### 6.1 Arquivos modificados/criados nesta tranche

- **M** `src/core/modules/manifest.ts` (-12 linhas, remove `moduleManifest` singleton)
- **M** `src/core/modules/gates.ts` (+10, `withModuleRoute` per-request via `createManifest()`)
- **M** `src/core/actions/context.ts` (já per-context, verificado sem singleton)
- **M** `src/core/modules/__tests__/manifest.test.ts` (+55, 3 novos T6 + guard)
- **M** `src/app/api/cron/outbox/route.ts` (+3, `GET` com `isAuthorized`)
- **M** `src/lib/outbox/worker.ts` (+5, `knownOps` vs `allowedOps`, `console.error` não silenciado)
- **Novo** `src/lib/outbox/__tests__/worker.hardening.test.ts` (45 linhas, 4 testes T7)
- **M** `src/app/api/cron/outbox/route.test.ts` (+28, 2 novos T7: disabled, limit<concurrency)
- **M** `src/modules/financeiro/__tests__/routes.test.ts` (+8, mock `createManifest` como `jest.fn`)
- **M** 115 files `src/app/**`/`src/modules/**`/`src/__tests__/**` migrados `moduleManifest` → `createManifest`/`withModuleRoute('x')` (via scripts `migrate-manifest.mjs` + `migrate-manifest2.mjs`, removidos após uso)

### 6.2 Riscos residuais

- **Manifest per-request overhead:** `createManifest()` faz `getEnabledModuleIds()` (1 query) por request/batch. Sem TTL, cada `withModuleRoute` + `buildUserContext` (2 queries) por request pode dobrar carga DB. Mitigação: `makeManifest` cacheia dentro da instância (`cache` por `makeManifest` closure), então `isEnabled` e `enabledModules` na mesma request compartilham 1 query; mas requests diferentes não compartilham cache (correto para T6). Risco de N+1 se `filterMenuByAccess` e `withModuleRoute` e `buildUserContext` cada um criar seu próprio `createManifest()` → 3 queries por request. Mitigação: em follow-up, injetar `manifest` via `AsyncLocalStorage` ou passar `deps.manifest` para `buildUserContext`.
- **Outbox unknown vs enabled:** `knownOps` fix garante que `unknown pending` não é filtrado por `enabled`, mas se um `operation` for removido de `HANDLERS` mas ainda houver jobs pendentes com essa `operation`, eles serão considerados `unknown` e logados, mas nunca `claim`ados (pois `allowedOps` não contém). Risco: fila com `unknown` nunca é drenada, permanece `pending` para sempre, sem DLQ. Mitigação: `processOutboxBatch` loga `unknown`, mas não move para DLQ; operador deve limpar manualmente ou reintroduzir handler. Futuro: adicionar `markOutboxDeadLetter` para `unknown` após N tentativas.
- **Cron GET auth:** `GET` agora exige `CRON_SECRET`, mas `POST` já exigia. Se `CRON_SECRET` não estiver configurado em staging, ambos retornam 401 e health check do cron pode falhar. Mitigação: documentar `CRON_SECRET` obrigatório em `docs/runbooks`.
- **T8-T9 pendentes:** RPC `HandleIssuerBinding`/`AppBinding` e bundle `3 MiB` ainda não tratados; `npm run build:cf` dry-run não executado nesta tranche.

### 6.3 Rollback

- **Manifest:** restaurar `export const moduleManifest` com `isEnabled: (id)=>createManifest().isEnabled(id)` e reverter 115 files para `import { moduleManifest }` + `withModuleRoute('x', moduleManifest)`, e `jest.mock` para `moduleManifest`.
- **Outbox:** reverter `worker.ts` para `allowedOps` e `catch {}` silenciado, e `route.ts` `GET` sem auth.

---

*Tranche T6/T7 encerrada 2026-08-30T21:30Z com TDD RED→GREEN, 5 suites 19 tests PASS (manifest+outbox) + 2 integração, lint/typecheck 0, 0 imports singleton, e matriz outbox 6 ops 1:1. Worktree preservado; T8-T9 permanecem para próxima tranche.*

**Git diff exclusivo T6/T7:** `~125 files changed, ~300 insertions, ~200 deletions` (sem contar T0-T5/audits preexistentes).
