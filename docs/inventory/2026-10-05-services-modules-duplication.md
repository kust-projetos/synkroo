# Mapa de Duplicação `src/services` × `src/modules` — vNext P0

**Data:** 2026-10-05 · **Base:** commit `bf82bb19`
**Descoberta estrutural central:** `grep "from '@/services/'"` em `src/modules` → **0 matches**. A relação não é wrapper — é **duplicação paralela** pós-strangler: o adapter legado (`src/services/api-handlers/**`, headers `X-Synkroo-Legacy-Route: 1` + `Link: rel="successor-version"`) é quem conserta (conserta→consome) os módulos; os módulos nunca importam services legados.

Legenda: **DUPLICATED** = módulo reimplementa (caminhos paralelos vivos) · **LEGACY-ONLY** = só existe no legado · **MODULE-ONLY** = só existe no módulo · **WRAPPED** = módulo exposto por adapter · **ÓRFÃO** = alcançado apenas pelo próprio teste.

## 1. Por domínio

| Domínio | Legado (`src/services`) | Módulo | Status | Evidência de caminho vivo |
|---|---|---|---|---|
| Orçamentos | `budgets/budget.service.ts` | `financeiro/services/budget-service.ts` + 8 actions | DUPLICATED | `api-handlers/budgets/[id].ts:10` já usa o módulo; legado só type-import em `hooks/useFinancialSummary.ts:8` |
| Pagamentos | `payments/payment.service.ts` | `financeiro/services/payment-service.ts` + actions | DUPLICATED | sem consumidor produtivo do legado |
| Parcelas | `installments/installment.service.ts` | `financeiro/services/installment-service.ts` + actions | DUPLICATED | sem consumidor produtivo do legado |
| Cobranças/Gateways | — | `financeiro/services/{charge,collection,gateway-config,dashboard,dispatch-charge-job}-service.ts` | MODULE-ONLY | — |
| Relatórios financeiros | `reports/financial-reports.service.ts` | — | LEGACY-ONLY ativo | `app/api/reports/financial/route.ts:17` |
| Analytics | `analytics/{roi,noshow-prediction,attendance-metrics,analytics}.service.ts` | — | LEGACY-ONLY ativo | `app/api/analytics/*/route.ts` |
| Segmentos campanha | `followup/segmentation.service.ts` | `followup/actions/listar-segmentos.ts` | DUPLICATED | `api/campaigns/segments/route.ts:11` usa legado |
| Campanhas (execução) | `followup/campaign.service.ts` | `followup/services/campaign-service.ts` | DUPLICATED | `api/campaigns/**` usa legado; módulo implementa contra repositório próprio |
| Inativos | `followup/inactive-patient.service.ts` | `followup/services/inactive-service.ts` | DUPLICATED | `api/patients/inactive/route.ts:16` + `api-handlers/dashboard/stats.ts:12` usam legado |
| Follow-up | `followup/followup.service.ts` | `followup/services/followup-service.ts` | DUPLICATED | `followup/index.ts:38` exporta o do módulo; cron já usa módulo |
| Budget follow-up | `followup/budget-followup.service.ts` | `followup/services/budget-followup-service.ts` | DUPLICATED | `api-handlers/dashboard/alerts.ts:9` usa legado |
| Consent guard | `followup/consent-guard.ts` | — | **ÓRFÃO** | só o próprio teste importa |
| Contatos CRM | `contacts/{contacts,timeline,consents}.service.ts` | `crm/services/contact-*-service.ts` + actions | DUPLICATED | `api-handlers/activities.ts:7` (type) e `followup/campaign.service.ts:9` (`hasActiveConsent`) são os últimos consumidores |
| Dedup | `patients/patient-dedup.service.ts` | `crm/services/duplicate-*-service.ts` (pipeline completo) | DUPLICATED | legado órfão |
| Pacientes (tags/history) | `patients/{patient-tags,patient-history}.service.ts` | `operacional/services/patients-service.ts` | DUPLICATED | legados órfãos |
| Pacientes (preferências) | `patients/patient-preferences.service.ts` | `operacional` | DUPLICATED ativo | `api/patients/[id]/preferences/route.ts:5` |
| Waitlist | `waitlist/waitlist.service.ts` | `operacional/actions/*waitlist*` + repo próprio | DUPLICATED | legado órfão; rotas usam módulo |
| Tratamentos incompletos | `appointments/incomplete-treatment.service.ts` | `operacional/services/incomplete-treatment-service.ts` | DUPLICATED | `api-handlers/dashboard/alerts.ts:7` usa legado |
| Confirmação consulta | `appointments/confirmation-handler.service.ts` | `operacional/services/confirmation-service.ts` | **ÓRFÃO** | só `jest.mock` em testes de webhook |
| Config lembrete | `reminders/procedure-reminder-config.service.ts` | `operacional/services/procedure-reminder-config-service.ts` | DUPLICATED | legado órfão |
| Planos de tratamento | `treatment-plans/treatment-plan.service.ts` | `operacional/schema/treatments.ts` (só tabelas) | LEGACY-ONLY ativo | `api/treatment-plans/**` importa direto |
| Custom fields | `custom-fields/*.service.ts` | `crm/schema/contacts.ts` (só tabelas) | LEGACY-ONLY ativo | `api/custom-fields/**` |
| RAG/Knowledge | `rag/rag.service.ts` | `ia/schema/knowledge.ts` (só tabelas) | LEGACY-ONLY ativo | `api/knowledge/{search,ingest}` |
| Atendimento | — | `atendimento/**` (21 actions, 10 services) | MODULE-ONLY | todas as rotas usam `runAtendimentoAction` |
| Comercial | — | `comercial/**` (28 actions, 9 services, 5 repos) | MODULE-ONLY | `api/{leads,pipeline,tasks}/**` |
| IA | — | `ia/**` (manifest/schema; agente em `src/core/ia-agent` + workers) | MODULE-ONLY | `iaActions = []` |
| RBAC/auth (usuários) | `repositories/auth` | `core/services/access-service.ts` + `core/public.ts:2` | DUPLICATED (duplo caminho vivo) | `lib/auth/auth.ts:5` + `api/auth/**` usam repo legado; `core/public.ts` exporta o do módulo |
| LGPD | `api-handlers/lgpd/*` | `operacional/services/lgpd-service.ts` + `lgpd-*.ts` por módulo | WRAPPED | rotas → `_handler` → api-handler → módulo |

## 2. Repositories legados

- **DUPLICATED (módulo tem paralelo):** `appointments`, `patients`, `dentists`, `procedures`, `waitlist`, `treatment-plans`, `reminders`, `campaigns`, `followup`, `knowledge`, `budgets`.
- **LEGACY-ONLY ativo:** `auth` (sessão NextAuth — fora de qualquer módulo), `clinics`.
- **Órfãos:** `conversation-sessions`, `memory`.

## 3. Riscos registrados

1. **Órfãos com teste verde (7 arquivos)** — `confirmation-handler`, `patient-dedup`, `patient-history`, `patient-tags`, `waitlist.service`, `procedure-reminder-config.service`, `consent-guard`: cobertura verde não prova uso; remoção exige deletar arquivo + teste no mesmo commit.
2. **Duplo caminho de auth** — `@/repositories/auth` (sessão) coexiste com `modules/core/repositories/users-repository` (exposto via `core/public.ts`): duas fontes para identidade.
3. **Duplo caminho monetário** — `services/{budgets,installments,payments}` vs `modules/financeiro/services/*` (semântica de centavos + rate-limit só no módulo): risco de divergência silenciosa se sobreviver caller legado.
4. **Mitigação existente é informacional apenas** — headers `X-Synkroo-Legacy-Route`/`Deprecation` não enforced.

## 4. Convergência sugerida (entrada para roadmap vNext — fora do escopo desta tranche)

1. **Onda de deleção atômica** dos 7 órfãos (+ testes) — zero risco de runtime.
2. **Migrar últimos consumidores LEGACY-ONLY ativos** (`analytics`, `reports/financial`, `treatment-plans`, `custom-fields`, `rag`, `patient-preferences`) para módulos ou criar módulo correspondente.
3. **Convergência auth** para `modules/core` mantendo `repositories/auth` como seam de sessão NextAuth.
4. **Extinção dos adapters `api-handlers`** tranche a tranche (24 rotas ainda delegam), monitorando headers de deprecação.
