# TypeScript Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fazer `npx tsc --noEmit` passar sem quebrar `npm test -- --runInBand` nem `npm run build`.

**Architecture:** atacar por causa-raiz, não por erro isolado. Primeiro corrigir falhas locais de import/props/componentes e contratos óbvios; depois corrigir a camada de tipagem Supabase que gera `never`; por fim alinhar contratos residuais entre services, rotas e testes.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Supabase JS/SSR, Jest.

**Agent Orchestration:** Supervisor-Workers — planner agrupa erros por causa-raiz, coder implementa uma fase por vez, planner revalida com `npx tsc --noEmit` antes de despachar a próxima fase.

---

### Agentic Design Patterns for Plan Execution

Based on 2026 research, the plan header should specify the agent orchestration model:

| Pattern | Best For | Structure |
|---------|----------|-----------|
| **Single-Agent Looped** | Simple features, single file | 1 agent proposes→tests→evaluates→iterates |
| **Supervisor-Workers** | Multiple independent sub-tasks | 1 supervisor delegates to N workers |
| **Hierarchical** | Large decomposed projects | Manager→Supervisor→Workers (3+ levels) |
| **Peer-to-Peer** | Collaborative/review tasks | Agents communicate directly |

Default: **Single-Agent Looped** for MVPs, **Supervisor-Workers** for plans with 3+ independent files.

---

## Scope / Non-Goals

- Preservar mudanças locais do usuário em `openspec/config.yaml`, `e2e-results.txt`, `start-coder.bat`, `start-planner.bat`, `src/app/dashboard/atividades/page.tsx`, `src/app/dashboard/tarefas/page.tsx`.
- Não limpar warnings de lint agora.
- Não investigar open handles do Jest agora.
- Não commitar automaticamente.

## File Structure / Root-Cause Map

### Fase 1 — correções locais e contratos de componentes
- Modify: `src/app/api/patients/[id]/observations/route.ts`
- Modify: `src/app/api/patients/[id]/preferences/route.ts`
- Modify: `src/app/api/treatment-plans/[id]/sessions/route.ts`
- Modify: `src/components/campaigns/campaign-wizard.tsx`
- Modify: `src/components/contacts/contact-financial-tab.tsx`
- Modify: `src/components/contacts/financial-charts.tsx`
- Modify: `src/components/contacts/payment-recorder-dialog.tsx`
- Modify: `src/components/lgpd/lgpd-export-dialog.tsx`
- Modify: `src/components/pipeline/kanban-board.tsx`
- Modify: `src/components/pipeline/stage-column.tsx`
- Modify: `src/components/reports/financial-reports-dashboard.tsx`
- Modify: `src/components/reports/pipeline-analytics-dashboard.tsx`
- Modify: `src/components/whatsapp/template-editor.tsx`
- Modify: `src/lib/hooks/use-queries.ts`
- Possibly create: `src/components/ui/progress.tsx`

### Fase 2 — tipagem Supabase `never` / helpers
- Inspect/modify: `src/lib/supabase/client.ts`
- Inspect/modify: `src/lib/supabase/server.ts`
- Inspect/modify: `src/lib/supabase/typed.ts`
- Inspect/modify: `src/lib/supabase/database.types.ts`
- Inspect any helper use sites: `src/lib/supabase/index.ts`, `src/lib/supabase.ts`
- Modify: `src/app/api/pipeline/stages/route.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/services/pipeline/stages.service.ts`
- Modify: `src/services/pipeline/pipeline-analytics.service.ts`
- Modify: `src/services/leads/leads.service.ts`
- Modify: `src/services/payments/payment.service.ts`
- Modify: `src/services/reports/financial-reports.service.ts`

### Fase 3 — contratos restantes entre rotas/services/tests
- Modify: `src/app/api/treatment-plans/route.ts`
- Modify: `src/services/agent/agent.service.ts`
- Modify: `src/services/agent/decision-log.service.ts`
- Modify: `src/services/agent/smart-triggers.service.ts`
- Modify: `src/services/rag/rag.service.ts`
- Modify: `src/services/reminders/procedure-reminder-config.service.ts`
- Modify: `src/services/reminders/reminder.service.ts`
- Modify: `src/services/reminders/__tests__/reminder.service.test.ts`
- Modify: `src/services/leads/__tests__/lead-notification.service.test.ts`

### Validation
- Run: `npx tsc --noEmit`
- Run: `npm test -- --runInBand`
- Run: `npm run build`

---

### Task 1: Baseline and protect user work

**Files:**
- Modify: none

- [ ] **Step 1: Confirm user-owned local files are untouched**

Run: `git status --short --branch`
Expected: local user files still appear; no new unrelated edits.

- [ ] **Step 2: Capture current TypeScript error baseline**

Run: `npx tsc --noEmit > tmp/tsc-baseline.txt 2>&1 || true`
Expected: `tmp/tsc-baseline.txt` contains the current failing set for regrouping.

---

### Task 2: Fase 1 — imports, props, missing modules, local component contracts

**Files:**
- Modify: `src/app/api/patients/[id]/observations/route.ts`
- Modify: `src/app/api/patients/[id]/preferences/route.ts`
- Modify: `src/app/api/treatment-plans/[id]/sessions/route.ts`
- Modify: `src/components/campaigns/campaign-wizard.tsx`
- Modify: `src/components/contacts/contact-financial-tab.tsx`
- Modify: `src/components/contacts/financial-charts.tsx`
- Modify: `src/components/contacts/payment-recorder-dialog.tsx`
- Modify: `src/components/lgpd/lgpd-export-dialog.tsx`
- Modify: `src/components/pipeline/kanban-board.tsx`
- Modify: `src/components/pipeline/stage-column.tsx`
- Modify: `src/components/reports/financial-reports-dashboard.tsx`
- Modify: `src/components/reports/pipeline-analytics-dashboard.tsx`
- Modify: `src/components/whatsapp/template-editor.tsx`
- Modify: `src/lib/hooks/use-queries.ts`
- Create if missing: `src/components/ui/progress.tsx`

- [ ] **Step 1: Fix missing server Supabase imports in route handlers**

Implementation rule:
- route handlers under `src/app/api/**` that call server Supabase must import `createClient` from `@/lib/supabase/server` and await it.
- do not use browser client helpers in these routes.

Run after edits: `npx tsc --noEmit`
Expected: `Cannot find name 'createClient'` errors disappear from the three route files.

- [ ] **Step 2: Fix invalid component props and local state typing**

Implementation rule:
- remove or replace invalid `loading` prop usage on shared `Button` unless the component type explicitly supports it.
- `setState` callbacks must match declared state type; annotate callback params when implicit `any` appears.
- Recharts formatters must accept the broader `ValueType | undefined` contract.

Run after edits: `npx tsc --noEmit`
Expected: errors in `campaign-wizard.tsx`, chart components, and `template-editor.tsx` reduce/clear.

- [ ] **Step 3: Restore missing UI/module contracts**

Implementation rule:
- if `@/components/ui/progress` is referenced and absent, create the minimal typed component matching existing ui patterns.
- keep API surface minimal: value/max/className only if that satisfies call sites.

Run after edits: `npx tsc --noEmit`
Expected: missing module error for `progress` disappears.

- [ ] **Step 4: Fix localized domain type mismatches**

Implementation rule:
- align `Budget` vs `BudgetDetail` expectations in `contact-financial-tab.tsx`.
- align `RecordPaymentInput` shape in `payment-recorder-dialog.tsx` with the service contract rather than pushing extra fields.
- type pipeline component props explicitly in `kanban-board.tsx` and `stage-column.tsx`; remove `{}`-inferred props and implicit `any`.
- fix `use-queries.ts` assumptions where array results are treated like objects.

Run after edits: `npx tsc --noEmit`
Expected: remaining Fase 1 file errors are gone or isolated to Supabase/systemic issues.

---

### Task 3: Fase 2 — diagnose and fix Supabase `never`

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/supabase/typed.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify as needed: `src/lib/supabase/index.ts`, `src/lib/supabase.ts`
- Modify: `src/app/api/pipeline/stages/route.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/services/pipeline/stages.service.ts`
- Modify: `src/services/pipeline/pipeline-analytics.service.ts`
- Modify: `src/services/leads/leads.service.ts`
- Modify: `src/services/payments/payment.service.ts`
- Modify: `src/services/reports/financial-reports.service.ts`

- [ ] **Step 1: Inspect table definitions actually used by failing files**

Implementation rule:
- verify `pipeline_stages`, `tasks`, report-related tables/relations, and all referenced fields exist in `Database['public']['Tables']` with `Row/Insert/Update` entries.
- if a table or field is missing from generated types but used throughout the app, add the missing type definition conservatively to `database.types.ts` based on actual code usage.

Run: `rg -n "pipeline_stages|tasks|sort_order|final_value|budget_items|converted_at|stage_id" src`
Expected: enough evidence to define missing table/field typings correctly.

- [ ] **Step 2: Normalize client/helper return types**

Implementation rule:
- typed helpers must return a direct `SupabaseClient<Database>`, not a promise-typed alias unless truly async.
- browser helper and server helper names must make sync/async behavior obvious.
- remove ad hoc `as any` chains where they cause table generic inference collapse.

Run after edits: `npx tsc --noEmit`
Expected: service errors about `SupabaseClient` missing `then/catch/finally` disappear.

- [ ] **Step 3: Replace `never`-producing query sites with explicit typed table access**

Implementation rule:
- at failing call sites, use typed payloads derived from `Database['public']['Tables'][Table]['Insert'|'Update'|'Row']`.
- when select payloads include nested relations not expressible from current generated types, define focused local result types instead of poisoning the whole query with `any`.
- do not widen everything to `any`; keep fixes local and explicit.

Run after edits: `npx tsc --noEmit`
Expected: `never` insert/update/select errors in pipeline/leads/payments/reports/tasks disappear.

---

### Task 4: Fase 3 — remaining contracts across routes, services, and tests

**Files:**
- Modify: `src/app/api/treatment-plans/route.ts`
- Modify: `src/services/agent/agent.service.ts`
- Modify: `src/services/agent/decision-log.service.ts`
- Modify: `src/services/agent/smart-triggers.service.ts`
- Modify: `src/services/rag/rag.service.ts`
- Modify: `src/services/reminders/procedure-reminder-config.service.ts`
- Modify: `src/services/reminders/reminder.service.ts`
- Modify: `src/services/reminders/__tests__/reminder.service.test.ts`
- Modify: `src/services/leads/__tests__/lead-notification.service.test.ts`

- [ ] **Step 1: Align treatment plan payloads with required item status**

Implementation rule:
- `treatment_plan_items` payloads must include required properties from `database.types.ts`, especially `status` when required by insert/model contracts.

- [ ] **Step 2: Fix async client contract mismatches in services**

Implementation rule:
- services that expect `Promise<SupabaseClient<...>>` must either await an async factory consistently or accept a direct client consistently; pick one per abstraction and align constructor/field types.

- [ ] **Step 3: Align reminders/template domain contracts**

Implementation rule:
- `AppointmentReminder` test fixtures must include required fields such as `clinicId`.
- `procedure-reminder-config.service.ts` must pass full `MessageTemplate` or a narrower accepted type; do not pass partial objects to full-model APIs.
- `reminder.service.ts` assumptions about nested patient shape must match actual query result types.

- [ ] **Step 4: Fix lead notification test fixtures/mocks to match narrowed types**

Implementation rule:
- update fixture builders so optional vs required fields match `Lead` / notification service expectations.
- if mocked Supabase chains infer `never`, type the mocks explicitly at the boundary instead of spreading `any` through the suite.

Run after edits: `npx tsc --noEmit`
Expected: zero TypeScript errors.

---

### Task 5: Validation

**Files:**
- Modify: none unless validation reveals regressions

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 2: Run tests**

Run: `npm test -- --runInBand`
Expected: test suites remain passing; if Jest warns about open handles but suites pass, record as known out-of-scope issue.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build succeeds. `MINIMAX_API_KEY` warning may remain if env is intentionally absent; record but do not treat as failure.

---

## Self-Review

- Spec coverage: plan covers Fase 1 local fixes, Fase 2 Supabase systemic typing, Fase 3 residual contracts, then validation.
- Placeholder scan: no TODO/TBD steps left; every task maps to specific files and commands.
- Type consistency: uses existing helper names (`createClient`, `createTypedClient`, `Database`) and explicitly warns against broad `any` fallback.
