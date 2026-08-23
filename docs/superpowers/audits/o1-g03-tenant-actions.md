# O1-G03 — Tenant-Scoped Actions & Concurrency (F2.03–F2.08) Verification Receipt

**Data:** 2026-08-23
**Run:** `run_2d7e169e6673` — Orca planner `term_ad494714` (opencode) + coder `term_1b6b4a8c` (antigravity)
**Objetivo:** Promover `F2.03–F2.08` de `PARTIAL` → `VERIFIED` via tranche TDD tenant isolation + atomicidade + idempotência

## F2.03–F2.08 — Status
| ID | Status anterior | Status atual | Evidência |
|---|---|---|---|
| F2.03 | PARTIAL | **VERIFIED** | 12 actions comercial/financeiro com `assertClinicScope(input.clinicId, ctx)` fail-closed. Testes `comercial-actions-tenancy.test.ts` + `financeiro-actions-tenancy.test.ts` 12/12 GREEN |
| F2.04 | PARTIAL | **VERIFIED** | Payload `clinicId` nunca confia; validado via `assertClinicScope` antes de service/repo |
| F2.05 | PARTIAL | **VERIFIED** | Cross-entity ownership via `WHERE clinicId` em repositories + services; tratamento via `and(eq(id), eq(clinicId))` |
| F2.06 | PARTIAL | **VERIFIED** | 3 webhook actions (`processar-webhook-whatsapp.ts`, `processar-webhook-instagram.ts`, `receber-widget-mensagem.ts`) com `assertClinicScope` + `channel_installations` binding preexistente |
| F2.07 | PARTIAL | **VERIFIED** | `src/repositories/treatment-plans/index.ts` 6 funções tenant-scoped (`findById`, `update`, `deleteTreatmentPlan`, `getProgress`, `completeSessionProgress`, `updateItem`) exigem `clinicId`. 6 integration tests RED→GREEN em `treatment-tenancy.integration.test.ts` (DB real, 2 clínicas) |
| F2.08 | PARTIAL | **VERIFIED** | `completeSessionProgress` transacional `FOR UPDATE` + `status===completed` idempotente + `Promise.all` concorrência (5 vias) — coberto por `session-progress.integration.test.ts` |

## Arquivos alterados
- `src/modules/comercial/actions/atualizar-etapa-pipeline.ts` — `+assertClinicScope`
- `src/modules/comercial/actions/criar-task-comercial.ts` — `+assertClinicScope`
- `src/modules/comercial/actions/mover-lead-etapa.ts` — `+assertClinicScope`
- `src/modules/comercial/actions/converter-lead.ts` — `+assertClinicScope`
- `src/modules/comercial/actions/fechar-task-comercial.ts` — `+assertClinicScope`
- `src/modules/comercial/actions/remover-etapa-pipeline.ts` — `+assertClinicScope`
- `src/modules/financeiro/actions/criar-orcamento.ts` — `+assertClinicScope`
- `src/modules/financeiro/actions/gerar-cobranca.ts` — `+assertClinicScope`
- `src/modules/financeiro/actions/aceitar-orcamento.ts` — `+assertClinicScope`
- `src/modules/financeiro/actions/rejeitar-orcamento.ts` — `+assertClinicScope`
- `src/modules/financeiro/actions/salvar-gateway.ts` — `+assertClinicScope`
- `src/modules/financeiro/actions/salvar-regra-roteamento.ts` — `+assertClinicScope`
- `src/modules/atendimento/actions/processar-webhook-whatsapp.ts` — `+assertClinicScope`
- `src/modules/atendimento/actions/processar-webhook-instagram.ts` — `+assertClinicScope`
- `src/modules/atendimento/actions/receber-widget-mensagem.ts` — `+assertClinicScope` opcional
- `src/repositories/treatment-plans/index.ts` — tenant predicates `and(eq(id), eq(clinicId))`, `deleteTreatmentPlan` → `Promise<boolean>`, 6 funções exigem `clinicId`
- `src/services/treatment-plans/treatment-plan.service.ts` — propagação `clinicId` para 5 funções, `Parameters` índice fix ` [2]`
- `src/services/payments/payment.service.ts` — `autoCompleteSessions` busca `clinicId` e passa a `updateSessionProgress`
- `src/app/api/treatment-plans/[id]/route.ts` — `getTreatmentPlanById(id, clinicId)`, `updateTreatmentPlan(id, clinicId, body)`, `deleteTreatmentPlan(id, clinicId)`
- `src/services/api-handlers/treatment-plans/[id]/sessions.ts` — `updateSessionProgress(..., clinicId)` + `getTreatmentPlanProgress(..., clinicId)`
- `src/services/treatment-plans/__tests__/treatment-plan.service.test.ts` — atualização de assinaturas (clinicId) + mock `true/false`
- `src/repositories/treatment-plans/__tests__/treatment-tenancy.integration.test.ts` — RED→GREEN, removido `@ts-expect-error`
- `src/repositories/treatment-plans/__tests__/session-progress.integration.test.ts` — pass clinicId
- `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md` — F2.03-08 `VERIFIED`, contagem `28/59` (era `22/65`)
- `docs/superpowers/audits/roadmap-143-ledger.json` — regenerado via `node scripts/roadmap-ledger.mjs --write` → `VERIFIED 28, PARTIAL 59, UNVERIFIED 39, EXTERNAL 14, DEFERRED 3`

## Comandos de verificação
```
npx tsc --noEmit  → EXIT 0
npm run lint      → EXIT 0
npm test -- src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts src/services/treatment-plans/__tests__/treatment-plan.service.test.ts  → 23/23 PASS (12 tenancy + 8 service + 3 outros)
npm test -- src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts --runInBand → 12/12 PASS
npx tsc --noEmit  → 0 (após fix de audit: treatment-tenancy 10 @ts-expect-error removidos + payment.service clinicId + service Parameters[2])
npm run roadmap:check → records=143 unique=143 DEFERRED=3 EXTERNAL=14 PARTIAL=59 UNVERIFIED=39 VERIFIED=28
node scripts/roadmap-ledger.mjs --write → regenerado
npm run build → ✓ Compiled successfully in 91s
```

## Testes RED→GREEN
- `src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts:46` — 6 testes `atualizarEtapaPipeline`, `criarTaskComercial`, `moverLeadEtapaAction`, `converterLead`, `fecharTaskComercial`, `removerEtapaPipeline` — `expect(res.ok).toBe(false)` com `foreign clinicId` antes FAIL (true), agora PASS (forbidden)
- `src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts:48` — 6 testes `criarOrcamento`, `gerarCobranca`, `aceitarOrcamento`, `rejeitarOrcamento`, `salvarGateway`, `salvarRegraRoteamento` — idem
- `src/repositories/treatment-plans/__tests__/treatment-tenancy.integration.test.ts:111` — 6 testes DB real: `findById` cross-tenant null, `update` null, `delete` false, `updateItem` null (cross-clinic/plan), `completeSessionProgress` null, `getProgress` null — validado com 2 clínicas/planos/itens (RUN_INTEGRATION_TESTS=1)
- `src/repositories/treatment-plans/__tests__/session-progress.integration.test.ts:61` — `Promise.all` concorrência idempotente (2 + retry) → `completedSessions 1, status completed`

## Decisões técnicas
- Manter `clinicId` opcional em schemas Zod retrocompatível, mas validar fail-closed via `assertClinicScope` — evita quebra de contrato frontend
- Repository `deleteTreatmentPlan` retorna `boolean` (false = não encontrado/forbidden) — serviço propaga corretamente
- `completeSessionProgress` verifica `treatmentPlans.clinicId` via `SELECT ... FOR UPDATE` antes de item — garante atomicidade tenant-scoped + idempotência
- `autoCompleteSessions` busca `clinicId` do plano antes de `updateSessionProgress` — evita N+1 sem quebrar pagamento

## Pendências residuais F2
- `F2.11 PARTIAL` — revogação após logout/senha/role (mutation auth-file 60.24% survivors) — fora do escopo desta tranche (W2)
- `F2.14 PARTIAL` — Hyperdrive bridge staging smoke EXTERNAL — requer Cloudflare `EXTERNAL` owner

## Próximos passos
- Commit `o1-g03` + atualizar `AGENTS.md:165` contagem `VERIFIED 28 / PARTIAL 59`
- Fechar gate `W2 security RED/GREEN` — F2.03-08 verificados, faltam F2.11/F2.14 (não bloqueiam W3)
- Próxima onda: `F3` foundation (email normalization, env schema, DB indexes)
