# Synkroo Roadmap 143 Wave 2 Clinical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar F4–F5 com contratos HTTP/Action uniformes, shell tenant-safe e jornada clínica J-04 completa.

**Architecture:** Primeiro estabilizar contratos e server guards; depois clínica ativa; em seguida migrar um domínio por goal e provar suas jornadas. Routes transportam, Actions aplicam policy, services mantêm invariantes e repositories executam Drizzle tenant-scoped.

**Tech Stack:** Next.js App Router, React 19, Zod, TanStack Query, Zustand, Drizzle/PostgreSQL, Jest, Playwright.

**Agent Orchestration:** Supervisor-Workers — contratos/shell seriais; domínios clínicos paralelizáveis após O2-G01–G03.

---

## Ownership

| Goal | IDs | Dependências |
|---|---|---|
| O2-G01 api-action-contract | F4.01–F4.04, F5.06 | Gate 1 |
| O2-G02 server-shell | F4.05–F4.08 | O2-G01 |
| O2-G03 clinic-switch | F4.09–F4.10 | O2-G01/O2-G02 |
| O2-G04 finance-boundary | F4.11 | O2-G02 |
| O2-G05 patients | F5.01 | O2-G01/O2-G03 |
| O2-G06 dentists-procedures | F5.02 | O2-G01/O2-G03 |
| O2-G07 appointments | F5.03 | O2-G05/O2-G06 |
| O2-G08 waitlist | F5.04 | O2-G07 |
| O2-G09 treatments | F5.05 | O2-G05/O2-G06 |

## Task 1: O2-G01 — Canonical API and Action route migration

**Files:**
- Modify: `src/lib/api/action-route.ts`
- Modify: `src/lib/api/__tests__/action-route.test.ts`
- Modify: response helpers under `src/lib/api/`
- Modify: hooks and routes selected by consumer inventory under `src/app/api/` and `src/hooks/`
- Create: `src/__tests__/contracts/action-route-migration.test.ts`
- Create: `docs/superpowers/audits/o2-g01-api-action-contract.md`

- [ ] **Step 1: Inventory route/hook contracts**

Use semantic search for raw `NextResponse.json`, snake_case response keys, direct service calls in routes, duplicated serializers and hooks reading unenveloped JSON. Save every production call site with owner domain.

- [ ] **Step 2: Add RED migration contract**

The architecture test rejects new non-webhook JSON responses outside canonical `ApiSuccess`/`ApiFailure`, permits raw webhook bodies, and checks request ID on success and failure. Add hook↔endpoint tests for one representative list, detail and mutation before broad migration.

- [ ] **Step 3: Run RED**

```bash
npx jest src/lib/api/__tests__/action-route.test.ts src/__tests__/contracts/action-route-migration.test.ts --runInBand
```

Expected: fail with exact legacy route/consumer paths.

- [ ] **Step 4: Deepen the adapter**

Adapter requirements: parse Zod input; derive trusted auth/clinic/module context; execute one Action; map domain errors to stable HTTP codes; return `{data,meta?}` or `{error:{code,message,requestId}}`; redact unexpected errors; set `x-request-id`.

- [ ] **Step 5: Migrate by vertical slice**

For each selected domain, migrate route + hook + contract test in the same commit. Do not migrate UI before its hook contract passes. Preserve raw-body webhook signature paths.

- [ ] **Step 6: Run GREEN**

```bash
npx jest src/lib/api/__tests__/action-route.test.ts src/__tests__/contracts/action-route-migration.test.ts --runInBand
npm run typecheck
npm run lint
```

Expected: zero contract violation and no snake_case transport drift.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api src/app/api src/hooks src/__tests__/contracts/action-route-migration.test.ts docs/superpowers/audits/o2-g01-api-action-contract.md
git commit -m "refactor(api): standardize action route contracts"
```

## Task 2: O2-G02 — Manifest/RBAC shell and server protection

**Files:**
- Modify: `src/lib/ui/build-menu.ts`
- Modify: `src/lib/ui/sidebar.tsx`
- Modify: module manifests under `src/modules/`
- Modify: `src/app/dashboard/layout.tsx`
- Create: `src/__tests__/architecture/manifest-routes.test.ts`
- Modify: menu/gate tests
- Create: `docs/superpowers/audits/o2-g02-server-shell.md`

- [ ] **Step 1: Write RED manifest route scanner**

Resolve every manifest href against actual `src/app/**/page.tsx`. It must fail for `/dashboard/conversations`, missing `/dashboard/followup`, duplicate IDs and paths unavailable to the declared module.

- [ ] **Step 2: Add server-guard tests**

Cases: unauthenticated request redirects before protected content; missing module/permission returns not-found/forbidden server-side; client JS disabled cannot reveal content; disabled means not contracted, not “coming soon”.

- [ ] **Step 3: Run RED**

```bash
npx jest src/__tests__/architecture/manifest-routes.test.ts src/lib/ui --runInBand
npm run test:e2e:production -- e2e/auth/route-protection.spec.ts
```

Expected: stale paths and client-only layout fail.

- [ ] **Step 4: Repair manifests and server boundary**

Use `/dashboard/conversas`; remove or implement no nonexistent follow-up link; server layout derives session, active clinic, modules and permissions before rendering. Sidebar consumes only filtered manifest output.

- [ ] **Step 5: Run GREEN**

```bash
npx jest src/__tests__/architecture/manifest-routes.test.ts src/lib/ui --runInBand
npm run test:e2e:production -- e2e/auth/route-protection.spec.ts e2e/dashboard/sidebar-navigation.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui src/modules src/app/dashboard/layout.tsx src/__tests__/architecture/manifest-routes.test.ts e2e/auth/route-protection.spec.ts e2e/dashboard/sidebar-navigation.spec.ts docs/superpowers/audits/o2-g02-server-shell.md
git commit -m "security(shell): enforce manifest and server access"
```

## Task 3: O2-G03 — Active clinic switch

**Files:**
- Create: `src/components/clinic/clinic-switcher.tsx`
- Create: `src/hooks/use-active-clinic.ts`
- Create: `src/app/api/clinics/active/route.ts`
- Modify: trusted auth/session context code
- Modify: `src/app/dashboard/layout.tsx`
- Create: `src/components/clinic/__tests__/clinic-switcher.test.tsx`
- Create: `e2e/clinic-switch.spec.ts`
- Create: `docs/superpowers/audits/o2-g03-clinic-switch.md`

- [ ] **Step 1: Add RED server/API tests**

Cases: requested clinic must exist in `userClinicAccess`; single-clinic user receives its only clinic; multi-clinic user can switch; foreign/disabled access rejected; session context changes atomically.

- [ ] **Step 2: Add RED UI/cache tests**

Single-clinic hides switcher. Multi-clinic shows active name. Successful switch cancels/invalidate TanStack queries and clears clinic-scoped Zustand slices before refetch. Role/module differences update sidebar.

- [ ] **Step 3: Run RED**

```bash
npx jest src/components/clinic/__tests__/clinic-switcher.test.tsx src/app/api/clinics/active/route.test.ts --runInBand
npm run test:e2e:production -- e2e/clinic-switch.spec.ts
```

Expected: missing route/component/cache invalidation fails.

- [ ] **Step 4: Implement minimal switch flow**

POST accepts clinic UUID only; context verifies access and increments/refreshes session-compatible clinic context. UI waits for server success before clearing/refetching data; failure retains prior clinic.

- [ ] **Step 5: Run GREEN and adversarial cases**

Add rapid double-switch, revoked access during switch, stale response and cross-role cases. Expected: no data from previous/foreign clinic remains visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/clinic src/hooks/use-active-clinic.ts src/app/api/clinics/active src/app/dashboard/layout.tsx e2e/clinic-switch.spec.ts docs/superpowers/audits/o2-g03-clinic-switch.md
git commit -m "feat(tenancy): add atomic clinic switch"
```

## Task 4: O2-G04 — Remove Pi Finance from Synkroo boundary

**Files:**
- Create: `docs/superpowers/audits/o2-g04-pi-finance-boundary.md`
- Modify/delete only paths proven by inventory as Pi Finance UI/routes/tests inside Synkroo
- Modify: manifests that expose removed routes

- [ ] **Step 1: Inventory exact consumers**

Search names `Pi Finance`, `pi-finance`, finance routes/components that belong to the separate product, imports, nav entries and tests. Distinguish Synkroo’s required dental billing/Asaas scope from the separate Pi Finance product.

- [ ] **Step 2: Prove preservation**

Record separate project/repository path and commit/remote evidence without copying credentials or source into Synkroo.

- [ ] **Step 3: Add RED absence test**

Architecture test rejects imports/routes/manifests of the separate product but allowlists Synkroo billing domain (`budgets`, `installments`, `payments`, `charges`, Asaas).

- [ ] **Step 4: Remove inventoried legacy paths**

Delete only paths listed in Step 1; update consumers in the same change.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
git add src docs/superpowers/audits/o2-g04-pi-finance-boundary.md
git commit -m "refactor(boundary): remove separate pi finance UI"
```

Expected: no broken import/path and Synkroo billing tests remain green.

## Task 5: O2-G05 — Complete patient journey

**Files:**
- Modify: `src/app/api/patients/`
- Modify: `src/services/patients/`
- Modify: patient validation schemas
- Modify: `src/app/dashboard/pacientes/`
- Modify: `e2e/patients/` and patient API specs
- Create: `docs/superpowers/audits/o2-g05-patients.md`

- [ ] **Step 1: Add RED contract/integration cases**

List pagination/search; detail; create; edit; same-clinic normalized duplicate; cross-clinic acceptance; preferences; permission/module/clinic rejection; concurrent duplicate create.

- [ ] **Step 2: Run RED**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/patients-api.spec.ts e2e/patients/list.spec.ts
```

- [ ] **Step 3: Implement/migrate route→Action→service→repository**

Server derives clinic; Zod owns normalization; repository predicates include clinic; duplicate DB violation maps to stable domain error; UI consumes canonical envelope.

- [ ] **Step 4: Run GREEN and mobile journey**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/patients-api.spec.ts e2e/patients.spec.ts e2e/patients/list.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/patients src/services/patients src/lib/validations src/app/dashboard/pacientes e2e/api/patients-api.spec.ts e2e/patients.spec.ts e2e/patients docs/superpowers/audits/o2-g05-patients.md
git commit -m "feat(patients): close tenant patient journey"
```

## Task 6: O2-G06 — Dentist and procedure contracts

**Files:**
- Modify: `src/app/api/dentists/`
- Modify: `src/app/api/procedures/`
- Modify: dentist/procedure services and schemas
- Modify: dashboard pages
- Modify: `e2e/api/dentists-api.spec.ts`
- Modify: `e2e/dentists/list.spec.ts`
- Modify: `e2e/procedures/list.spec.ts`
- Create: `docs/superpowers/audits/o2-g06-dentists-procedures.md`

- [ ] **Step 1: RED contracts**

Test list/detail/create/PATCH/DELETE, foreign clinic, used entity delete conflict, duration positive integer, money parsed server-side as decimal/minor unit and invalid negative/overflow values.

- [ ] **Step 2: Run RED**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/dentists-api.spec.ts e2e/dentists/list.spec.ts e2e/procedures/list.spec.ts
```

- [ ] **Step 3: Implement canonical Actions and UI consumers**

No route contains business rule; deletes fail visibly when referenced; responses use canonical envelope.

- [ ] **Step 4: GREEN and commit**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/dentists-api.spec.ts e2e/dentists/list.spec.ts e2e/procedures/list.spec.ts
git add src/app/api/dentists src/app/api/procedures src/app/dashboard/dentistas src/services src/lib/validations e2e/api/dentists-api.spec.ts e2e/dentists e2e/procedures docs/superpowers/audits/o2-g06-dentists-procedures.md
git commit -m "feat(catalog): complete dentist and procedure contracts"
```

## Task 7: O2-G07 — Appointment conflicts and clinic timezone

**Files:**
- Modify: `src/app/api/appointments/`
- Modify: `src/services/appointments/`
- Modify: appointment schema/repository
- Modify: calendar components/hooks
- Modify: `e2e/api/appointments-api.spec.ts`
- Modify: `e2e/calendar.spec.ts` and calendar specs
- Create: `docs/superpowers/audits/o2-g07-appointments.md`

- [ ] **Step 1: RED DB/race tests**

Two transactions compete for overlapping dentist/time; only one commits. Cases include reschedule, duration, cancellation freeing slot, clinic boundary and DST/clinic timezone formatting.

- [ ] **Step 2: RED calendar contract**

Availability response and calendar UI use UTC storage plus clinic timezone; no hard-coded `America/Sao_Paulo` in domain execution.

- [ ] **Step 3: Implement DB-enforced conflict and timezone source**

Keep PostgreSQL exclusion/constraint as authority; map conflict to stable 409/domain code; derive timezone from persisted clinic settings.

- [ ] **Step 4: GREEN**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/appointments-api.spec.ts e2e/calendar.spec.ts e2e/calendar/date-navigation.spec.ts e2e/calendar/views.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/appointments src/services/appointments src/lib/db src/components/calendar src/hooks e2e/api/appointments-api.spec.ts e2e/calendar.spec.ts e2e/calendar docs/superpowers/audits/o2-g07-appointments.md
git commit -m "feat(appointments): enforce conflict and timezone invariants"
```

## Task 8: O2-G08 — Idempotent waitlist fill

**Files:**
- Modify: waitlist routes/services/repositories
- Modify: `e2e/api/waitlist-api.spec.ts`
- Modify: `e2e/waitlist/list.spec.ts`
- Create: waitlist PostgreSQL race test
- Create: `docs/superpowers/audits/o2-g08-waitlist.md`

- [ ] **Step 1: RED CRUD and race cases**

Test clinic-scoped CRUD, eligibility, concurrent fill for one released slot, repeated fill request and patient already scheduled.

- [ ] **Step 2: Run RED**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/waitlist-api.spec.ts e2e/waitlist/list.spec.ts
```

- [ ] **Step 3: Implement transactional claim**

Lock/claim eligible row and create appointment once in one transaction. Idempotency key returns prior result; losers receive stable conflict/no-longer-available result.

- [ ] **Step 4: GREEN and commit**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/waitlist-api.spec.ts e2e/waitlist/list.spec.ts
git add src e2e/api/waitlist-api.spec.ts e2e/waitlist docs/superpowers/audits/o2-g08-waitlist.md
git commit -m "feat(waitlist): make slot fill idempotent"
```

Before commit, replace broad `git add src` with the exact waitlist paths returned by `git diff --name-only`.

## Task 9: O2-G09 — Treatment ownership and sessions

**Files:**
- Modify: treatment routes/services/repositories
- Modify: `src/services/treatment-plans/__tests__/treatment-plan.service.test.ts`
- Create: treatment PostgreSQL integration tests
- Modify: treatment UI/hooks including `src/hooks/useTreatmentPlans.ts`
- Create: `docs/superpowers/audits/o2-g09-treatments.md`

- [ ] **Step 1: RED route/integration tests**

Test foreign clinic/plan/item, invalid transition, repeated/concurrent session completion, progress counter consistency and permission failures.

- [ ] **Step 2: Run RED**

```bash
npx jest src/services/treatment-plans/__tests__/treatment-plan.service.test.ts --runInBand
npm run test:integration:run
```

- [ ] **Step 3: Implement tenant/plan predicates and idempotent session transition**

One transaction validates item ownership, inserts/updates session once and recalculates progress from durable sessions.

- [ ] **Step 4: GREEN and commit**

```bash
npx jest src/services/treatment-plans/__tests__/treatment-plan.service.test.ts --runInBand
npm run test:integration:run
npm run typecheck
git add src/hooks/useTreatmentPlans.ts src/services/treatment-plans src/app/api docs/superpowers/audits/o2-g09-treatments.md
git commit -m "feat(treatments): enforce plan and session invariants"
```

Stage only treatment route paths under `src/app/api`.

## Task 10: Run Gate 2 and J-04

**Files:**
- Modify: `docs/superpowers/audits/roadmap-143-ledger.json`
- Modify: `docs/goals/roadmap-143-resume.md`
- Create: `docs/superpowers/audits/o2-clinical-gate.md`
- Create/modify: `e2e/journeys/j-04-clinical-cycle.spec.ts`

- [ ] **Step 1: Run J-04**

Journey: authenticated receptionist selects clinic, creates/dedups patient, selects dentist/procedure, books appointment, observes conflict rejection, cancels slot, fills from waitlist once, records treatment session and sees consistent progress.

```bash
npm run test:e2e:production -- e2e/journeys/j-04-clinical-cycle.spec.ts
```

Expected: pass with zero retries.

- [ ] **Step 2: Run wave gate**

```bash
npm run roadmap:check
npm run verify
npm run test:integration:run
npm run build
npm run test:e2e:production
```

Expected: all exit 0; 17 F4–F5 IDs have nominal evidence.

- [ ] **Step 3: Independent review and score**

Review server auth, clinic isolation, API envelope, DB races, timezone and legacy consumers. Required: zero blocker/high and every goal ≥9/10.

- [ ] **Step 4: Commit gate**

```bash
git add e2e/journeys/j-04-clinical-cycle.spec.ts docs/superpowers/audits/roadmap-143-ledger.json docs/goals/roadmap-143-resume.md docs/superpowers/audits/o2-clinical-gate.md
git commit -m "docs(program): close clinical wave gate"
```
