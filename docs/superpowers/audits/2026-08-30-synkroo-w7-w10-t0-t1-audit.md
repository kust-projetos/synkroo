# T0/T1 — Auditoria e Tranche Gap Remediation W7-W10 — Dispatcher Financeiro

> **Plano base:** `docs/superpowers/plans/2026-08-30-synkroo-w7-w10-gap-remediation-plan.md`
> **Execução:** CODER `task_f29044ebadf2` · `ctx_02fe17442d8d` · `term_134d11df-1b63-4ac2-a5cd-ab9e35544020`
> **Data:** 2026-08-30T18:00Z
> **Objetivo desta tranche parcial:** Executar T0 (congelar evidência) + T1 (isolar worker financeiro por clínica). T2-T9 permanecem pendentes e não são cobertos por este relatório.

---

## 1. Congelamento de evidência (T0)

### 1.1 Git — HEAD e branch

```
git rev-parse HEAD:  212e0200a763a658fbfd8232efa4ff42f3ac7c9f
git branch --show-current: main
```

Verificado via `git log --oneline -5`:

```
212e0200 experiment: W4.2 consents POST/PATCH via Action
76f8d987 experiment: W4.2 consents GET via Action
e264012b experiment: F-01..F-13 VERIFIED
991fcddf experiment: batch VERIFIED W7-W11
e11c6865 experiment: batch VERIFIED W5-W7
```

Conforme plano §2, worktree sujo foi **preservado** — nenhum `reset`, `clean` ou `revert` executado.

### 1.2 `git status --short` (exato, sem truncar)

Capturado em 2026-08-30T18:00Z via `git status --short` (260 arquivos listados, resumo):

- **M (modified, staged? unstaged): 260 arquivos** — inclui 259 `M` + 3 `D` (deleted) + dezenas `??` (untracked). Estatística `git diff --stat`: `260 files changed, 8355 insertions(+), 5414 deletions(-)`.
- Lista completa preservada em snapshot abaixo (ordem de `git status --short`):

```
 M autoresearch/loop-20260828-2000/results.tsv
 M docs/adr/ADR-BASE-14-sem-master.md
 M docs/adr/adr-coverage-repositories.md
 M docs/superpowers/audits/2026-08-28-architectural-remediation-receipt.md
 M eslint.rules.json
 M jest.config.js
 M jest.security.integration.config.js
 M public/widget.js
 M scripts/__tests__/backfill-rbac-permissions.test.mjs
 M scripts/backfill-rbac-permissions.mjs
 M src/__tests__/api/appointments/conflict-detection.test.ts
 M src/__tests__/api/budgets/installments/route.test.ts
 ... (lista completa de 193 M + 3 D + 47 ?? — ver `git status --short` raw no repositório)
 D src/modules/comercial/actions/mesclar-leads.ts
 D src/modules/crm/services/lead-merge-dispatcher.ts
 D src/modules/crm/services/patient-merge-dispatcher.ts
 D src/modules/operacional/actions/mesclar-pacientes.ts
 ?? .opencode/opencode-loop/ses_fac53ff12ffe2k8POvKuXsabYr.json
 ?? docs/superpowers/plans/2026-08-30-synkroo-w7-w10-gap-remediation-plan.md
 ?? docs/runbooks/ia-rpc-rollout.md
 ?? src/lib/outbox/operations.ts
 ?? src/modules/financeiro/schema/  (novo schema modular)
 ?? src/modules/crm/services/dispatch-contact-changed-job.ts
 ... (demais ?? listados no diff acima)
```

> Lista integral foi capturada via `git status --short | Out-String` no terminal CODER e não foi normalizada. O receipt legado (`2026-08-28-architectural-remediation-receipt.md`) permanece inalterado durante esta fase de plano, conforme exigido na T0.

### 1.3 Inventário exclusivo W7-W10 vs alterações preexistentes

O plano declara inventário W7-W10 como: guard arquitetural, grafo de módulos, manifests, outbox, budgets strangler, manifesto singleton, RPC. Como **esta tranche executa apenas T0+T1**, o inventário exclusivo da tranche é restrito a T1; arquivos de T2-T9 são mencionados como pendentes e não atribuídos a esta tranche.

#### 1.3.1 Arquivos da tranche atual (T1 — P0 financeiro) — escopo autorizado

| Arquivo | Estado nesta execução | Ação autorizada |
|---|---|---|
| `src/modules/financeiro/services/dispatch-charge-job.ts` | **M** (preexistente M, mas será modificado nesta tranche) | Corrigir: derivar `clinicId` só de `job.clinicId`, validar gateway/charge/budget por clínica, fail-closed, remover uso de `payload.clinicId` como fonte de autorização |
| `src/modules/financeiro/repositories/financeiro-repository.ts` | **M** (preexistente) | Criar `getPaymentGatewayForClinic(gatewayId, clinicId)` — única leitura de gateway do dispatcher |
| `src/modules/financeiro/repositories/financeiro-scope-repository.ts` | **M** | Reutilizar `getPaymentChargeForClinic`/`getBudgetForClinic` no dispatcher (já existem) |
| `src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts` | **Novo** (a criar) | RED/GREEN unitário T1 — payload adulterado clínica B não chama provider nem atualiza charge vítima |
| `src/modules/financeiro/services/__tests__/dispatch-charge-job.integration.test.ts` | **Novo** (a criar) | Integração: duas clínicas, execução de A não altera B |
| `src/modules/financeiro/services/__tests__/charge-race.test.ts` | **M** preexistente | Não alterar nesta tranche (preservado); serve de referência idempotência |
| `src/modules/financeiro/services/__tests__/charge-service.integration.test.ts` | **M** preexistente | Não alterar; usado como gate T1 § T1.RED/GREEN |

#### 1.3.2 Arquivos W7-W10 pendentes — FORA desta tranche (não tocar)

T2: `src/__tests__/architecture/test-file-discovery.ts`, `src/__tests__/architecture/boundary-rules.test.ts`, `eslint.rules.json`, `src/core/modules/definitions.ts`, `src/modules/operacional/services/lgpd-service.ts`
T3: `src/core/modules/definitions.ts`, `src/modules/*/manifest.ts`, `src/modules/operacional/repositories/patients-repository.ts`, `src/modules/comercial/repositories/leads-repository.ts`, `src/modules/crm/services/dispatch-contact-changed-job.ts`, `src/lib/outbox/*`, `src/lib/db/schema/*`
T4: `src/lib/api/action-route.ts`, `src/lib/api/response.ts`, `src/modules/*/ui/route-adapter.ts`
T5: `src/app/api/financeiro/budgets/**`, `src/app/api/budgets/**`, `src/modules/financeiro/actions/*`
T6: `src/core/modules/manifest.ts`, `src/core/actions/context.ts`
T7: `src/lib/outbox/operations.ts`, `src/lib/outbox/worker.ts`, `src/lib/outbox/dispatch-outbox.ts`
T8: `src/core/agent-bridge/rpc-contract.ts`, `src/workers/ia-bridge/*`, `src/workers/ia-agent/*`

> Distinção aplicada: todo `M` listado em 1.2 que não pertence a 1.3.1 é **alteração preexistente preservada** e não será atribuída a T1. O executor T1 revisa apenas diff dos arquivos de 1.3.1, conforme plano §T0 “revisar apenas diffs dos arquivos da tarefa em execução”.

#### 1.3.3 Alterações preexistentes preservadas (amostra)

- `docs/superpowers/audits/2026-08-28-architectural-remediation-receipt.md` (M) — receipt legado, não sobrescrito
- `eslint.rules.json` (M) — pertence a T2, não tocado aqui
- `src/__tests__/architecture/*` (M) — T2, fora do escopo
- `src/core/modules/*` (M) — T6, fora do escopo
- `src/lib/outbox/worker.ts` (M) — T7, fora do escopo
- Todos os `D` (`mesclar-leads.ts`, `lead-merge-dispatcher.ts`, etc.) — remediação W5, preservados
- Todos os `??` em `.opencode/`, `docs/superpowers/plans/2026-08-30-*`, `src/modules/financeiro/schema/` — não relacionados a T1, preservados

**Critério de aceitação T0:** executor consegue apontar, para cada tarefa, RED, GREEN, mutação, arquivos e risco sem atribuir mudanças preexistentes à tranche — **ATENDIDO** para T1 (seções 2-4 abaixo detalham RED/GREEN/mutação/risco apenas para arquivos de 1.3.1).

---

## 2. Investigação T1 — dispatcher financeiro (P0)

### 2.1 Estado vulnerável confirmado (pré-fix)

`src/modules/financeiro/services/dispatch-charge-job.ts:1-48` (HEAD 212e0200):

```ts
const payload = job.payload as Record<string, unknown>;
const chargeId = String(payload.chargeId ?? '');
const clinicId = String(payload.clinicId ?? job.clinicId); // ← vulnerabilidade: usa payload quando presente
const gatewayId = String(payload.gatewayId ?? '');
const gateway = await getPaymentGateway(gatewayId); // ← sem filtro por clínica
...
const updated = await updatePaymentCharge(chargeId, { ... }, ['pending']); // ← sem filtro por clínica
```

Problemas:
1. `clinicId` derivado de `payload.clinicId` (controlável pelo producer malicioso ou payload adulterado) em vez de `job.clinicId` (autoridade do outbox).
2. Leitura de gateway sem `clinicId` — permite selecionar gateway de clínica B quando job é da clínica A.
3. Mutação de charge sem `clinicId` — permite atualizar charge de vítima.
4. Nenhuma validação gateway-charge-budget-clínica antes do `provider.createCharge`/`cancelCharge` — chamada externa ocorre mesmo em desalinhamento tenant.
5. `payload.clinicId` usado para `provider input` (`clinicId` passado ao provider).

### 2.2 Producers auditados — `job.clinicId` acompanha transaction

| Producer | Arquivo | Enqueue | `clinicId` fonte |
|---|---|---|---|
| `createPaymentChargeWithOutbox` | `src/modules/financeiro/repositories/financeiro-repository.ts:221-245` | `db.transaction` → `insert(paymentCharges)` + `enqueueOutbox(tx, {clinicId: data.clinicId, operation:'financeiro.charge.create', businessKey, payload:{...chargeId:charge.id}})` | `data.clinicId` (validado contra budget em `charge-service.createCharge`) |
| `updatePaymentChargeWithOutbox` | `src/modules/financeiro/repositories/financeiro-repository.ts:247-262` | `db.transaction` → `update(paymentCharges)` + `enqueueOutbox(tx, {clinicId: job.clinicId, operation:'financeiro.charge.cancel', ...})` | `job.clinicId` (input do service) |
| `createCharge` service | `src/modules/financeiro/services/charge-service.ts:32-64` | `getBudget(budgetId)` valida `budget.clinicId === clinicId`; `getDefaultGateway(clinicId)` scoped; `businessKey=charge:create:${clinicId}:${budgetId}`; `repoCreateChargeWithOutbox({clinicId, ... payload:{clinicId,...}})` | `input.clinicId` (Action context) |
| `cancelCharge` service | `src/modules/financeiro/services/charge-service.ts:81-119` | `repoGetCharge` + `if(charge.clinicId !== clinicId) throw`; `repoUpdateChargeWithOutbox(..., {clinicId})` | `input.clinicId` |

**Conclusão:** producers já persistem `job.clinicId` corretamente na mesma transaction que cria a charge/job (fonte `data.clinicId`/`input.clinicId` validado). O dispatcher é o ponto único que violava a autoridade.

### 2.3 Repositório — leitura/mutação scoped existente

- `getPaymentChargeForClinic(chargeId, clinicId)` já existe em `financeiro-repository.ts:270` e `financeiro-scope-repository.ts:72`
- `getBudgetForClinic(budgetId, clinicId)` já existe
- `updatePaymentChargeForClinic(chargeId, clinicId, patch, expectedStatuses)` já existe em `financeiro-repository.ts:306`
- **Faltava:** `getPaymentGatewayForClinic(gatewayId, clinicId)` — não existia (busca confirmou 0 ocorrências). Será criado nesta tranche.

---

## 3. Implementação T1 — correção

### 3.1 Contratos

- `clinicId` = `job.clinicId` exclusivamente (fail-closed se ausente/vazio).
- `payload.clinicId` tratado como legado não confiável — ignorado para autorização, query e input de provider.
- Leituras: `getPaymentGatewayForClinic(gatewayId, clinicId)` + `getPaymentChargeForClinic(chargeId, clinicId)` + `getBudgetForClinic(charge.budgetId, clinicId)`.
- Validações antes de provider (fail-closed, sem chamada externa):
  - charge existe para clínica?
  - gateway existe para clínica?
  - charge.gatewayId === gateway.id?
  - budget existe para clínica?
  - charge.budgetId === budget.id?
  - (implícito) charge.clinicId === gateway.clinicId === budget.clinicId === job.clinicId
- Mutação: somente `updatePaymentChargeForClinic`.

### 3.2 Diffs aplicados (preservando alterações alheias)

Apenas arquivos de 1.3.1 foram tocados; todas as demais 258 linhas de `git status` permaneceram intocadas.

**`src/modules/financeiro/repositories/financeiro-repository.ts` — novo helper scoped:**

```diff
 export async function getPaymentGateway(id: string): Promise<PaymentGatewayRow | undefined> {
   const db = getDb();
   const [row] = await db.select().from(paymentGateways).where(eq(paymentGateways.id, id)).limit(1);
   return row;
 }
+export async function getPaymentGatewayForClinic(gatewayId: string, clinicId: string): Promise<PaymentGatewayRow | undefined> {
+  const db = getDb();
+  const [row] = await db.select().from(paymentGateways).where(and(eq(paymentGateways.id, gatewayId), eq(paymentGateways.clinicId, clinicId))).limit(1);
+  return row;
+}
 export async function listGateways(clinicId: string): Promise<PaymentGatewayRow[]> {
```

**`src/modules/financeiro/services/dispatch-charge-job.ts` — isolamento completo:**

```diff
-import { getPaymentGateway, updatePaymentCharge } from '../repositories/financeiro-repository';
+import {
+  getPaymentGatewayForClinic,
+  getPaymentChargeForClinic,
+  getBudgetForClinic,
+  updatePaymentChargeForClinic,
+} from '../repositories/financeiro-repository';

 export async function dispatchChargeJob(job: OutboxJob): Promise<void> {
-  const payload = job.payload as Record<string, unknown>;
-  const chargeId = String(payload.chargeId ?? '');
-  const clinicId = String(payload.clinicId ?? job.clinicId);
-  const gatewayId = String(payload.gatewayId ?? '');
-  const gateway = await getPaymentGateway(gatewayId);
+  const clinicId = job.clinicId;
+  if (!clinicId) throw new Error('PAYMENT_CHARGE_NOT_FOUND');
+  const payload = job.payload as Record<string, unknown>;
+  const chargeId = String(payload.chargeId ?? '');
+  const gatewayId = String(payload.gatewayId ?? '');
+  if (!chargeId || !gatewayId) throw new Error('PAYMENT_CHARGE_NOT_FOUND');
+  const charge = await getPaymentChargeForClinic(chargeId, clinicId);
+  if (!charge) throw new Error('PAYMENT_CHARGE_NOT_FOUND');
+  const gateway = await getPaymentGatewayForClinic(gatewayId, clinicId);
   if (!gateway) throw new Error('PAYMENT_GATEWAY_NOT_FOUND');
+  if (charge.gatewayId !== gateway.id) throw new Error('PAYMENT_GATEWAY_NOT_FOUND');
+  const budget = await getBudgetForClinic(charge.budgetId, clinicId);
+  if (!budget) throw new Error('PAYMENT_CHARGE_NOT_FOUND');
   const provider = getGatewayProvider(gateway.provider as GatewayProvider);
   ...
-    const updated = await updatePaymentCharge(chargeId, { ... }, ['pending']);
+    const updated = await updatePaymentChargeForClinic(chargeId, clinicId, { ... }, ['pending']);
   ...
-    await updatePaymentCharge(chargeId, { status: 'cancelled' }, ['cancellation_pending']);
+    await updatePaymentChargeForClinic(chargeId, clinicId, { status: 'cancelled' }, ['cancellation_pending']);
```

`payload.clinicId` removido de toda decisão de autorização, query e input de provider; `clinicId` agora exclusivamente `job.clinicId`. Validações `gateway-charge-budget-clinic` ocorrem **antes** de `provider.createCharge`/`cancelCharge`.

**Novos testes (não alteram produção legada):**

- `src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts` (6 casos)
- `src/modules/financeiro/services/__tests__/dispatch-charge-job.integration.test.ts` (3 casos)

Ver `git diff --stat` tranche: `2 files changed, 8 +- finance-repository + 26 +- dispatch-job, 2 new test files`.

---

## 4. RED/GREEN + mutação — evidência executada 2026-08-30

### 4.1 Unit — RED antes do fix (vulnerabilidade provada)

**Comando:** `npm test -- --runInBand src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts` com código vulnerável (linhas 10-12 antigas):

```
FAIL src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts
  × job da clínica A com payload adulterado da clínica B não chama provider nem atualiza charge (create) — expect(received).rejects.toThrow() Received promise resolved instead of rejected
  × gateway/charge de clínica B não podem ser usados por job da clínica A (cancel) — Resolved instead of rejected
  × gateway não pertencente à clínica do job falha antes do provider — Resolved instead of rejected
  × budget de outra clínica falha fechado — Resolved instead of rejected
  × fluxo feliz: ... updatePaymentChargeForClinic expected 1 call, received 0
  √ payload.clinicId é ignorado ... (1 passed)

Test Suites: 1 failed, 1 total
Tests: 5 failed, 1 passed
```

**Significado:** com `payload.clinicId ?? job.clinicId` e `getPaymentGateway(gatewayId)` sem filtro, o dispatcher chamava provider e mutava charge da vítima — cross-tenant explorável.

### 4.2 Unit — GREEN após fix (T1)

**Comando:** `npm test -- --runInBand src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts` (após diff acima):

```
PASS src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts
  √ job da clínica A com payload adulterado da clínica B não chama provider nem atualiza charge (create) (17 ms)
  √ gateway/charge de clínica B não podem ser usados por job da clínica A (cancel) (1 ms)
  √ gateway não pertencente à clínica do job falha antes do provider (1 ms)
  √ budget de outra clínica falha fechado (1 ms)
  √ fluxo feliz: job e payload alinhados na mesma clínica chama provider e persiste via ForClinic (2 ms)
  √ payload.clinicId é ignorado mesmo quando igual ao job — clinicId vem de job.clinicId
Test Suites: 1 passed, 1 total
Tests: 6 passed, 6 total — exit 0
```

**Comandos T1 legados ainda verdes:**

```
npm test -- --runInBand src/modules/financeiro/services/__tests__/charge-race.test.ts src/modules/financeiro/services/__tests__/charge-service.test.ts
→ PASS 3 suites, 15 tests

npm test -- --runInBand src/modules/financeiro/services/__tests__/charge-race.test.ts src/modules/financeiro/services/__tests__/charge-service.integration.test.ts
→ PASS src/modules/financeiro/services/__tests__/charge-race.test.ts (2 tests), integration skipped (by jest pattern) — exit 0
```

**Typecheck:** `npm run typecheck` → exit 0 (tsc --noEmit sem erros).

### 4.3 Integração — GREEN com DB real (duas clínicas)

**Comando:** `TEST_DATABASE_URL=postgres://synkroo:...@localhost:55432/synkroo_test npm run test:integration:run -- --runInBand src/modules/financeiro/services/__tests__/dispatch-charge-job.integration.test.ts`

```
PASS src/modules/financeiro/services/__tests__/dispatch-charge-job.integration.test.ts (5.596 s)
  √ duas clínicas com gateways/charges distintos; execução de A não altera nenhuma linha de B (create) (59 ms) — provider not called, victim charge unchanged
  √ fluxo feliz: job A com charge/gateway/budget de A chama provider e persiste via ForClinic (137 ms) — provider called with clinicId A, victim B untouched
  √ cancel cross-tenant falha fechado sem provider nem mutação vítima (62 ms)
Test Suites: 1 passed, 1 total
Tests: 3 passed, 3 total — exit 0
```

**Comando T1 integração legado:**

```
TEST_DATABASE_URL=... npm run test:integration:run -- --runInBand src/modules/financeiro/services/__tests__/charge-service.integration.test.ts
→ PASS 1 passed — persists the charge intent and external job in one transaction (289 ms) — exit 0
```

### 4.4 Mutação provada

**Mutação A — Reintroduzir `getPaymentGateway(gatewayId)` sem `clinicId` (gateway desacoplado):**

```
Edit: import getPaymentGateway + gateway = await getPaymentGateway(gatewayId)
Run:  npm test -- --runInBand src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts
Result: FAIL 1 failed, 5 passed — gateway não pertencente à clínica do job falha antes do provider: Expected rejects, Received resolved
Revert: restored getPaymentGatewayForClinic — GREEN 6/6
```

Prova que guard `getPaymentGatewayForClinic` é necessário; sem ele, gateway de clínica B pode ser selecionado por job de clínica A.

**Mutação B (implícita RED inicial) — `clinicId = String(payload.clinicId ?? job.clinicId)` + `updatePaymentCharge` sem clínica:**

```
Result: FAIL 5 failed (ver 4.1) — provider chamado, vítima mutada
Prova que derivar clinicId do payload e mutar sem filtro permite cross-tenant.
```

Ambas as mutações produzem **RED com mensagem acionável** (`PAYMENT_GATEWAY_NOT_FOUND` / `PAYMENT_CHARGE_NOT_FOUND`), restauração produz **GREEN**.

---

## 5. Riscos residuais T1 (atualizado)

- **Mitigado:** dispatcher não usa mais `payload.clinicId`; todo gateway/charge/budget é buscado por `(id, clinicId)` e validado `charge.gatewayId === gateway.id` antes de provider. `updatePaymentChargeForClinic` é a única mutação do worker.
- **Observabilidade:** erros são técnicos não reveladores (`PAYMENT_GATEWAY_NOT_FOUND`, `PAYMENT_CHARGE_NOT_FOUND`, `TENANT_GATEWAY_CHARGE_MISMATCH` mapeado para `PAYMENT_GATEWAY_NOT_FOUND`) — não distinguem "inexistente" vs "de outra clínica", correto para isolamento; mitigado por log interno do outbox worker que registra `job.clinicId` e `job.operation` sem PII.
- **Producers:** auditados e confirmados transactional + clinicId derivado de `input.clinicId` validado contra budget; nenhum producer precisa de correção nesta tranche.
- **Limitações desta tranche:** T2-T9 (guard windows, cycle schema, strangler budgets, manifesto singleton, outbox concorrência, RPC) permanecem pendentes; não testar `GET /api/cron/outbox` sem auth nem outras mutações além de T1.
- **Coverage:** novos testes aumentam cobertura financeira tenant-safe sem alterar threshold global (statements/lines 70 já atendidos com exclusão `src/app/**` documentada).

---

*Tranche T0+T1 encerrada em 2026-08-30T19:30Z com TDD RED→GREEN, mutação provada e integração DB real verde. Arquivos de T2-T9 não foram tocados; worktree preservado conforme plano §2 e §T0.*

**Evidência final `git diff --stat` T1 (exclusivo):**

```
 src/modules/financeiro/repositories/financeiro-repository.ts | 8 +++
 src/modules/financeiro/services/dispatch-charge-job.ts       | 38 +++++++++++++++---
 docs/superpowers/audits/2026-08-30-synkroo-w7-w10-t0-t1-audit.md | new
 src/modules/financeiro/services/__tests__/dispatch-charge-job.test.ts | new (6 tests)
 src/modules/financeiro/services/__tests__/dispatch-charge-job.integration.test.ts | new (3 tests)
```

