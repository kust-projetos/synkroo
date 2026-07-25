# E03 Cron Actions Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Steps use checkbox syntax.

**Goal:** Execute E03 cron tasks through tenant-scoped Follow-up actions and validate manual feedback ownership.

**Architecture:** Services accept an explicit clinic id. User and cron callers reach them only through `runAction`. The cron builds a narrowly allowlisted context per non-deleted clinic and returns per-task/per-clinic outcomes.

**Tech Stack:** Next.js 15, TypeScript, Drizzle, PostgreSQL, Jest, Zod.

**Agent Orchestration:** Supervisor-Workers — sequential implementation plus mandatory read-only review.

## Guardrails

- Do not call `action.handler` directly.
- Do not use `buildSystemContext`, a fictitious clinic id, or `can: () => true`.
- Do not modify Agents SDK, UI, database schema, or the hot-leads flow.
- Do not stage the untracked audit or preserved Security plan.

## File map

| Task | Files |
|---|---|
| 1 | `src/services/followup/followup.service.ts`, `src/modules/followup/services/followup-service.ts`, action/service tests |
| 2 | `src/services/followup/inactive-patient.service.ts`, `src/modules/followup/services/inactive-service.ts`, tests |
| 3 | `src/services/followup/campaign.service.ts`, `src/modules/followup/services/campaign-service.ts`, tests |
| 4 | `src/repositories/followup/index.ts`, `src/modules/followup/services/followup-service.ts`, `actions/registrar-followup.ts`, tests |
| 5 | `src/core/actions/context.ts`, context tests |
| 6 | `src/app/api/cron/followups/route.ts`, cron tests |
| 7 | focused tests and typecheck |

### Task 1: Scope post-consultation and return reminders

**Files:** Modify `src/services/followup/followup.service.ts`, `src/modules/followup/services/followup-service.ts`, `src/modules/followup/actions/executar-followup.ts`; test `src/modules/followup/services/__tests__/followup-service.test.ts` and create `src/modules/followup/actions/__tests__/executar-followup.test.ts`.

- [ ] **Step 1: Write RED service tests**

```ts
it('forwards ctx clinicId to post-consultation processing', async () => {
  await service.executarPostConsulta('clinic-a');
  expect(legacy.processPostConsultationFollowUps).toHaveBeenCalledWith('clinic-a');
});

it('forwards ctx clinicId to return reminders', async () => {
  await service.executarLembretesRetorno('clinic-a');
  expect(legacy.processReturnReminders).toHaveBeenCalledWith('clinic-a');
});
```

- [ ] **Step 2: Verify RED**

Run: `cmd.exe /c npx jest --runTestsByPath src/modules/followup/services/__tests__/followup-service.test.ts --runInBand`  
Expected: FAIL because service functions accept no clinic id.

- [ ] **Step 3: Implement minimal tenant scope**

Add required `clinicId: string` parameters to legacy candidate/process functions. Add `eq(appointments.clinicId, clinicId)` to follow-up candidates; add `eq(patients.clinicId, clinicId)` to return candidates. Make fallback `getFollowUpConfig` include `eq(followUpConfigs.clinicId, clinicId)`. Pass `ctx.clinicId` through `executarFollowup` to every bridge call. Add an action test with context `clinicId:'clinic-a'` asserting `service.executarAll('clinic-a')`.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/followup/followup.service.ts src/modules/followup/services/followup-service.ts src/modules/followup/actions/executar-followup.ts src/modules/followup/services/__tests__/followup-service.test.ts
git commit -m "fix(followup): scope reminder processing by clinic"
```

### Task 2: Scope inactivity processing

**Files:** Modify `src/services/followup/inactive-patient.service.ts`, `src/modules/followup/services/inactive-service.ts`, `src/modules/followup/actions/detectar-inativos.ts`; test `src/modules/followup/services/__tests__/inactive-service.test.ts` and create `src/modules/followup/actions/__tests__/detectar-inativos.test.ts`.

- [ ] **Step 1: Write RED test**

```ts
it('forwards clinicId to inactivity detection', async () => {
  await service.runInactivityDetection('clinic-a');
  expect(legacy.runInactivityDetection).toHaveBeenCalledWith('clinic-a');
});
```

- [ ] **Step 2: Verify RED**

Run: `cmd.exe /c npx jest --runTestsByPath src/modules/followup/services/__tests__/inactive-service.test.ts --runInBand`  
Expected: FAIL because the bridge takes no clinic id.

- [ ] **Step 3: Implement minimal tenant scope**

Make legacy `runInactivityDetection(clinicId)` process only that clinic. In `updateInactivePatientTags`, select and update rows with both `patients.id` and `patients.clinicId`. Pass `ctx.clinicId` from `detectarInativos`. Add an action test asserting `service.runInactivityDetection('clinic-a')` for a context with that clinic.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/followup/inactive-patient.service.ts src/modules/followup/services/inactive-service.ts src/modules/followup/actions/detectar-inativos.ts src/modules/followup/services/__tests__/inactive-service.test.ts
git commit -m "fix(followup): scope inactivity processing by clinic"
```

### Task 3: Make campaign invocation tenant-explicit

**Files:** Modify `src/services/followup/campaign.service.ts`, `src/modules/followup/services/campaign-service.ts`, `src/modules/followup/actions/executar-campanhas.ts`; test `src/modules/followup/services/__tests__/campaign-service.test.ts` and create `src/modules/followup/actions/__tests__/executar-campanhas.test.ts`.

- [ ] **Step 1: Write RED test**

```ts
it('forwards clinicId to scheduled campaign processing', async () => {
  await service.executarCampanhas('clinic-a');
  expect(legacy.processScheduledCampaigns).toHaveBeenCalledWith('clinic-a');
});
```

- [ ] **Step 2: Verify RED**

Run: `cmd.exe /c npx jest --runTestsByPath src/modules/followup/services/__tests__/campaign-service.test.ts --runInBand`  
Expected: FAIL because campaign bridge takes no clinic id.

- [ ] **Step 3: Implement minimal behavior**

Require `clinicId` in both bridge and legacy `processScheduledCampaigns`. Keep it a no-op and log `{ clinicId }`; do not add campaign dispatch logic. Pass `ctx.clinicId` from the action. Add an action test asserting `service.executarCampanhas('clinic-a')` for that context.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/followup/campaign.service.ts src/modules/followup/services/campaign-service.ts src/modules/followup/actions/executar-campanhas.ts src/modules/followup/services/__tests__/campaign-service.test.ts
git commit -m "refactor(followup): make campaign cron scope explicit"
```

### Task 4: Validate feedback ownership behind the module service

**Files:** Modify `src/repositories/followup/index.ts`, `src/modules/followup/services/followup-service.ts`, `src/modules/followup/actions/registrar-followup.ts`; create `src/modules/followup/services/__tests__/registrar-followup.test.ts`; modify `src/modules/followup/__tests__/followup/integration.test.ts`.

- [ ] **Step 1: Write RED tests**

```ts
await expect(service.registrarFeedback({ clinicId: 'clinic-a', patientId: 'patient-b', feedbackType: 'post_consultation' }))
  .rejects.toMatchObject({ code: 'not_found' });
await expect(service.registrarFeedback({ clinicId: 'clinic-a', patientId: 'patient-a', appointmentId: 'appointment-b', feedbackType: 'post_consultation' }))
  .rejects.toMatchObject({ code: 'not_found' });
```

- [ ] **Step 2: Verify RED**

Run: `cmd.exe /c npx jest --runTestsByPath src/modules/followup/services/__tests__/registrar-followup.test.ts --runInBand`  
Expected: FAIL because `registrarFeedback` does not exist.

Add the integration cases to the existing integration file, but run them only with:
```bat
cmd.exe /c npm run test:integration:run -- src/modules/followup/__tests__/followup/integration.test.ts
```

- [ ] **Step 3: Implement ownership validation**

Repository functions query patients by `id + clinicId`; when supplied, query appointments by `id + clinicId + patientId`. Return null on absence. Module service translates null to `ActionError('not_found', ...)`, then calls `createFeedback`. The action imports only module service and preserves feedback input fields; do not add `scheduledAt`.

```ts
jest.mock('../followup-service', () => ({ registrarFeedback: jest.fn() }));
it('passes the authenticated clinic and feedback fields to the module service', async () => {
  await runAction(registrarFollowup, { patientId: PATIENT_ID, feedbackType: 'post_consultation' }, ctx);
  expect(service.registrarFeedback).toHaveBeenCalledWith(expect.objectContaining({ clinicId: CLINIC_ID, patientId: PATIENT_ID }));
});
```

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command with `RUN_INTEGRATION_TESTS=1` and `npm run test:integration:run --` when PostgreSQL is available. Expected: PASS; otherwise record DB blocker without altering infrastructure.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/followup/index.ts src/modules/followup/services/followup-service.ts src/modules/followup/actions/registrar-followup.ts src/modules/followup/__tests__/followup/integration.test.ts
git commit -m "fix(followup): validate feedback tenant ownership"
```

### Task 5: Create trusted cron context

**Files:** Modify `src/core/actions/context.ts`; test `src/core/actions/__tests__/context.test.ts`.

- [ ] **Step 1: Write RED test**

```ts
const ctx = await buildCronContext('clinic-a', { manifest: { enabledModules: async () => new Set(['followup']) } });
expect(ctx.source).toBe('system');
expect(ctx.can('followup:manage_followups')).toBe(true);
expect(ctx.can('followup:manage_campaigns')).toBe(true);
expect(ctx.can('financeiro:view')).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `cmd.exe /c npx jest --runTestsByPath src/core/actions/__tests__/context.test.ts --runInBand`  
Expected: FAIL because `buildCronContext` does not exist.

- [ ] **Step 3: Implement minimal explicit context**

Export async `buildCronContext(clinicId)`. It loads enabled modules from the manifest, has source `system`, real clinic id, audit actor `cron`, and `can` based only on `new Set(['followup:manage_followups', 'followup:manage_campaigns'])`. It must not load Agent-role permissions or accept caller-supplied permissions.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/actions/context.ts src/core/actions/__tests__/context.test.ts
git commit -m "feat(actions): add allowlisted cron context"
```

### Task 6: Route cron through actions per active clinic

**Files:** Modify `src/app/api/cron/followups/route.ts`; create `src/app/api/cron/followups/route.test.ts`; keep `src/modules/followup/__tests__/cron/integration.test.ts` for DB gate coverage only.

- [ ] **Step 1: Write RED route tests**

In `src/app/api/cron/followups/route.test.ts`, mock `getDb().select().from().where()` with clinics `[{ id:'clinic-a' }, { id:'clinic-b' }]` (the route query contains `isNull(clinics.deletedAt)`), mock `buildCronContext` and `runAction`.

```ts
it('runs followups once per active clinic and isolates an action failure', async () => {
  mockRunAction.mockResolvedValueOnce({ ok: true, data: { processed: 1 } })
    .mockResolvedValueOnce({ ok: false, error: { message: 'clinic-b failed' } });
  const response = await POST(makeCronReq(SECRET, 'followups'));
  expect(mockRunAction).toHaveBeenCalledTimes(2);
  expect(await response.json()).toMatchObject({ results: {
    followups: [
      { task: 'followups', clinicId: 'clinic-a', ok: true, data: { processed: 1 } },
      { task: 'followups', clinicId: 'clinic-b', ok: false, error: 'clinic-b failed' },
    ],
  }});
});
```

Add a task-filter test asserting `tasks=campaigns` invokes only `executarCampanhas`, and assert the mocked query never returns/delegates a deleted clinic.

- [ ] **Step 2: Verify RED**

Run: `cmd.exe /c npx jest --runTestsByPath src/app/api/cron/followups/route.test.ts --runInBand`  
Expected: FAIL because the route invokes services directly and returns string statuses. Keep the existing `cron/integration.test.ts` DB-only and run it via `npm run test:integration:run --`.

- [ ] **Step 3: Implement minimal route migration**

Select `clinics.id` where `deletedAt IS NULL`. Map tasks to action + exact permission: followups/inactivity use `followup:manage_followups`; campaigns uses `followup:manage_campaigns`. For every active clinic call `buildCronContext` then `runAction`. Append the specified result object and continue on action/result failures. Preserve auth, rate-limit, module-disabled response, task filter, GET health check and existing hot-leads branch.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/followups/route.ts src/modules/followup/__tests__/cron
git commit -m "refactor(followup): run cron tasks through actions"
```

### Task 7: Focused verification

- [ ] **Step 1: Run unit/route gates**

```bat
cmd.exe /c npx jest src/modules/followup src/core/actions/__tests__/context.test.ts --runInBand
cmd.exe /c npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 2: Run integration gate when PostgreSQL is available**

```bat
cmd.exe /c npm run test:integration:run -- src/modules/followup/__tests__/cron/integration.test.ts src/modules/followup/__tests__/followup/integration.test.ts
```
Expected: PASS. If the DB remains unavailable, report the exact startup/seed failure and do not modify DB infrastructure.

- [ ] **Step 3: Static boundary check**

```bat
cmd.exe /c rg "executarAll|runInactivityForCron|runCampaignsForCron" src/app/api/cron/followups/route.ts
```
Expected: no matches.

- [ ] **Step 4: Commit only verification-owned changes**

```bash
git status --short
git commit -m "test(followup): verify tenant-scoped cron actions"
```
Do not commit when Task 7 changed no files.

## Exact test contracts

### Action forwarding (Tasks 1–3)

Each new action test uses the same pattern, with its matching action/service method:

```ts
jest.mock('../../services/followup-service', () => ({ executarAll: jest.fn() }));
const ctx = { source: 'system' as const, clinicId: 'clinic-a', can: () => true, hasModule: () => true, audit: { actor: 'test' } };
it('forwards the context clinic to its service', async () => {
  await executarFollowup.handler({ type: 'all' }, ctx as any);
  expect(service.executarAll).toHaveBeenCalledWith('clinic-a');
});
```

Use the same assertion for `detectarInativos`/`runInactivityDetection` and `executarCampanhas`/`executarCampanhas`. Run each service and action pair with `npx jest --runTestsByPath <service-test> <action-test> --runInBand`.

### Feedback unit boundary (Task 4)

```ts
jest.mock('@/repositories/followup', () => ({ findPatientForClinic: jest.fn(), findAppointmentForClinicPatient: jest.fn(), createFeedback: jest.fn() }));
it('rejects a foreign patient before insert', async () => {
  repo.findPatientForClinic.mockResolvedValue(null);
  await expect(registrarFeedback({ clinicId: 'clinic-a', patientId: 'patient-b', feedbackType: 'post_consultation' })).rejects.toMatchObject({ code: 'not_found' });
  expect(repo.createFeedback).not.toHaveBeenCalled();
});
```

Foreign/mismatched appointment assertions stay in the integration runner only.

### Cron context and result shape (Tasks 5–6)

`buildCronContext(clinicId: string, deps?: { manifest?: ManifestLike })` is async, accepts only injectable manifest dependencies, and has an immutable two-key Follow-up allowlist. The route response has exactly `results: Array<{ task: string; clinicId: string; ok: boolean; data?: unknown; error?: string }>`.

Route unit tests mock the chained active-clinic query to return only `clinic-a` and `clinic-b`, mock `buildCronContext` and `runAction`, and assert this exact result:

```ts
expect(body.results).toEqual([
  { task: 'followups', clinicId: 'clinic-a', ok: true, data: { processed: 1 } },
  { task: 'followups', clinicId: 'clinic-b', ok: false, error: 'clinic-b failed' },
]);
```

A second test sends `tasks=campaigns` and asserts only campaign action calls. The mocked DB input includes a deleted clinic but the route query must select with `isNull(clinics.deletedAt)`, so no context/action call occurs for it.

## Self-review

- Spec requirements map to Tasks 1–6: tenant predicates, allowlisted cron context, active clinic enumeration, isolated result shape, manual feedback ownership, and preserved no-op campaigns.
- Every production change starts with a focused RED test and ends GREEN.
- No placeholder implementation, fictitious clinic, direct handler call or generic system permission bypass is allowed.
