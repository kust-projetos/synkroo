# Matriz de isolamento por tenant — recursos × rotas × casos negativos

Etapa 3 (hardening): suíte negativa cross-tenant em nível de rota + banco real.
Objetivo: provar que o tenant A nunca lê, altera ou apaga recurso do tenant B —
resposta opaca (404/403, nunca 200 com dados) e linha do banco inalterada.

## Como executar

```bash
# Runner canônico (migrate → seed → jest), mesmo do CI:
npm run test:integration:run -- src/__tests__/api/tenant-negative --verbose
```

## Gate regressivo no CI

- Workflow: `.github/workflows/ci.yml`, job **`ci`** (step `Integration tests`,
  `run: npm run test:integration:run` com `TEST_DATABASE_URL` do Postgres de serviço).
- O job `ci` é **bloqueante** (`needs: ci` no job `cf-build`; `needs: gitleaks` antes).
- `jest.integration.config.js` casa automaticamente todo `*.integration.test.ts`
  sob `src/` — todo arquivo novo desta suíte entra no gate sem config extra.

## Padrão dos testes

- Sessão Owner do tenant A mockada (`getUserProfile` + `drizzleRbacRepo` Owner +
  manifesto habilitado) — padrão de
  `src/__tests__/api/appointments/patient-reassignment/integration.test.ts`.
- Recurso criado no tenant B via SQL; tentativa do tenant A pela rota real.
- Toda asserção negativa verifica 3 coisas: **status opaco** + **corpo sem
  vazamento** (`expectNoLeak`) + **snapshot do banco inalterado**.
- Helper: `src/__tests__/api/tenant-negative/tenant-fixtures.ts`
  (par de clínicas `a201/b201`, `authAsOwner`, `expectNoLeak`).

## Cobertura nova — Etapa 3 (PROVADO, rota + DB real)

| Recurso | Rotas cobertas | Casos negativos | Status | Teste |
|---|---|---|---|---|
| patients | GET / PUT / PATCH /api/patients/[id] (+ DELETE 410 controle) | GET→404, PUT→404, PATCH→404, DELETE→410; todos sem vazamento e DB intacto | PROVADO (4) | `src/__tests__/api/tenant-negative/patients.integration.test.ts` |
| contacts (CRM) | GET /api/contacts/[id]?type= (+ PUT/PATCH 405 controle) | GET patient→404, GET lead→404, PUT→405, PATCH→405; DB intacto | PROVADO (4) | `src/__tests__/api/tenant-negative/contacts.integration.test.ts` |
| leads (comercial) | GET / PUT / DELETE /api/leads/[id] | GET→404, PUT→404, DELETE→404 (não arquiva, status intacto) | PROVADO (3) | `src/__tests__/api/tenant-negative/leads.integration.test.ts` |
| dentists | GET / PATCH /api/dentists/[id] (+ DELETE 405 controle) | GET→200 `data:null`, PATCH→200 `data:null`, DELETE→405; sem vazamento, DB intacto | PROVADO* (3) | `src/__tests__/api/tenant-negative/dentists.integration.test.ts` |
| procedures | GET / PATCH /api/procedures/[id] (+ DELETE 405 controle) | GET→200 `data:null`, PATCH→200 `data:null`, DELETE→405; sem vazamento, DB intacto | PROVADO* (3) | `src/__tests__/api/tenant-negative/procedures.integration.test.ts` |
| users (clinic members) | GET /api/patients/[id] como rota representativa do caminho `buildUserContext` | sem sessão→401, identidade malformada→401, membership removida→403; sem dados, DB intacto | PROVADO (3) | `src/__tests__/api/tenant-negative/membership-negative.integration.test.ts` |
| waitlist | GET?id / PATCH / DELETE?id /api/waitlist | GET→404, PATCH→404, DELETE→404 (não cancela, status `waiting` intacto) | PROVADO (3) | `src/__tests__/api/tenant-negative/waitlist.integration.test.ts` |
| appointments (GET/DELETE plain) | GET / PUT / DELETE /api/appointments/[id] | GET→404, PUT→404 (id próprio estrangeiro), DELETE→404 (não cancela, `scheduled` intacto) | PROVADO (3) | `src/__tests__/api/tenant-negative/appointments-plain.integration.test.ts` |

\* **Exceção documentada (dentists/procedures):** `obter/atualizar` retornam
`null` em vez de lançar `ActionError not_found`, de modo que o cross-tenant
responde **200 `{ data: null }`** em vez do 404 opaco canônico. Provado por
sonda que **nenhum byte do tenant B é exposto e nada é alterado** — não é um
vazamento, é um gap de contrato de status. Correção em produção (lançar
`not_found`) deliberadamente NÃO feita nesta etapa; ver BLOCKERS do relatório
Etapa 3. Os testes fixam o comportamento real para que qualquer regressão
(com vazamento ou mutação) quebre o gate.

## Cobertura pré-existente (sem duplicação nesta etapa)

| Recurso | Rotas / camada coberta | Casos | Teste |
|---|---|---|---|
| tasks | PUT / DELETE /api/tasks cross-tenant → 404, DB intacto (rota + DB real) | PUT forjado (body/header), DELETE forjado (query/header) | `src/__tests__/api/tasks/tasks-scope/integration.test.ts` |
| appointments (reassignment) | PUT /api/appointments/[id] com `patientId` de outra clínica → 404, DB intacto (rota + DB real) | P0 cross-clinic, controle mesma clínica, legado `patient_id` | `src/__tests__/api/appointments/patient-reassignment/integration.test.ts` |
| appointments (relacional, action) | `atualizarConsulta`: appointment estrangeiro → not_found; IDs relacionais cross-tenant validados | 3 its (W1.3) | `src/modules/operacional/actions/__tests__/appointment-relational-tenancy.test.ts` |
| treatment-plans | tenancy dedicada (rota/repo + DB) | suíte dedicada | `src/repositories/treatment-plans/__tests__/treatment-tenancy.integration.test.ts` |
| financeiro (actions guard) | `clinicId` forjado no input → `invalid_input` antes do parse | criarOrcamento, gerarCobranca, aceitar/rejeitar, gateway, routing | `src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts` |
| financeiro (budgets accept/reject) | POST …/accept e …/reject com budget estrangeiro → 404, sem mutação (envelope canônico) | matriz 401/403/200/404/409 | `src/__tests__/api/t8-matrix.test.ts` |
| financeiro (payments, serviço) | `registerManualPayment` com budget estrangeiro → `not_found` | adversarial + cross-tenant | `src/modules/financeiro/services/__tests__/payment-service.t4.test.ts` |
| financeiro (collections, serviço) | charge estrangeira → sem vazamento de telefone/ação | foreign charge cases | `src/modules/financeiro/services/__tests__/collection-service.test.ts` |
| financeiro (installments, serviço) | budget fora da clínica → `not_found` | escopo via `getBudgetForClinic` | `src/modules/financeiro/services/__tests__/installment-service.test.ts` |
| comercial (actions guard) | `clinicId` forjado → `forbidden` | pipeline, tasks, mover/qualificar/converter lead | `src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts` |
| core (tenant-scope + input-guard) | `assertClinicScope` e guarda de `clinicId`/`clinic_id` no input (fail-closed) | util + guarda | `src/core/actions/__tests__/tenant-scope.test.ts`, `src/core/actions/__tests__/tenant-input-guard.test.ts`, `src/modules/core/actions/__tests__/tenant-scope.test.ts` |
| atendimento (conversations) | tenancy de conversas (W1.2) | suíte dedicada | `src/modules/atendimento/actions/__tests__/conversation-tenancy.test.ts` |
| atendimento (module gate) | `withModuleRoute` — módulo desabilitado → 404 (P0) | gate de rota | `src/modules/atendimento/__tests__/gates/integration.test.ts` |
| crm (owner-bridge) | cross-clinic → `not_found`, sem insert/update; `clinicId` sempre do contexto | 6 its de isolamento | `src/modules/crm/__tests__/owner-bridge-actions.test.ts` |
| matriz RBAC legada | 401 anônimo / 403 sem permissão / 200 mesma clínica / 404 estrangeiro por rota (envelope canônico) | budgets, segments, custom-fields, knowledge, reports, treatment-plans, preferences | `src/__tests__/api/t8-matrix.test.ts` |

Não há "e outros": a enumeração acima é completa — todo recurso com cobertura
negativa anterior está listado com seu path; todo recurso sem linha nesta
tabela e na anterior não possui prova negativa dedicada.
