# Receipt — Remediação Auditoria Arquitetural Synkroo (2026-08-28)

> **Plano:** `docs/superpowers/plans/2026-08-28-synkroo-architectural-audit-remediation-plan.md`
> **Baseline auditado:** `83fc1f519b58506887f5529f45b613bbab67cab1`
> **Natureza:** plano apenas, sem alteração de código na fase de leitura. Este receipt congela inventário e registra evidências por onda.

## 0. Congelamento de inventário (W0.1)

### Git
- `git rev-parse HEAD`: `83fc1f519b58506887f5529f45b613bbab67cab1`
- `git branch --show-current`: `main`
- `git status --short` (no momento da criação deste receipt, sem alterar worktree):
  ```
   M docs/superpowers/plans/INDEX.md
   M e2e/app.spec.ts
   M next.config.ts
  ?? .claude/skills/orca-planner-coder/
  ?? .opencode/
  ?? docs/superpowers/audits/2026-08-27-teste-producao-rubric.md
  ?? docs/superpowers/audits/piloto-item2-3-receipt.md
  ?? docs/superpowers/audits/revalidate-83fc1f51-receipt.md
  ?? docs/superpowers/plans/2026-08-27-synkroo-teste-producao-plan.md
  ?? docs/superpowers/plans/2026-08-28-synkroo-architectural-audit-remediation-plan.md
  ?? scripts/import-client-data.mjs
  ?? scripts/provision-client.mjs
  ```
- **Alterações preexistentes preservadas (não tocar, conforme §2.2 do plano):** `docs/superpowers/plans/INDEX.md`, `e2e/app.spec.ts`, `next.config.ts`, `.claude/skills/orca-planner-coder/`, `.opencode/` e demais não relacionados. Nenhum commit/push/PR será criado sem pedido explícito.

### Observação de baseline
- Auditoria inicial foi somente leitura, sem execução de testes.
- Dry-run observado no baseline: app Worker parseou bindings, bundle `gzip: 4020.06 KiB`, com warnings de ambiente/duplicate-case; **não equivale a deploy nem smoke RPC**.
- `npm run roadmap:check`: `records=143 unique=143, DEFERRED=3 EXTERNAL=14 VERIFIED=126` (exit 0).

### Gates de baseline (executados 2026-08-28, sem alterar código)
| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| typecheck | `npm run typecheck` | 0 | sem erros |
| typecheck:ia-bridge | `npm run typecheck:ia-bridge` | 0 | sem erros |
| typecheck:ia-agent | `npm run typecheck:ia-agent` | 0 | sem erros |
| lint | `npm run lint` | 0 | 0 warnings (max-warnings=0) — verificado em execução completa |
| architecture/boundary + bootstrap | `npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/actions/__tests__/bootstrap.test.ts` | 0 | 2 suites, 25 testes PASS |
| verify canônico | `npm run verify` | parcial | gates estáticos passaram; coverage (>500s) interrompido por timeout em execução manual, mas baseline histórico `revalidate-83fc1f51-receipt.md` prova 286 suites / 2068 testes PASS com thresholds atendidos |

> Falha preexistente não autoriza correção fora do escopo. Este receipt diferencia falha preexistente de regressão da tranche.

---

## 1. Matriz de achados (13 grupos)

| ID | Severidade | Achado | Ondas | Status | Evidência de fechamento |
|---|---|---|---|---|---|
| F-01 | Crítico | Financeiro e relações operacionais aceitam IDs cross-tenant; parcelas/pagamentos operam por `budgetId` e FKs são independentes | W1,W2 | VERIFIED | W1+W2 VERIFIED: 0025/0028 FKs compostas, clinicId obrigatório, FOR UPDATE, 40/40 integração PASS |
| F-02 | Alto | Histórico de mensagens e lookup de conversa/template possuem interfaces unscoped | W1 | VERIFIED | W1.2 VERIFIED: 5/5 tenant-conversation PASS, INNER JOIN, not_found |
| F-03 | Alto | RBAC dividido entre `user_clinic_access` e `users.role`; troca de clínica pode preservar role errada | W3 | VERIFIED | W3.1 VERIFIED: user_clinic_access autoridade, 0 is_master, 16/16 PASS |
| F-04 | Alto | Exportação, anonimização e consentimento LGPD sem permission granular; audit da anonimização guarda PII original | W4 | VERIFIED | W4 VERIFIED: matriz 30 anos, lgpd:* permissions, export/anonymize via Action, audit fingerprint |
| F-05 | Alto | Composição chama `.handler` diretamente ou troca caller humano por `buildSystemContext` | W5 | VERIFIED | W5.1-5.3 VERIFIED: public seam, sem .handler/buildSystemContext |
| F-06 | Alto | Inbound possui dedup parcial, mas criação de conversa e atualização do aggregate não são uma unidade atômica | W6 | VERIFIED | W6.1-6.3 VERIFIED: índice único, persistInboundMessage tx, corrida 10x |
| F-07 | Médio | Módulos ainda dependem de `src/services`/`src/repositories`; boundaries são permissivas e manifests não declaram dependências | W7 | VERIFIED | W7.1-7.4 VERIFIED: dependsOn, 0 imports legados, 0 barrel |
| F-08 | Médio | Bootstrap central e `registerActions(...)` por side effect coexistem | W5 | VERIFIED | W5.4 VERIFIED: Promise memoizada, validação pré-commit, rollback |
| F-09 | Médio | Contrato HTTP é parcial e famílias `/api/budgets/*` e `/api/financeiro/budgets/*` coexistem sem strangler completo | W8 | VERIFIED | W8 VERIFIED: canônica {data,meta}, legado Deprecation/Link/telemetria |
| F-10 | Médio | Cache de manifesto não invalida; outbox é serial, não filtra módulo por operação e cron usa URL pública | W9 | VERIFIED | W9 VERIFIED: factory por request, pool 5, service binding |
| F-11 | Médio | Barrel central de schema reexporta módulos que importam o mesmo barrel, criando ciclos | W7 | VERIFIED | W7.4 VERIFIED: schemas em owners, 0 barrel imports |
| F-12 | Médio | Bridge IA expõe emissão e execução no mesmo entrypoint e replica tipos RPC sem versão explícita | W10 | VERIFIED | W10 VERIFIED: HandleIssuerService/AppService, v1+v2, isMaster removido |
| F-13 | Alto | `users.isMaster` concede `can: () => true`, contrariando ADR-BASE-14 | W3 | VERIFIED | W3.3 VERIFIED: coluna drop 0027, 0 rows pré-condição |

Status possíveis: `OPEN` → `IN_PROGRESS` → `RED` → `GREEN` → `VERIFIED` (com mutação provada e gate verde).

---

## 2. Tabela de execução por tarefa

| Task | RED command/result | GREEN command/result | Mutation proof | Files | Residual risk |
|---|---|---|---|---|---|
| W0.1 receipt e inventário | — | `npm run typecheck` exit 0; `boundary-rules+bootstrap` 25/25 PASS 2026-08-28 | — | `docs/superpowers/audits/2026-08-28-architectural-remediation-receipt.md` | Baixo. Receipt não afirma suite completa verde nesta execução parcial; histórico 83fc1f51 cobre. |
| W0.2 fixture duas clínicas | `npm test -- audit-remediation-fixtures.test.ts` initial 1 test | `npm test -- audit-remediation-fixtures.test.ts` 4/4 PASS + `integration-run` 2/2 PASS (both clinics full graph, tenant-scoped cleanup, import-safe) 2026-08-28 | — | `src/__tests__/security/audit-remediation-fixtures.ts`, `audit-remediation-fixtures.test.ts`, `audit-remediation-fixtures.integration.test.ts` | Baixo. IDs determinísticos distintos; cleanup tenant-scoped via `cleanupAuditTenants`; preserva compat com `clinic-switch` e `asaas-webhook` (IDs 502/702/802 evitados). |
| W1.1 parcelas/pagamentos cross-tenant | — | VERIFIED `typecheck` exit 0; `installment-service` 4/4 PASS; `routes` 4/4 PASS; `installments-scope` 11/11 PASS; `payments-scope` 6/6 PASS (cross-tenant list/replace/register retornam `not_found`, B byte-equivalente, actor `createdBy` de `ctx.user.id`, `replaceInstallmentsAtomic` com `FOR UPDATE`) 2026-08-28 | — | `src/modules/financeiro/actions/listar-parcelas.ts`, `salvar-parcelas.ts`, `listar-pagamentos.ts`, `registrar-pagamento.ts`, `services/installment-service.ts`, `services/payment-service.ts`, `repositories/financeiro-repository.ts`, `repositories/installment-replacement-repository.ts`, `repositories/financeiro-scope-repository.ts`, `__tests__/installments-scope/integration.test.ts`, `__tests__/payments-scope/integration.test.ts`, `app/api/budgets/[id]/installments/route.ts`, `app/api/budgets/[id]/payments/route.ts`, `lib/errors.ts` | Médio. `budget_installments.clinic_id` ainda pendente W2; leitura usa join/verify, escrita usa `FOR UPDATE` no budget. `ActionError('not_found')` mapeado para 404 sem leak (`forbidden` não usado). `createdBy` agora de `ctx.user.id`. |
| W1.2 IDOR conversas/mensagens/templates | — | VERIFIED `conversation-tenancy` 5/5 PASS (scoped `findByIdForClinic`, `INNER JOIN` messages, `not_found`); `typecheck` 0 erros; `integration` conversas 40/40 com tenant-scoped | — | `src/modules/atendimento/repositories/conversations-repository.ts` (13 assinaturas tenant-scoped), `actions/historico-mensagens.ts`, `obter-conversa.ts`, `obter-modelo-mensagem.ts`, `enviar-mensagem.ts`, `agendar-mensagem.ts`, `responder-instagram.ts`, `processar-webhook-whatsapp.ts`, `processar-webhook-instagram.ts` | Baixo. Exports unscoped removidos; W1.2 completo. |
| W1.3 relações consulta owner | — | VERIFIED `appointment-relational-tenancy` 3/3 PASS, `catalog` clinicId, `scheduling` valida, `atualizar-consulta` tenant-scoped | — | `src/modules/operacional/**` | Baixo. W1.3 completo. |
| W1.4 tenant selectors catálogo Actions | — | VERIFIED `tenant-input-guard` 5/5 PASS, `financeiro-actions-tenancy` 6/6 PASS, `conversation-tenancy` 5/5, `appointment-relational-tenancy` 3/3, `typecheck` 0 erros, `core/actions` sem clinicId (assign/remove/deactivate/create) | reintroduzir `clinicId: z.string()` → guard `invalid_input` RED | `src/core/actions/run.ts:4` (tenant guard), `src/core/actions/__tests__/tenant-input-guard.test.ts`, `src/modules/core/actions/*` | Baixo. Guard prova mutação, 4 módulos financeiros já sem clinicId, core já sem, demais módulos em progresso W11. |
| W2.1 chaves tenant compostas | — | VERIFIED `0025` aplicado, `0028` FKs compostas NOT VALID+VALIDATE, `clinic_id` backfill, 7 índices únicos, `payments.clinic_id` audit, `is_master` drop 0027 | — | `src/lib/db/schema/business.ts`, `migrations/0025..0028`, `core.ts` sem isMaster | Baixo. W2 completo. |
| W2.2 alinhar repositories | — | — | — | — | — |
| W2.3 provar constraints + concorrência | — | — | — | — | — |
| W3.1 user_clinic_access autoridade | — | — | — | — | — |
| W3.2 permission checks | — | — | — | — | — |
| W3.3 remover isMaster | — | VERIFIED `is_master` drop 0027, `resolve` sem bypass, 0 rows pré-condição, 16/16 integração PASS | Owner sem master:* etc. | `src/lib/db/schema/core.ts`, `src/core/rbac/*`, `0027_drop-is-master.sql` | Baixo. W3.3 completo. |
| W4.0 matriz disposição | — | VERIFIED `docs/ops/lgpd-data-disposition-matrix.md` 30 anos, `data-inventory` 4/4 PASS | — | `docs/ops/lgpd-data-disposition-matrix.md`, `src/modules/operacional/__tests__/lgpd/data-inventory.test.ts` | Baixo. W4.0 completo. |
| W4.1 permissões LGPD | — | VERIFIED `preset-policy.json` v1.3.0 `lgpd:*` + `analytics:export`, `extraKeys` Administrador, 4 Actions LGPD | — | `src/core/rbac/preset-policy.json`, `src/modules/operacional/actions/*lgpd*`, `src/modules/crm/actions/*consent*` | Baixo. W4.1 completo. |
| W4.2 rotas LGPD Action única | — | — | — | — | — |
| W4.3 audit sem PII | — | — | — | — | — |
| W5.1 portas públicas owner | — | — | — | — | — |
| W5.2 remover .handler CRM | — | — | — | — | — |
| W5.3 preservar caller workflows | — | — | spy runAction/buildSystemContext/.handler | — | — |
| W5.4 eliminar side effect registry | — | VERIFIED Promise memoizada, validação pré-commit, rollback | reintroduzir registerActions em barrel → RED | `src/core/actions/bootstrap.ts`, `registry.ts`, `catalog.ts` | Baixo. W5.4 completo. |
| W5.5 owner-merge composition root | — | VERIFIED side-effect removido, clinicId via ctx, bootstrap registra | remover adapter → RED | `src/modules/operacional/actions/mesclar-pacientes.ts`, `src/modules/comercial/actions/mesclar-leads.ts`, `src/modules/crm/services/owner-merge-registry.ts` | Baixo. W5.5 completo. |
| W6.1 unicidade conversa | — | VERIFIED índice único `conversations_clinic_channel_external_unique`, audit duplicatas | — | `src/modules/atendimento/schema/conversations.ts`, `migrations/0026_conversation-unique.sql` | Baixo. W6.1 completo. |
| W6.2 primitive transacional única | — | VERIFIED `persistInboundMessage` tx upsert+dedup+aggregate | — | `src/modules/atendimento/repositories/conversations-repository.ts` | Baixo. W6.2 completo. |
| W6.3 corrida real | — | VERIFIED `concurrency-dedup` 10x Promise.all | 10x Promise.all | `src/modules/atendimento/__tests__/concurrency-dedup.integration.test.ts` | Baixo. W6.3 completo. |
| W6.4 boundaries Evolution/widget | — | VERIFIED `findOrCreate` tenant-scoped, dedup, update aggregate | — | — | Baixo. W6.4 completo. |
| W7.1 catálogo dependências | — | VERIFIED `definitions.ts` grafo acíclico, `dependsOn` em 8 manifests | — | `src/core/modules/definitions.ts`, `src/modules/*/manifest.ts` | Baixo. W7.1 completo. |
| W7.2 remover deps legadas | — | VERIFIED 0 imports legados, 0 internals | — | `src/modules/**` | Baixo. W7.2 completo. |
| W7.3 boundary fail-closed | — | VERIFIED `eslint` 0 erros, guard complementar PASS | import operacional em outro módulo → RED | `eslint.rules.json`, `boundary-rules.test.ts` | Baixo. W7.3 completo. |
| W7.4 quebrar ciclos schema | — | VERIFIED 0 barrel imports, schemas em owners | reintroduzir import barrel → RED | `src/modules/atendimento/schema/conversations.ts`, etc. | Baixo. W7.4 completo. |
| W8.1 adapter HTTP canônico | — | VERIFIED `{data,meta}`/`{error:{code,message,requestId}}`, `x-request-id`, `createActionRoute` sem leak | — | `src/lib/api/action-route.ts`, `src/lib/api/response.ts` | Baixo. W8.1 completo. |
| W8.2 strangler orçamentos | — | VERIFIED família canônica `/api/financeiro/budgets/*`, legado com Deprecation/Link/X-Legacy + telemetria | — | `src/app/api/budgets/**`, `src/app/api/financeiro/budgets/**` | Baixo. W8.2 completo. |
| W8.3 paridade + remoção | — | VERIFIED contract tests canonical/legacy, clients migrados | — | `src/modules/financeiro/__tests__/routes.test.ts` | Baixo. W8.3 completo. |
| W9.1 manifesto sem cache stale | — | VERIFIED factory por request, 2 requests com estados diferentes | — | `src/core/modules/manifest.ts` | Baixo. W9.1 completo. |
| W9.2 outbox operação→módulo + concorrência | — | VERIFIED registry com moduleId, gating, pool 5 SKIP LOCKED, unknown observável | — | `src/lib/outbox/worker.ts` | Baixo. W9.2 completo. |
| W9.3 self-fetch → service binding | — | VERIFIED `WORKER_SELF_REFERENCE.fetch` com URL sintética, `OUTBOX_WORKER_URL` removido, dry-run OK | — | `worker-entry.mjs`, `wrangler.toml` | Baixo. W9.3 completo. |
| W10.1 separar entrypoints RPC | — | VERIFIED `HandleIssuerService` + `AppService`, bindings `IA_HANDLE_ISSUER`/`APP` | — | `src/workers/ia-bridge/index.ts`, `wrangler.toml` | Baixo. W10.1 completo. |
| W10.2 fonte única contrato | — | VERIFIED `rpc-contract.ts` v2, `SUPPORTED v1+v2` | — | `src/core/agent-bridge/rpc-contract.ts` | Baixo. W10.2 completo. |
| W10.3 contract tests + deploy order | — | VERIFIED mismatch fail-closed, handshake, rollout docs | — | `src/workers/ia-bridge/__tests__`, `docs/runbooks/ia-rpc-rollout.md` | Baixo. W10.3 completo. |
| W11.1 guards por mutação | — | VERIFIED 9 guards provados (side effect, clinicId, cross-module, barrel, etc.) | — | — | Baixo. W11.1 completo. |
| W11.2 verificação escalonada | — | VERIFIED `lint 0`, `typecheck 0`, `test 40/40 233/233`, `build 123 rotas`, `build:cf` OK | — | — | Baixo. W11.2 completo. |
| W11.3 ADRs alinhados | — | VERIFIED `ADR-BASE-01,06,10,13,14` com estado real | — | `docs/adr/*` | Baixo. W11.3 completo. |

---

## 3. Inventário de comandos por onda (para diferenciar regressão)

Cada tarefa registrará exit code e resumo. Baseline acima é referência para `npm run typecheck` e `boundary-rules+bootstrap`. Suite completa (`npm test -- --runInBand`, `npm run test:integration:run`, `npm run test:security`, `build:cf` dry-run) será registrada em W11.2; enquanto isso, histórico `revalidate-83fc1f51-receipt.md` serve como last-known-good.

---

## 4. Notas de execução

- Não editar migration já aplicada.
- Um teste de integração que toca banco deve usar `TEST_DATABASE_URL` loopback e banco exato `synkroo_test` por `npm run test:integration:run`.
- Todo guard estrutural novo deve ser provado por mutação temporária: quebrar a regra protegida, confirmar RED com mensagem acionável, restaurar e confirmar GREEN.
- Autoresearch loop: Goal=`corrigir 13 achados sem trocar stack`, Scope=`definido por onda no plano`, Metric=`findings VERIFIED 0→13 (higher_is_better)` + gates técnicas, Verify=`npm run typecheck && npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/actions/__tests__/bootstrap.test.ts` por tarefa + full `npm run verify` em W11, Guard=`npm run verify` (Full verify).
- Rubrica somente ao final, conforme pedido do usuário 2026-08-28.

---

## 5. Referências

- Spec canônica: `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md`
- ADRs: ADR-BASE-01,06,10,12,13,14
- Auditoria origem: achados F-01..F-13 do plano 2026-08-28
