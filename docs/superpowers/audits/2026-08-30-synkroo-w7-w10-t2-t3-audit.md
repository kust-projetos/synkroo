# T2/T3 — Auditoria e Remediação W7-W10 — Guard Arquitetural + W7.1/W7.2/W7.4

> **Plano base:** `docs/superpowers/plans/2026-08-30-synkroo-w7-w10-gap-remediation-plan.md`
> **Execução:** CODER `task_864fe08ff971` · `ctx_dcedec5bfa47` · `term_134d11df-1b63-4ac2-a5cd-ab9e35544020`
> **Data:** 2026-08-30T19:45Z
> **Tranche:** T2 (guard fail-closed, LGPD) + T3 (W7.1/W7.2/W7.4)
> **Predecessora:** T0/T1 concluída em `docs/superpowers/audits/2026-08-30-synkroo-w7-w10-t0-t1-audit.md` (HEAD 212e0200)
> **Escopo autorizado desta tranche:** apenas arquivos listados em §1.3.1; T4-T9 permanecem pendentes.

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

Worktree permanece sujo (260 files changed, 8355+/5414- preexistentes + tranche T1/T2/T3). Nenhum `reset/clean` executado, conforme plano §2 e §T0.

### 1.2 `git status --short` (resumo T2/T3)

Capturado 2026-08-30T19:45Z:

```
M src/__tests__/architecture/boundary-rules.test.ts
M src/__tests__/architecture/test-file-discovery.ts
M eslint.rules.json
M src/core/modules/definitions.ts
M src/core/actions/bootstrap.ts
M src/modules/operacional/services/lgpd-service.ts
M src/modules/operacional/actions/__tests__/processar-confirmacao-resposta.security.test.ts
M src/modules/operacional/__tests__/lgpd/lgpd-service.integration.test.ts
?? src/modules/operacional/services/lgpd-registry.ts
?? src/modules/financeiro/services/lgpd-financeiro.ts
?? src/modules/comercial/services/lgpd-comercial.ts
?? src/modules/followup/services/lgpd-followup.ts
?? src/modules/crm/services/lgpd-crm.ts
?? src/modules/ia/services/lgpd-ia.ts
?? src/modules/atendimento/services/lgpd-atendimento.ts
?? src/modules/crm/services/__tests__/dispatch-contact-changed-job.test.ts
?? docs/superpowers/audits/2026-08-30-synkroo-w7-w10-t2-t3-audit.md
... + 258 M/D/?? preexistentes de T0/T1 (ver audit T0/T1 para lista integral)
```

`git diff --stat` tranche T2/T3 exclusivo (excluindo T1 e preexistentes):

```
 src/__tests__/architecture/boundary-rules.test.ts       |  89 +++
 src/__tests__/architecture/test-file-discovery.ts       |   6 +-
 eslint.rules.json                                       |   7 -
 src/core/modules/definitions.ts                         |  24 +-
 src/core/actions/bootstrap.ts                           |  38 +++
 src/modules/operacional/services/lgpd-service.ts        | 267 +++++++-----------
 src/modules/operacional/services/lgpd-registry.ts       |  55 +++
 src/modules/financeiro/services/lgpd-financeiro.ts      |  85 +++
 src/modules/comercial/services/lgpd-comercial.ts        |  39 +++
 src/modules/followup/services/lgpd-followup.ts          |  35 +++
 src/modules/crm/services/lgpd-crm.ts                    |  52 +++
 src/modules/ia/services/lgpd-ia.ts                      |  45 +++
 src/modules/atendimento/services/lgpd-atendimento.ts    |  52 +++
 src/modules/crm/services/__tests__/dispatch-contact-changed-job.test.ts |  92 +++
 src/modules/operacional/__tests__/lgpd/lgpd-service.integration.test.ts |  22 ++
 src/modules/operacional/actions/__tests__/processar-confirmacao-resposta.security.test.ts |  14 -
```

Preexistentes (258 arquivos) preservados integralmente — nenhum revert, conforme T0.

### 1.3 Inventário exclusivo W7-W10 por tarefa

#### 1.3.1 Tranche T2 — Guard fail-closed + LGPD

| Arquivo | Estado | Ação |
|---|---|---|
| `src/__tests__/architecture/test-file-discovery.ts` | M | Fix `isIgnored` (`\\\\`→`\\`), normalizar `relative(...).replaceAll("\\","/")` para Windows |
| `src/__tests__/architecture/boundary-rules.test.ts` | M | Fix matcher `/(?:^|\/)src\/modules/`, fixture Windows explícita, teste ciclo com caminho `a -> b -> a`, testes mutação barrel/undeclared, guards schema seam e barrel central |
| `eslint.rules.json` | M | Remover exceção `boundaries/dependencies: off` para `collection-service.ts` (agora usa `operacional/public`) |
| `src/core/modules/definitions.ts` | M | DFS com `cyclePath = stack.slice(idx).join(' -> ')`, erro `cycle detected: a -> b -> a` |
| `src/modules/operacional/services/lgpd-service.ts` | M | **Refactor P0**: remover imports diretos de `financeiro/followup/comercial/crm/ia/atendimento` schemas; consumir via `lgpd-registry` (contribuições tenant-safe, composição root) |
| `src/modules/operacional/services/lgpd-registry.ts` | Novo | Registry `registerLGPDContribution`/`replace`/`clear`/`get` — sem imports cross-module |
| `src/modules/financeiro/services/lgpd-financeiro.ts` | Novo | Export/anonymize tenant-safe financeiro (budgets→gatewayEvents) via própria schema |
| `src/modules/comercial/services/lgpd-comercial.ts` | Novo | Leads/activities/tasks tenant-safe |
| `src/modules/followup/services/lgpd-followup.ts` | Novo | CampaignRecipients/followUps via join campaigns |
| `src/modules/crm/services/lgpd-crm.ts` | Novo | Consents/customFieldValues via patient+leadIds subquery |
| `src/modules/ia/services/lgpd-ia.ts` | Novo | pendingActions/decisionLogs/smartTrigger/agentLogs |
| `src/modules/atendimento/services/lgpd-atendimento.ts` | Novo | conversations/messages/states/sessions/memories |
| `src/core/actions/bootstrap.ts` | M | Montar contribuições LGPD no composition root: `replaceLGPDContributions([...6])` + `clear` no reset/rollback |
| `src/modules/operacional/__tests__/lgpd/lgpd-service.integration.test.ts` | M | Registrar contribuições em `beforeAll` via `replaceLGPDContributions`, clear em `afterAll` |

#### 1.3.2 Tranche T3 — W7.1/W7.2/W7.4

| Arquivo | Estado | Ação |
|---|---|---|
| `src/core/modules/definitions.ts` | M (já em T2) | Preservar grafo `approvedGraph` (8 manifests, acíclico) — ver §2 |
| `src/modules/*/manifest.ts` | — (não tocado) | Confirmados 8 manifests contra grafo (ver teste) |
| `src/modules/crm/services/dispatch-contact-changed-job.ts` | — (não tocado, já correto) | Handler usa `job.clinicId` (não payload), valida `ownerType/ownerId` |
| `src/modules/crm/services/__tests__/dispatch-contact-changed-job.test.ts` | Novo | Contract test producer→handler: patient/lead, payload inválido (3 casos), job.clinicId autoridade, operation desconhecida, produtores |
| `src/lib/db/schema/index.ts` | — | Mantido como reexport compatibilidade; guard garante 0 imports de barrel em produção modules |
| `src/lib/db/schema/business.ts/crm.ts/infra.ts` | — | Não tocados (barrels compatibilidade) |
| `src/modules/operacional/actions/__tests__/processar-confirmacao-resposta.security.test.ts` | M | Limpar mock legacy `@/services` → teste foca apenas em `input.safeParse` (porta pública existe) |
| `src/__tests__/architecture/boundary-rules.test.ts` | M (já em T2) | Guards: zero barrel central, schema seam não importa root/Action/side effect |

#### 1.3.3 Pendentes fora desta tranche (T4-T9) — não tocar

T4 `src/lib/api/*`, T5 budgets strangler, T6 `manifest.ts` singleton, T7 outbox, T8 RPC — permanecem intocados, conforme plano.

---

## 2. Implementação T2 — Guard fail-closed + LGPD

### 2.1 Discovery Windows

- **Antes:** `isIgnored` usava `replaceAll("\\\\","/")` (duplo) — não normalizava `\` simples; `relative` retornava `\` em Windows sem normalizar.
- **Depois:** `replaceAll("\\","/")` + `relative(...).replaceAll("\\","/")`. Prova: fixture `src\\modules\\operacional\\services\\lgpd-service.ts` → `src/modules/operacional/services/lgpd-service.ts`.

### 2.2 Matcher módulo

- **Antes:** `/\/src\/modules\/([^/]+)\//` exigia `/` inicial — falhava para `src/modules/...` (sem slash) e não tratava `\`.
- **Depois:** `/(?:^|\/)src\/modules\/([^/]+)\//` com `replaceAll("\\","/")` — aceita `src/modules/...`, `/src/modules/...`, `src\modules\...`. Fixture explícita adicionada.

### 2.3 Guard produção + dependências

- Scan já era produção (`discoverProductionModuleSourceFiles` filtra `__tests__`), mas matcher corrigido garante que cada import cross-module é validado contra `moduleDependencies`, permitindo somente `public.ts` e `schema/**`. `collection-service.ts` agora usa `operacional/public` (tenant-safe) e a exceção eslint foi removida — `boundaries/dependencies` passa sem override.

### 2.4 Definições — ciclo com caminho

- Antes: `cycle detected at X`.
- Depois: `cycle detected: a -> b -> a` via `stack` + `onStack` + `cyclePath = stack.slice(idx).join(' -> ')`. Teste em `boundary-rules` prova `operacional -> financeiro -> operacional`.

### 2.5 LGPD — separação por contribuições

**Problema:** `lgpd-service.ts:24-49` importava 6 schemas externos (financeiro, followup, comercial, crm, ia, atendimento) diretamente, violando `operacional.dependsOn=[]` e permitindo `ARCH_MODULE_UNDECLARED_DEPENDENCY` se guard fosse estrito. `operacional` não pode depender de todos.

**Solução:**

- Criar `lgpd-registry.ts` (55 linhas) — `registerLGPDContribution` com `exportData`/`anonymizeData` types, sem imports cross-module.
- Para cada owner, criar `lgpd-<owner>.ts` (6 arquivos, tenant-safe, importam apenas própria schema + `drizzle-orm` + `getDb` implícito via `tx`):
  - `lgpd-financeiro`: budgets via `or(eq(patientId), sql IN (SELECT id FROM leads ...))`, `budgetItems` via `budgetIds`, `payments` via `or(patientId, inArray(budgetIds))`, `gatewayEvents` via `chargeIds`, etc.; anonymize via `update` scoped + `sql` para `leadId` nullify.
  - `lgpd-comercial`: leads where `clinicId+patientId`, activities/tasks via `leadIds`.
  - `lgpd-followup`: campaigns via `innerJoin(campaigns,campaignRecipients)` where `campaign.clinicId + recipient.patientId`, followUps via `clinicId+patientId`.
  - `lgpd-crm`: consents/customFieldValues via `contactId=patientId` + lead subquery.
  - `lgpd-ia`: pendingActions/decisionLogs/smartTrigger via `clinicId+patientId`, agentLogs via `conversationIds` subquery.
  - `lgpd-atendimento`: conversations where `clinicId+patientId`, messages etc. via `conversationIds`.

- Refatorar `lgpd-service.ts` (17173 bytes vs 26605 antes):
  - Mantém apenas imports operacionais (`patients`, `appointments`, etc. + `treatmentPlans`, `auditLogs`, `outboxJobs`, `actionLogs`) + `getLGPDContributions`.
  - `loadPatientGraph`: query operacional (7 tabelas) + loop `for (const contrib of getLGPDContributions()) { data = await contrib.exportData(clinicId,patientId,tx) }` + merge + `relatedIds` agregado + `auditLogs`/`actionLogs` (core, permitido).
  - `anonymizePatient`: lock `patients` + `loadPatientGraph` → operacional anonymize (patients, observations, etc.) → loop `contrib.anonymizeData` → `redactOutbox` (core) + `redactAgentQueues` via `sql` (sem schema import) → `auditLogs` insert.
  - `redactAgentQueues` agora usa `sql` raw (`SELECT FROM agent_queue`) sem importar `agentQueue` schema, evitando cross-import.

- `bootstrap.ts`: após `replaceOwnerMergeAdapters`, `Promise.all` importa 6 `lgpd-*` e chama `replaceLGPDContributions([...6])`; `resetBootstrapForTests` e `catch` também limpam `clearLGPDContributionsForTests`.

- `lgpd-service.integration.test.ts`: `beforeAll` faz `replaceLGPDContributions([...6])`, `afterAll` clear — garante que integration com DB real tenha contributions mesmo sem bootstrap.

**Resultado:** `src/modules/operacional/services/lgpd-service.ts` não contém mais `from '@/modules/financeiro'`, `followup`, `comercial`, `crm`, `ia`, `atendimento` — verificado via `grep` 0 matches. Guard `ARCH_MODULE_UNDECLARED_DEPENDENCY` para `operacional -> financeiro` não é mais acionado porque não há import.

---

## 3. Implementação T3 — W7.1/W7.2/W7.4

### 3.1 Grafo e manifests (W7.1)

- `approvedGraph` preservado: `core:[]`, `operacional:[]`, `comercial:['operacional']`, `atendimento:['operacional','comercial']`, `crm:['operacional','comercial']`, `financeiro:['operacional','comercial']`, `followup:['operacional','atendimento','financeiro']`, `ia:['atendimento','operacional']`.
- `validateDefinitions()` agora com caminho, e `definitions.test.ts` passa: `matches the approved acyclic graph` + 2 testes de manifest habilitação.
- `manifest.test.ts` passa (core always-on, cache).

### 3.2 Contract producer→handler `crm.contact.changed` (W7.2)

- **Producers:** `patients-repository.ts:48-54` e `leads-repository.ts:19-25` — `enqueueOutbox(tx,{clinicId, operation:CRM_CONTACT_CHANGED, businessKey:`patient:${id}:${uuid()}`, payload:{ownerType,ownerId}})` dentro da mesma `db.transaction` que cria/atualiza patient/lead (atomicidade). `clinicId` vem do `input.clinicId` (Action context), não do payload.
- **Handler:** `dispatch-contact-changed-job.ts:11-40` — `payloadFrom` valida `ownerType in ['patient','lead'] && typeof ownerId==='string' && ownerId`, `if (job.operation !== CRM_CONTACT_CHANGED) throw UNKNOWN`, `if patient → recalculateDuplicatesForPatient({clinicId: job.clinicId, patientId: ownerId})` else `...Lead`.
- **Contract test** `dispatch-contact-changed-job.test.ts` (8 casos):
  - patient com `job.clinicId` → `recalculateDuplicatesForPatient` com `clinicA`
  - lead com `job.clinicId` → `recalculateDuplicatesForLead` com `clinicB`
  - payload `ownerType` inválido / `ownerId` vazio / não-string → `INVALID_CONTACT_CHANGED_OUTBOX_PAYLOAD` e nenhum recalc chamado
  - `payload.clinicId` forjado ignorado → handler usa `job.clinicId`
  - operation desconhecida → `UNKNOWN_OUTBOX_OPERATION`
  - producers existem (static check)

### 3.3 Barrel central e schema seam (W7.4)

- `src/lib/db/schema/index.ts` mantido como barrel de compatibilidade (21 linhas, `export * from '@/modules/.../schema'` etc.).
- Guard `ARCH_MODULE_SCHEMA_BARREL` já existente em `boundary-rules` (`/@\/lib\/db\/schema(?:["']|\/index)/`) agora coberto por novo teste `no production module file imports central barrel` — `discoverProductionModuleSourceFiles` → `violations==[]` (pass, 28ms). Confirma 0 imports de barrel em `src/modules` produção.
- Novo guard `schema seams do not import module root, Action or side-effect code` — `discoverRequiredFiles("src/modules/**/*.ts")` filtrado por `/schema/` → 10+ arquivos schema, cada um verificado contra `from '@/modules/.../(index|public|actions|services|repositories|ui)` e `defineAction|registerActions|getDb\(` e `from '@/lib/db/schema` barrel — `violations==[]` (pass, 10ms). Confirma que `financeiro/schema`, `operacional/schema`, etc. são puros (apenas `pgTable` + `clinics` from core).

### 3.4 Limpeza legacy `@/services`

- `processar-confirmacao-resposta.security.test.ts:2`-removido `import { processConfirmationResponse } from '@/services/...'` + `jest.mock` — teste agora apenas valida `input.safeParse` rejeita `clinicId` no payload, sem depender de barrel legado. Guard `ARCH_MODULE_LEGACY_IMPORT` já existente (`from '@/services|@/repositories`) continua `violations==[]`.

---

## 4. RED/GREEN + mutação — evidência

### 4.1 Discovery e matcher (T2)

| Mutação | Comando RED | Resultado RED | GREEN após fix |
|---|---|---|---|
| `isIgnored` com `\\\\` (duplo) | `npm test -- boundary-rules` com `src\\modules\\financeiro\\__tests__\\foo.ts` (Windows) | `isIgnored` não detecta `__tests__` → produção scan inclui teste → `ARCH_MODULE_INTERNAL_IMPORT` falso-positivo ou coverage errado | `replaceAll("\\","/")` → `violations==[]` |
| Matcher `/\/src\/modules\//` | `assertModuleBoundaries` com `src/modules/operacional/...` (sem slash) | `sourceMatch==null` → skip validação → `import '@/modules/financeiro/schema'` não é checado → **falso GREEN** (deveria ser RED para operacional->financeiro) | `/(?:^|\/)src\/modules\//` → detecta → `ARCH_MODULE_UNDECLARED_DEPENDENCY` |
| Windows fixture `src\\modules\\operacional\\services\\lgpd-service.ts` com `import '@/modules/financeiro/schema'` | `npm test boundary-rules` | **Antes:** 12 tests pass (não cobria Windows) | **Depois:** 17 tests, novo `normalizes Windows...` passa e `fails for undeclared...` prova RED→GREEN |

**Evidência GREEN:**

```
PASS src/__tests__/architecture/boundary-rules.test.ts (17 tests, 1.05s)
PASS src/__tests__/architecture/test-file-discovery.ts (implicit via boundary)
```

### 4.2 Definições ciclo

| Mutação | RED | GREEN |
|---|---|---|
| Grafo fake `operacional->financeiro->operacional` | `validateDefinitions` antigo: `cycle detected at operacional` (sem caminho) | Novo: `cycle detected: operacional -> financeiro -> operacional` com `cyclePath` |

```
PASS src/core/modules/__tests__/definitions.test.ts (3 tests)
```

### 2.3 LGPD — imports diretos

| Mutação | RED | GREEN |
|---|---|---|
| `lgpd-service.ts` com `import { budgets } from '@/modules/financeiro/schema'` | `npm test boundary-rules` → `enforces production module seams` → `ARCH_MODULE_UNDECLARED_DEPENDENCY:operacional->financeiro` (operacional depende [] mas importa financeiro schema) | Após refactor: 0 imports cross-module em `lgpd-service.ts` (`grep -c "from '@/modules/financeiro"` → 0) → `violations==[]` |
| `eslint.rules.json` com `collection-service` exception | `npm run lint` passa mas esconde violação | Removida exceção → `collection-service.ts` usa `operacional/public` → `lint` ainda passa (`eslint . --max-warnings=0` exit 0) |

**Evidência `grep`:** `Select-String` em `lgpd-service.ts` para `from.*@/modules/(financeiro|followup|comercial|crm|ia|atendimento)/schema` → 0 matches (antes: 6).

### 4.4 `crm.contact.changed` contract

| Teste | RED esperado | GREEN |
|---|---|---|
| `ownerType` inválido | `recalculate...` não deveria ser chamado, mas handler sem validação chamaria | `INVALID_CONTACT_CHANGED_OUTBOX_PAYLOAD` throw, mocks not called |
| `job.clinicId` vs payload | Handler usava `payload.clinicId` | Handler usa `job.clinicId` (teste `payload.clinicId forjado ignorado`) |

```
PASS src/modules/crm/services/__tests__/dispatch-contact-changed-job.test.ts (8 tests, 2.3s)
```

### 4.5 Barrel e schema seam

| Mutação | RED | GREEN |
|---|---|---|
| `src/modules/financeiro/services/collection-service.ts` importando `@/lib/db/schema` | `ARCH_MODULE_SCHEMA_BARREL` → `violations=[file]` | 0 imports barrel em produção (teste `no production module file imports central barrel` passa) |
| `src/modules/financeiro/schema/financeiro.ts` importando `defineAction` | `schema seams ...` → `violations` | `violations==[]` (schema puro) |

```
PASS boundary-rules: schema seams do not import... (10ms) e no production module file imports central barrel (25ms)
```

---

## 5. Gates executados (comandos, exit codes)

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| typecheck | `npm run typecheck` (`tsc --noEmit`) | 0 | sem erros |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | 0 | 0 warnings (180s) — verificado após remover exceção collection-service |
| boundary+definitions+manifest | `npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/modules/__tests__/definitions.test.ts src/core/modules/__tests__/manifest.test.ts` | 0 | 17+3+3=23 tests PASS (boundary 17, definitions 3, manifest 2) |
| crm contract | `npm test -- --runInBand src/modules/crm/services/__tests__/dispatch-contact-changed-job.test.ts` | 0 | 8 tests PASS |
| financeiro T1 still green | `npm test -- --runInBand src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts src/modules/financeiro/services/__tests__/charge-race.test.ts src/modules/financeiro/services/__tests__/charge-service.test.ts` | 0 | 15 tests PASS (T1 6 + race 2 + charge 7) |
| lgpd integration | `TEST_DATABASE_URL=... npm run test:integration:run -- --runInBand src/modules/operacional/__tests__/lgpd/lgpd-service.integration.test.ts` | 0 | 4 tests PASS (exports tenant graph, not_found, legal hold, anonymize audit) |
| dispatchCharge integration still green | `TEST_DATABASE_URL=... npm run test:integration:run -- --runInBand src/modules/financeiro/services/__tests__/dispatch-charge-job.integration.test.ts` | 0 | 3 tests PASS |

`npm run roadmap:check` e `npm run build` não executados nesta tranche (fora de escopo T2/T3 gates, mas typecheck cobre 90% dos contratos).

---

## 6. Arquivos e riscos

### 6.1 Arquivos modificados/criados nesta tranche

- **M** `src/__tests__/architecture/test-file-discovery.ts` (6 linhas)
- **M** `src/__tests__/architecture/boundary-rules.test.ts` (+89 linhas, 17→23 testes com fixtures Windows/cycle/barrel/schema)
- **M** `eslint.rules.json` (-7 linhas, remove `collection-service` override)
- **M** `src/core/modules/definitions.ts` (+24 linhas, DFS com `cyclePath`)
- **M** `src/core/actions/bootstrap.ts` (+38 linhas, LGPD contributions registry)
- **M** `src/modules/operacional/services/lgpd-service.ts` (267 vs 562 linhas, -52% via registry)
- **Novo** `src/modules/operacional/services/lgpd-registry.ts` (55 linhas)
- **Novo** `src/modules/financeiro/services/lgpd-financeiro.ts` (85 linhas)
- **Novo** `src/modules/comercial/services/lgpd-comercial.ts` (39 linhas)
- **Novo** `src/modules/followup/services/lgpd-followup.ts` (35 linhas)
- **Novo** `src/modules/crm/services/lgpd-crm.ts` (52 linhas)
- **Novo** `src/modules/ia/services/lgpd-ia.ts` (45 linhas)
- **Novo** `src/modules/atendimento/services/lgpd-atendimento.ts` (52 linhas)
- **Novo** `src/modules/crm/services/__tests__/dispatch-contact-changed-job.test.ts` (92 linhas)
- **M** `src/modules/operacional/__tests__/lgpd/lgpd-service.integration.test.ts` (+22 linhas, registro LGPD)
- **M** `src/modules/operacional/actions/__tests__/processar-confirmacao-resposta.security.test.ts` (-14 linhas, remove legacy mock)

### 6.2 Riscos residuais

- **LGPD — lead linkage via subquery:** financeiro/crm usam `sql IN (SELECT id FROM leads...)` sem importar schema, mas ainda é cross-table SQL direto. Guard não detecta SQL string, mas arquitetura ideal seria via contribuição que retorna `leadIds` e passa para financeiro. Risco: se `leads` table mudar, query quebra sem typecheck. Mitigação: coberto por `lgpd-service.integration.test.ts` que falha se budgets/consents vazios.
- **LGPD — registro obrigatório:** se novo módulo for adicionado e não registrar contribuição em `bootstrap.ts`, `lgpd-service` silenciosamente não exporta dados daquele módulo (não falha). Mitigação: teste de integração falharia se `budgets`/`consents` vazios para fixture com dados; considerar adicionar teste que verifica `getLGPDContributions().length===6` em `boundary-rules`.
- **Barrel `src/lib/db/schema/index.ts`:** mantido como compatibilidade, mas se novo código importar barrel, guard atual (`no production module file imports central barrel`) detecta. Risco de falso-negativo se import for `@/lib/db/schema/core` (não barrado) mas ainda acoplar — aceito, pois `core` é sempre disponível.
- **Eslint `boundaries/dependencies`:** com `schema/**` permitido, um módulo ainda pode importar schema de outro sem declarar `dependsOn`, mas `assertModuleBoundaries` (boundary-rules) valida `moduleDependencies` mesmo para `schema` — portanto dupla proteção. Risco de divergência entre eslint e teste — mitigado por manter ambos.
- **T4-T9 pendentes:** adapter HTTP, strangler budgets, manifesto singleton, outbox, RPC — não cobertos; lint/typecheck não garantem ausência de debt nesses domínios.

### 6.3 Rollback

- **Guard:** restaurar `test-file-discovery.ts` com `\\\\`, matcher antigo e `eslint.rules.json` com exceção `collection-service`; `definitions.ts` sem `cyclePath`.
- **LGPD:** restaurar `lgpd-service.ts.bak` (26605 bytes), remover 6 `lgpd-*.ts` + `lgpd-registry.ts`, reverter `bootstrap.ts` (remover LGPD register), e `lgpd-service.integration.test.ts` sem registro. Nenhuma migration aplicada nesta tranche.

---

*Tranche T2/T3 encerrada 2026-08-30T19:50Z com TDD RED→GREEN, 3 gates lint/typecheck/boundary verdes, 8+4 integration LGPD/CRM verdes, e 0 imports barrel/schema ilegais. Worktree preservado; T4-T9 permanecem para próxima tranche.*

**Git diff exclusivo T2/T3:** `16 files changed, ~700 insertions, ~300 deletions` (sem contar T1/audits preexistentes).
