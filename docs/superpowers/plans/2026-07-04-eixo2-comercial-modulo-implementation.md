# Eixo 2 — Módulo Comercial (E-05) Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Migrar leads, pipeline, tasks comerciais e conversão para avaliação para o template canônico do Eixo 2, preservando URLs atuais e removendo bypasses legados.
**Architecture:** Comercial segue `route/UI/agent → action → service → repository → Drizzle`. Dedup de lead é DB-enforced por `phoneNormalized`; hot-lead notification roda em cron gated; `agendarAvaliacao` orquestra E-02 e só converte após agendamento verde.
**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Jest unit/integration, ESLint boundaries.
**Spec:** `docs/superpowers/specs/2026-07-04-eixo2-comercial-modulo-design.md`.
**Agent Orchestration:** Single-Agent Looped — tarefas sequenciais; cada tarefa fecha RED → GREEN → REFACTOR → verificação → commit.
---
## Context
- Onda 1 está fechada; E-05 é primeiro módulo da Onda 2.
- Recorte aprovado: leads + pipeline + tasks + conversão para avaliação.
- Fora: budgets/payments/CRM/marketing.
- URLs públicas atuais devem continuar funcionando como adapters.
## Stack
| Pkg | Versão | Uso |
|---|---:|---|
| Next.js | 15 | Route handlers + dashboard |
| React | 19 | UI existente de leads/pipeline |
| TypeScript | 5.6 | contratos e actions |
| Drizzle | repo | schema + queries PostgreSQL |
| Jest | repo | unit/integration |
## Architecture
```
src/modules/comercial/
├── actions/
├── repositories/
├── services/
├── schema/
├── ui/
├── manifest.ts
├── permissions.ts
└── index.ts
```
Rules:
- Routes call `runAction`; no route imports `getDb`, service, or repository.
- Actions define Zod input and delegate to services.
- Services own invariants: dedup, scoring, conversion, notification recipient.
- Repositories own Drizzle only.
- Cross-module calls use registered Actions: `operacional.criarPaciente`, `operacional.atualizarPaciente`, `operacional.agendarConsulta`, `atendimento.enviarMensagemDireta`.
## Schemas
| Table | Target |
|---|---|
| `leads` | `src/modules/comercial/schema/leads.ts` + `phoneNormalized` |
| `lead_activities` | `src/modules/comercial/schema/leads.ts` |
| `pipeline_stages` | `src/modules/comercial/schema/pipeline.ts` |
| `tasks` | `src/modules/comercial/schema/tasks.ts` |
| campaigns/followups | stay bridged outside Comercial |
| budgets/payments | stay in `business.ts` |
Migration rule:
1. Add nullable `phone_normalized`.
2. Backfill from `phone` digits.
3. Preflight duplicates by `(clinic_id, phone_normalized)`.
4. Merge duplicates: winner = converted newest else newest; move activities/tasks to winner; set losers `status='lost'`, `lost_reason='merged_duplicate'`, `phone_normalized = NULL`.
5. Add unique index for non-null `phone_normalized`.
## Endpoints
| Route | Target |
|---|---|
| `/api/leads/**` | adapter + `withModuleRoute('comercial')` |
| `/api/pipeline/**` | adapter + `withModuleRoute('comercial')` |
| `/api/cron/hot-leads` | CRON_SECRET + `assertModuleForJob('comercial')` |
| `/api/budgets/**` | out of scope |
## Components
```
src/app/dashboard/leads/**          # preserve UI, switch data source if needed
src/app/dashboard/crm/pipeline/**   # canonical pipeline page
src/app/dashboard/pipeline/page.tsx # redirect/legacy if touched
src/components/pipeline/**          # snapshot only if modified
```
## Milestones plan
| Task | Name | Deliverable |
|---:|---|---|
| 1 | Schema + migration safety | module schema + backfill/preflight |
| 2 | Repositories/services | lead/pipeline/task logic under module |
| 3 | Actions + registry | Action catalog + permissions + manifest |
| 4 | Route adapters/gates | `/api/leads`, `/api/pipeline`, cron gated |
| 5 | Cross-module bridges | Atendimento/E-02/E-01 integration |
| 6 | UI/menu | manifest menu + canonical pipeline |
| 7 | Legacy cleanup | no forbidden legacy imports |
| 8 | Verification | focused suites + typecheck |
## Trade-offs
| Decision | Reason | Rejected |
|---|---|---|
| Keep budgets out | Financeiro future owns payment/quotes | moving budgets now |
| DB unique for lead dedup | prevents webhook/manual race | service-only dedup |
| Async hot-lead job | avoids webhook latency | synchronous WhatsApp send |
| Tasks in Comercial | lead-scoped follow-up | global task redesign |
## Tests
| Type | Tool | Scope |
|---|---|---|
| Unit | Jest | scoring, dedup, recipient, task lifecycle |
| Integration | Jest + PG | concurrent capture, gates, conversion, cron |
| Contract | Jest mocks | `atendimento.enviarMensagemDireta`, `operacional.agendarConsulta` results |
| Snapshot | Jest | pipeline/lead UI if modified |
| Mutation | Stryker | scoring/capture target ≥70% |
| Coverage | Jest | new code ≥80% |
---
## Task 1 — Schema seam + dedup migration safety
**Files:**
- Create: `src/modules/comercial/schema/leads.ts`
- Create: `src/modules/comercial/schema/pipeline.ts`
- Create: `src/modules/comercial/schema/tasks.ts`
- Create: `src/modules/comercial/schema/index.ts`
- Modify: `src/lib/db/schema/crm.ts`
- Modify: `src/lib/db/schema/index.ts`
- Create: `src/lib/db/migrations/0001_comercial_phone_normalized.sql` (use next migration number if occupied)
- Test: `src/modules/comercial/__tests__/schema/comercial-dedup.integration.test.ts`
- [ ] **Step 1: Write RED integration for concurrent capture dedup**
```ts
it('keeps one lead for concurrent same clinic phone capture', async () => {
  const input = { clinicId, name: 'Maria', phone: '(11) 99999-0000', source: 'whatsapp' as const };
  const results = await Promise.all([
    captureLead(input),
    captureLead({ ...input, name: 'Maria Silva' }),
  ]);
  expect(new Set(results.map((r) => r.leadId)).size).toBe(1);
});
```
Run: `npx jest --config jest.integration.config.js src/modules/comercial/__tests__/schema/comercial-dedup.integration.test.ts --runInBand`
Expected: FAIL because module does not exist.
- [ ] **Step 2: Move schema ownership**
Create module schema files by moving definitions:
- `leads`, `leadActivities` → `schema/leads.ts`
- `pipelineStages` → `schema/pipeline.ts`
- `tasks` → `schema/tasks.ts`
`src/modules/comercial/schema/index.ts`:
```ts
export * from './leads';
export * from './pipeline';
export * from './tasks';
```
Update `src/lib/db/schema/index.ts` to re-export `@/modules/comercial/schema`.
- [ ] **Step 3: Add `phoneNormalized` to `leads` schema**
```ts
phoneNormalized: varchar('phone_normalized', { length: 32 }),
```
Add unique index/constraint in SQL migration, not Drizzle object if existing pattern cannot express partial index safely.
- [ ] **Step 4: Write SQL migration with preflight**
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_normalized varchar(32);
UPDATE leads SET phone_normalized = regexp_replace(phone, '\D', '', 'g') WHERE phone_normalized IS NULL;

WITH ranked AS (
  SELECT id, clinic_id, phone_normalized,
    first_value(id) OVER (
      PARTITION BY clinic_id, phone_normalized
      ORDER BY converted_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS winner_id
  FROM leads
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
), losers AS (
  SELECT id, winner_id FROM ranked WHERE id <> winner_id
)
UPDATE lead_activities a SET lead_id = l.winner_id FROM losers l WHERE a.lead_id = l.id;

WITH ranked AS (
  SELECT id, clinic_id, phone_normalized,
    first_value(id) OVER (
      PARTITION BY clinic_id, phone_normalized
      ORDER BY converted_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS winner_id
  FROM leads
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
), losers AS (
  SELECT id, winner_id FROM ranked WHERE id <> winner_id
)
UPDATE tasks t SET lead_id = l.winner_id FROM losers l WHERE t.lead_id = l.id;

WITH ranked AS (
  SELECT id, clinic_id, phone_normalized,
    first_value(id) OVER (
      PARTITION BY clinic_id, phone_normalized
      ORDER BY converted_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS winner_id
  FROM leads
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
), losers AS (
  SELECT id FROM ranked WHERE id <> winner_id
)
UPDATE leads SET status = 'lost', lost_reason = 'merged_duplicate', lost_at = now(), phone_normalized = NULL
WHERE id IN (SELECT id FROM losers);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM leads
    WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
    GROUP BY clinic_id, phone_normalized
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate leads remain before comercial phone_normalized unique index';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS leads_clinic_phone_normalized_uniq
ON leads (clinic_id, phone_normalized)
WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';
```
This is deterministic and executable before adding the unique index.
- [ ] **Step 5: Run schema checks**
Run:
```bash
npm run typecheck
npm run db:generate
```
Expected: typecheck PASS; db generate has no unexpected drift beyond intentional schema move/migration.
- [ ] **Step 6: Commit**
```bash
git add src/modules/comercial/schema src/lib/db/schema src/lib/db/migrations src/modules/comercial/__tests__
git commit -m "feat(comercial): add schema seam and lead dedup"
```
---
## Task 2 — Lead, pipeline, task repositories/services
**Files:**
- Create: `src/modules/comercial/repositories/leads-repository.ts`
- Create: `src/modules/comercial/repositories/pipeline-repository.ts`
- Create: `src/modules/comercial/repositories/tasks-repository.ts`
- Create: `src/modules/comercial/repositories/activities-repository.ts`
- Create: `src/modules/comercial/services/lead-scoring-service.ts`
- Create: `src/modules/comercial/services/lead-capture-service.ts`
- Create: `src/modules/comercial/services/pipeline-service.ts`
- Create: `src/modules/comercial/services/tasks-service.ts`
- Test: `src/modules/comercial/services/__tests__/*.test.ts`
- [ ] **Step 1: RED scoring tests**
```ts
it('classifies hot score at 70', () => {
  expect(getLeadTemperature(70)).toBe('hot');
});
it('adds budget and urgency signals', () => {
  const result = calculateLeadScore({ source: 'whatsapp', hasPhone: true, hasEmail: false, expressedInterest: true, askedBudget: true, hasTimeline: true, respondedToFollowup: false, previousPatient: false });
  expect(result.score).toBeGreaterThanOrEqual(70);
});
```
Run: `npx jest src/modules/comercial/services/__tests__/lead-scoring-service.test.ts`
Expected: FAIL.
- [ ] **Step 2: Implement scoring service**
Export:
```ts
export type LeadTemperature = 'cold' | 'warm' | 'hot';
export function getLeadTemperature(score: number): LeadTemperature;
export function calculateLeadScore(input: LeadScoreInput): { score: number; temperature: LeadTemperature; factors: ScoreFactor[] };
```
- [ ] **Step 3: RED capture service tests**
Test same phone updates one lead and writes activity `lead_captured`.
- [ ] **Step 4: Implement repositories**
Required repository functions:
- `upsertLeadByPhoneNormalized(input)`
- `findLeadByIdForClinic(leadId, clinicId)`
- `updateLead(leadId, clinicId, patch)`
- `insertActivity({ leadId, activityType, description, metadata })`
- `listPipeline(clinicId)`
- `moveLeadStage({ leadId, clinicId, stageId })`
- `createTask`, `listTasks`, `updateTask`, `closeTask`
- [ ] **Step 5: Implement services**
Services call repositories only; no route/action imports.
- [ ] **Step 6: Verify**
Run:
```bash
npx jest src/modules/comercial/services --runInBand
npm run typecheck
```
- [ ] **Step 7: Commit**
```bash
git add src/modules/comercial/repositories src/modules/comercial/services
git commit -m "feat(comercial): add lead pipeline task services"
```
---
## Task 3 — Actions, manifest, permissions, bootstrap
**Files:**
- Create: `src/modules/comercial/actions/*.ts`
- Create: `src/modules/comercial/manifest.ts`
- Create: `src/modules/comercial/permissions.ts`
- Create: `src/modules/comercial/index.ts`
- Modify: `src/core/actions/bootstrap.ts`
- Test: `src/modules/comercial/actions/__tests__/registry.test.ts`
- [ ] **Step 1: RED registry test**
```ts
it('registers comercial actions for agent tools', () => {
  bootstrapActions();
  expect(actionRegistry.get('comercial.capturarLead')).toBeDefined();
  expect(actionRegistry.get('comercial.agendarAvaliacao')).toBeDefined();
});
```
Run: `npx jest src/modules/comercial/actions/__tests__/registry.test.ts`
Expected: FAIL.
- [ ] **Step 2: Create actions**
Actions:
- `capturarLead`
- `qualificarLead`
- `listarLeads`
- `obterLead`
- `atualizarLead`
- `moverLeadEtapa`
- `converterLead`
- `agendarAvaliacao`
- `listarPipeline`
- `criarEtapaPipeline`
- `atualizarEtapaPipeline`
- `removerEtapaPipeline`
- `reordenarEtapasPipeline`
- `criarTaskComercial`
- `listarTasksComerciais`
- `atualizarTaskComercial`
- `fecharTaskComercial`
- `processarNotificacoesLeadsQuentes`
Pattern:
```ts
export const capturarLead = defineAction({
  name: 'comercial.capturarLead',
  module: 'comercial',
  requires: 'comercial:capture_leads',
  label: 'Capturar lead',
  input: capturarLeadInput,
  handler: async (input, ctx) => service({ clinicId: ctx.clinicId, ...input }),
});
```
- [ ] **Step 3: Manifest/permissions**
Use menu paths `/dashboard/leads` and `/dashboard/crm/pipeline`; job `comercial.hot-leads`. Tasks are action-only in this slice; no new seller UI.
- [ ] **Step 4: Bootstrap**
Register `comercialActions`, `comercialManifest`, `comercialAccessPermissions` beside existing modules.
- [ ] **Step 5: Verify**
Run:
```bash
npx jest src/modules/comercial/actions --runInBand
npm run typecheck
```
- [ ] **Step 6: Commit**
```bash
git add src/modules/comercial src/core/actions/bootstrap.ts
git commit -m "feat(comercial): register actions and manifest"
```
---
## Task 4 — Route adapters, system runner, gates, hot-leads cron
**Files:**
- Modify: `src/app/api/leads/**/route.ts`
- Modify: `src/app/api/pipeline/**/route.ts`
- Create: `src/app/api/cron/hot-leads/route.ts`
- Create: `src/modules/comercial/ui/route-adapter.ts`
- Test: `src/modules/comercial/__tests__/routes/gates.integration.test.ts`
- [ ] **Step 1: RED route gate test**
Test disabled module returns 404 for `/api/leads` and `/api/pipeline/stages`.
- [ ] **Step 2: Implement `runComercialAction` and `runComercialSystemAction`**
User adapter mirrors Atendimento/Operacional pattern:
```ts
export async function runComercialAction(action, input, opts = {}) {
  const ctx = await buildUserContext(opts.clinicId);
  return mapActionResult(await runAction(action, input, ctx));
}

export async function runComercialSystemAction(action, input, clinicId: string) {
  const ctx = buildSystemActionContext({ clinicId, source: 'cron' });
  return mapActionResult(await runAction(action, input, ctx));
}
```
Use the existing project helper for system contexts if named differently; do not fake user sessions for webhook/cron.
- [ ] **Step 3: Convert route handlers**
Each route:
1. Parse request/search params.
2. Call `runComercialAction(action, input)`.
3. Export handler wrapped with `withModuleRoute('comercial', moduleManifest)`.
Forbidden after this task:
```bash
rg "getDb\(|@/services/leads|@/repositories/leads|@/services/pipeline" src/app/api/leads src/app/api/pipeline
```
Expected: no output.
- [ ] **Step 4: Create hot-leads cron**
`src/app/api/cron/hot-leads/route.ts`:
- verify `CRON_SECRET` via `timingSafeEqual` pattern from existing crons.
- call `assertModuleForJob('comercial', moduleManifest)`.
- run Action `comercial.processarNotificacoesLeadsQuentes` through `runComercialSystemAction`.
- [ ] **Step 5: Verify**
Run:
```bash
npx jest src/modules/comercial/__tests__/routes --runInBand
npm run typecheck
```
- [ ] **Step 6: Commit**
```bash
git add src/app/api/leads src/app/api/pipeline src/app/api/cron/hot-leads src/modules/comercial/ui src/modules/comercial/__tests__
git commit -m "feat(comercial): gate routes and hot lead cron"
```
---
## Task 5 — Cross-module bridges
**Files:**
- Modify: `src/modules/atendimento/services/webhook-processor-service.ts`
- Create: `src/modules/atendimento/actions/enviar-mensagem-direta.ts`
- Modify: `src/modules/atendimento/actions/index.ts`
- Create/modify: `src/modules/comercial/services/lead-conversion-service.ts`
- Create/modify: `src/modules/comercial/services/hot-lead-notification-service.ts`
- Test: `src/modules/comercial/services/__tests__/lead-conversion-service.test.ts`
- Test: `src/modules/comercial/services/__tests__/hot-lead-notification-service.test.ts`
- Test: `src/modules/atendimento/actions/__tests__/enviar-mensagem-direta.test.ts`
- [ ] **Step 1: RED conversion service tests**
Cases:
- no `patientId` → calls `operacional.criarPaciente`, then `operacional.agendarConsulta`, then converts.
- existing `patientId` → calls `operacional.atualizarPaciente` only if lead data changed, then schedules.
- scheduling fails → lead remains not converted.
- [ ] **Step 2: Implement `agendarAvaliacao` orchestration**
Use internal service `ensurePacienteParaLead` calling `runAction` with E-02 actions by name/import. Do not expose `ensurePacienteParaLead` as public action.
- [ ] **Step 3: RED notification recipient tests**
Cases:
- `assignedTo` active with phone receives notification.
- no assigned phone → first active Owner/Admin phone receives notification.
- no recipient → creates commercial task and logs `hot_lead_notification_skipped`.
- already notified in 24h → no send.
- [ ] **Step 4: Add direct Atendimento action for staff notifications**
Create `atendimento.enviarMensagemDireta` with input `{ channel:'whatsapp'|'instagram'|'web', externalId:string, message:string }`. It lives in Atendimento and may call Atendimento's channel service. It must not require `conversationId` because hot-lead recipient is staff phone/externalId, not patient conversation.
- [ ] **Step 5: Implement hot-lead notification service**
Use `atendimento.enviarMensagemDireta` only. Resolve recipient as assigned active user phone, else first active Owner/Admin phone, else create task + log `hot_lead_notification_skipped`. Do not call `sendWhatsAppMessage` from Comercial.
- [ ] **Step 6: Replace Atendimento legacy lead capture**
`webhook-processor-service.ts` stops importing:
- `@/services/leads/leads.service`
- `@/repositories/leads`
It calls `comercial.capturarLead` through Action Layer/system context.
- [ ] **Step 7: Verify**
Run:
```bash
npx jest src/modules/comercial/services src/modules/atendimento --runInBand
npm run typecheck
```
- [ ] **Step 8: Commit**
```bash
git add src/modules/comercial src/modules/atendimento/actions src/modules/atendimento/services/webhook-processor-service.ts
git commit -m "feat(comercial): connect cross module bridges"
```
---
## Task 6 — UI/menu wiring
**Files:**
- Modify: `src/lib/ui/sidebar.tsx`
- Modify: `src/app/dashboard/leads/**`
- Modify: `src/app/dashboard/crm/pipeline/page.tsx`
- Modify: `src/app/dashboard/pipeline/page.tsx` (only if present/used)
- Test: focused UI/snapshot if components changed
- [ ] **Step 1: RED menu test**
Add/extend module menu test proving Leads/Pipeline come from `comercialManifest` when enabled and are hidden when disabled.
- [ ] **Step 2: Remove static entries**
Remove static Leads/Pipeline items from `sidebar.tsx`; use manifest-driven menu.
- [ ] **Step 3: Preserve canonical route**
`/dashboard/crm/pipeline` remains canonical. If `/dashboard/pipeline` is used, make it redirect to `/dashboard/crm/pipeline`.
- [ ] **Step 4: Verify UI compile**
Run:
```bash
npx jest src/lib/ui src/modules/comercial --runInBand
npm run typecheck
```
- [ ] **Step 5: Commit**
```bash
git add src/lib/ui/sidebar.tsx src/app/dashboard src/modules/comercial
git commit -m "feat(comercial): wire menu and dashboard routes"
```
---
## Task 7 — Legacy cleanup + final verification
**Files:**
- Remove/adapt: `src/services/leads/leads.service.ts`
- Remove/adapt: `src/services/leads/lead-notification.service.ts`
- Remove/adapt: `src/services/pipeline/stages.service.ts`
- Remove/adapt: `src/repositories/leads/index.ts`
- Remove/adapt: `src/repositories/pipeline/index.ts`
- Update imports across repo
- [ ] **Step 1: RED forbidden import check**
Run:
```bash
rg "@/services/leads|@/repositories/leads|@/services/pipeline|@/repositories/pipeline" src
```
Expected before cleanup: matches remain.
- [ ] **Step 2: Replace or remove legacy files**
If no consumers remain, delete files. If public compatibility is needed, leave a thin deprecated re-export only if all logic delegates to `src/modules/comercial`.
- [ ] **Step 3: Full verification**
Run:
```bash
npm run typecheck
npx jest --verbose src/modules/comercial src/modules/atendimento src/modules/operacional
npm run test:integration
```
Expected:
- typecheck exit 0
- focused Jest exit 0
- integration exit 0; residual DBC-1 warning acceptable only if same documented Jest open-handle warning appears
- [ ] **Step 4: Boundary check**
Run:
```bash
npm run lint
rg "getDb\(" src/modules/comercial/actions src/app/api/leads src/app/api/pipeline
```
Expected: lint exit 0; rg no output.
- [ ] **Step 5: Commit**
```bash
git add src docs/superpowers/plans/2026-07-04-eixo2-comercial-modulo-implementation.md
git commit -m "chore(comercial): remove legacy lead pipeline paths"
```
---
## Final acceptance
- [ ] Spec adjustments preserved in `docs/superpowers/specs/2026-07-04-eixo2-comercial-modulo-design.md`.
- [ ] Plan executed task-by-task with RED before production code.
- [ ] Comercial actions visible in Action registry and agent tools.
- [ ] Concurrent same-phone capture persists one lead.
- [ ] Hot lead job gated, system-runner based, and deduped.
- [ ] Hot lead notifications use `atendimento.enviarMensagemDireta`, not `atendimento.enviarMensagem` or direct WhatsApp calls.
- [ ] `agendarAvaliacao` converts only after E-02 schedule success.
- [ ] No route/action bypasses Action Layer.
- [ ] `npm run typecheck`, focused Jest, integration, lint pass or documented pre-existing DBC-1 only.
