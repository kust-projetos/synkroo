# Eixo 2 — CRM Dedup/Merge Assistido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o slice C do E-04: detecção de duplicados intra-owner, fila de review e merge manual coordenado pelo CRM.

**Architecture:** `owner write/create/update -> detection service -> crm_duplicate_suggestions`; `route/UI -> crm action -> service -> repository -> owner action`. CRM own só sugestões/auditoria; Operacional e Comercial executam merges reais.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Jest.

**Spec:** `docs/superpowers/specs/2026-07-10-eixo2-crm-dedup-merge-design.md`

**Agent Orchestration:** Supervisor-Workers — uma task por worker, planner revisa cada handoff.

---

## Context
- Slice C complementa `docs/superpowers/specs/2026-07-05-eixo2-crm-modulo-design.md`.
- Escopo: `patient↔patient`, `lead↔lead`, merge manual, sem undo, sem auto-merge, sem `lead↔patient`.
- Regras críticas: CAS, `merge_operation_key`, refresh final antes de executar, siblings `stale_after_merge`, owner merge internal-only.

## Stack
| Pkg | Versão | Uso |
|---|---:|---|
| Next.js | 15 | routes + `/dashboard/contatos` |
| React | 19 | queue + duplicate tab |
| TypeScript | 5.6 | actions/contracts |
| Drizzle | repo | schema + repos |
| PostgreSQL | repo | constraints/CAS storage |
| Jest | repo | unit/integration/route/UI tests |

## Architecture
```text
src/modules/crm/
  actions/
  repositories/
  services/
  ui/
  __tests__/
src/modules/operacional/
src/modules/comercial/
```
Rules:
- CRM never writes owner tables.
- Owner merge actions not exposed by route/UI/agent tools.
- All writes scoped by `clinicId`.
- Retry allowed only `failed -> approved`.

## Endpoints
| Route | Result |
|---|---|
| `GET /api/contacts/duplicates` | `crm.listarSugestoesDuplicidade` |
| `GET /api/contacts/duplicates/:id` | `crm.obterSugestaoDuplicidade` |
| `POST /api/contacts/duplicates/:id/approve` | `crm.aprovarSugestaoDuplicidade` |
| `POST /api/contacts/duplicates/:id/dismiss` | `crm.dispensarSugestaoDuplicidade` |
| `POST /api/contacts/duplicates/:id/merge` | `crm.executarMergeLead` or `crm.executarMergePatient` |

## Tests
| Type | Tool | Scope |
|---|---|---|
| Unit | Jest | scoring, thresholds, lifecycle, conflict policy |
| Integration | Jest + DB | CAS, idempotency, FK repoint, sibling invalidation |
| Route | Jest | gated routes, owner merge internal-only |
| Snapshot | Jest | queue + duplicate tab states |
| Mutation | Stryker | scoring/lifecycle target ≥70% |

---

## Task 1 — Schema CRM de sugestões + migration

**Files:**
- Create: `src/modules/crm/schema/duplicates.ts`
- Modify: `src/modules/crm/schema/index.ts`, `src/lib/db/schema/index.ts`
- Create: `src/lib/db/migrations/<timestamp>_crm_duplicate_suggestions.sql`
- Test: `src/modules/crm/__tests__/schema/duplicates-schema.test.ts`

- [ ] **Step 1: Write RED schema test**
```ts
import { crmDuplicateSuggestions } from '@/modules/crm/schema/duplicates';
it('defines duplicate suggestions table columns', () => {
  expect(crmDuplicateSuggestions.status.name).toBe('status');
  expect(crmDuplicateSuggestions.mergeOperationKey.name).toBe('merge_operation_key');
});
```
Run: `npx jest src/modules/crm/__tests__/schema/duplicates-schema.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Create Drizzle schema**
```ts
export const crmDuplicateSuggestions = pgTable('crm_duplicate_suggestions', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull(),
  ownerType: text('owner_type').$type<'patient' | 'lead'>().notNull(),
  leftId: uuid('left_id').notNull(),
  rightId: uuid('right_id').notNull(),
  status: text('status').$type<'pending' | 'approved' | 'executing' | 'merged' | 'failed' | 'dismissed'>().notNull().default('pending'),
  confidence: text('confidence').$type<'medium' | 'high'>().notNull(),
  duplicateScore: integer('duplicate_score').notNull(),
  winnerSuggestedId: uuid('winner_suggested_id'),
  winnerConfirmedId: uuid('winner_confirmed_id'),
  signals: jsonb('signals').notNull(),
  leftSnapshot: jsonb('left_snapshot').notNull(),
  rightSnapshot: jsonb('right_snapshot').notNull(),
  dismissReason: text('dismiss_reason'),
  mergeOperationKey: text('merge_operation_key').unique(),
  failureReason: text('failure_reason'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  executedBy: uuid('executed_by'),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  leftRightCheck: check('crm_dup_left_right_check', sql`${t.leftId} <> ${t.rightId}`),
}));
```

- [ ] **Step 3: Write SQL migration**
```sql
CREATE TABLE crm_duplicate_suggestions (...);
CREATE UNIQUE INDEX crm_dup_pair_canonical_idx ON crm_duplicate_suggestions (
  clinic_id,
  owner_type,
  LEAST(left_id, right_id),
  GREATEST(left_id, right_id)
);
```

- [ ] **Step 4: Add RED DB test for canonical pair uniqueness**
```ts
it('treats (A,B) and (B,A) as the same canonical pair', async () => {
  await insertSuggestion({ leftId: a, rightId: b });
  await expect(insertSuggestion({ leftId: b, rightId: a })).rejects.toThrow();
});
```
Run: `npx jest src/modules/crm/__tests__/schema/duplicates-schema.test.ts --runInBand`
Expected: FAIL until canonical SQL index is applied.

- [ ] **Step 5: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/schema/duplicates-schema.test.ts --runInBand`
Expected: PASS.
Run: `npm run lint -- --file src/modules/crm/schema/duplicates.ts`
Expected: PASS.
Commit: `git add src/modules/crm/schema src/lib/db/schema/index.ts src/lib/db/migrations && git commit -m "feat(crm): add duplicate suggestions schema"`

---

## Task 2 — Permissions + manifest + registry

**Files:**
- Modify: `src/modules/crm/permissions.ts`, `src/modules/crm/manifest.ts`, `src/modules/crm/index.ts`
- Test: `src/modules/crm/__tests__/manifest-duplicates.test.ts`

- [ ] **Step 1: Write RED permission test**
```ts
import { crmPermissions } from '@/modules/crm/permissions';
it('adds duplicate review permissions', () => {
  expect(crmPermissions).toEqual(expect.arrayContaining(['crm:review_duplicates', 'crm:merge_patients', 'crm:merge_leads']));
});
```
Run: `npx jest src/modules/crm/__tests__/manifest-duplicates.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Update permissions/manifest**
```ts
export const crmPermissions = [
  'crm:view',
  'crm:manage_notes',
  'crm:manage_tags',
  'crm:review_duplicates',
  'crm:merge_patients',
  'crm:merge_leads',
] as const;
```

- [ ] **Step 3: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/manifest-duplicates.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/crm && git commit -m "feat(crm): add duplicate review permissions"`

---

## Task 3 — Scoring + detection service + owner write hooks

**Files:**
- Create: `src/modules/crm/services/duplicate-scoring-service.ts`, `duplicate-detection-service.ts`
- Create: `src/modules/crm/repositories/duplicate-suggestions-repository.ts`
- Modify: `src/modules/operacional/actions/criar-paciente.ts`, `src/modules/operacional/actions/atualizar-paciente.ts`
- Modify: `src/modules/comercial/actions/capturar-lead.ts`, `src/modules/comercial/actions/atualizar-lead.ts`
- Test: `src/modules/crm/__tests__/duplicate-scoring-service.test.ts`, `duplicate-detection-service.test.ts`, `owner-write-hooks.test.ts`

- [ ] **Step 1: RED scoring tests**
```ts
it('does not persist suggestions below 70', () => {
  expect(classifyDuplicateScore(69)).toBeNull();
});
it('classifies 72 as medium and 90 as high', () => {
  expect(classifyDuplicateScore(72)).toBe('medium');
  expect(classifyDuplicateScore(90)).toBe('high');
});
```
Run: `npx jest src/modules/crm/__tests__/duplicate-scoring-service.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement scoring helpers**
```ts
export function classifyDuplicateScore(score: number) {
  if (score < 70) return null;
  return score >= 85 ? 'high' : 'medium';
}
```

- [ ] **Step 3: Implement winner suggestion + detection upsert**
```ts
export async function upsertDuplicateSuggestion(input: DetectionInput) {
  const confidence = classifyDuplicateScore(input.score);
  if (!confidence) return null;
  return repo.upsertCanonicalPair({ ...input, confidence });
}
```

- [ ] **Step 4: Write RED owner-write hook tests**
```ts
it('recalculates duplicate suggestions after patient create/update', async () => {
  await createPatientFixture();
  expect(await latestDuplicateSuggestion()).not.toBeNull();
});
it('recalculates duplicate suggestions after lead capture/update', async () => {
  await captureLeadFixture();
  expect(await latestDuplicateSuggestion()).not.toBeNull();
});
```
Run: `npx jest src/modules/crm/__tests__/owner-write-hooks.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 5: Wire detection into owner writes**
```ts
await duplicateDetectionService.recalculateForPatient({ clinicId: ctx.clinicId, patientId: patient.id });
await duplicateDetectionService.recalculateForLead({ clinicId: ctx.clinicId, leadId: lead.id });
```
Apply in `src/modules/operacional/actions/criar-paciente.ts`, `src/modules/operacional/actions/atualizar-paciente.ts`, `src/modules/comercial/actions/capturar-lead.ts`, and `src/modules/comercial/actions/atualizar-lead.ts`.

- [ ] **Step 6: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/duplicate-scoring-service.test.ts src/modules/crm/__tests__/duplicate-detection-service.test.ts src/modules/crm/__tests__/owner-write-hooks.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/crm/services src/modules/crm/repositories src/modules/crm/__tests__ src/modules/operacional/actions src/modules/comercial/actions && git commit -m "feat(crm): add duplicate detection services"`

---

## Task 4 — Review actions + refresh leve

**Files:**
- Create: `src/modules/crm/actions/listar-sugestoes-duplicidade.ts`, `obter-sugestao-duplicidade.ts`, `aprovar-sugestao-duplicidade.ts`, `dispensar-sugestao-duplicidade.ts`
- Modify: `src/modules/crm/actions/index.ts`
- Test: `src/modules/crm/__tests__/duplicate-review-actions.test.ts`

- [ ] **Step 1: RED review action tests**
```ts
it('allows pending -> approved', async () => {
  expect(await approveTransition('pending')).toBe('approved');
});
it('allows failed -> approved only as manual retry', async () => {
  expect(await approveTransition('failed')).toBe('approved');
});
```
Run: `npx jest src/modules/crm/__tests__/duplicate-review-actions.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement refresh + approve/dismiss actions**
```ts
export const aprovarSugestaoDuplicidade = defineAction({
  name: 'crm.aprovarSugestaoDuplicidade',
  module: 'crm',
  requires: 'crm:review_duplicates',
  input: z.object({ id: z.string().uuid() }),
  handler: (input, ctx) => reviewService.approveSuggestion(input.id, ctx),
});
```

- [ ] **Step 3: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/duplicate-review-actions.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/crm/actions src/modules/crm/__tests__/duplicate-review-actions.test.ts && git commit -m "feat(crm): add duplicate review actions"`

---

## Task 5 — Execute actions + CAS + sibling invalidation

**Files:**
- Create: `src/modules/crm/actions/executar-merge-lead.ts`, `executar-merge-patient.ts`
- Create: `src/modules/crm/services/duplicate-execution-service.ts`
- Test: `src/modules/crm/__tests__/duplicate-execution-service.test.ts`

- [ ] **Step 1: RED execution tests**
```ts
it('returns pending when final refresh detects material drift', async () => {
  await expect(executeApprovedSuggestion('drift')).resolves.toMatchObject({ status: 'pending' });
});
it('dismisses when final refresh drops below 70', async () => {
  await expect(executeApprovedSuggestion('low-score')).resolves.toMatchObject({ status: 'dismissed', dismissReason: 'score_below_threshold_before_execution' });
});
it('invalidates siblings after merge', async () => {
  await expect(executeApprovedSuggestion('success')).resolves.toMatchObject({ status: 'merged' });
});
```
Run: `npx jest src/modules/crm/__tests__/duplicate-execution-service.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement CAS/idempotent execution**
```ts
const claimed = await repo.claimApprovedSuggestion(id, generateMergeOperationKey());
if (!claimed) throw new ActionError('conflict', 'Sugestão não elegível para execução.');
```

- [ ] **Step 3: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/duplicate-execution-service.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/crm/actions src/modules/crm/services src/modules/crm/__tests__/duplicate-execution-service.test.ts && git commit -m "feat(crm): add duplicate merge execution flow"`

---

## Task 6 — Operacional merge de pacientes

**Files:**
- Modify: `src/modules/operacional/schema/patients.ts`
- Create: `src/lib/db/migrations/<timestamp>_operacional_patient_soft_merge.sql`
- Create: `src/modules/operacional/actions/mesclar-pacientes.ts`
- Modify: `src/modules/operacional/actions/index.ts`, `src/modules/operacional/repositories/patients-repository.ts`, `src/modules/operacional/index.ts`
- Test: `src/modules/operacional/__tests__/mesclar-pacientes.test.ts`

- [ ] **Step 1: RED patient merge tests**
```ts
it('repoints owner-side patient foreign keys to winner', async () => {
  expect(await mergePatientsFixture()).toMatchObject({ loser: { mergedIntoId: expect.any(String) } });
});
it('repoints patientPreferences, patientRiskScores and patientFeedback to winner', async () => {
  expect(await mergePatientsFixture()).toMatchObject({ repointed: { patientPreferences: 1, patientRiskScores: 1, patientFeedback: 1 } });
});
it('is internal-only and not exported to route/ui/agent tools', async () => {
  expect(isPublicOperacionalAction('operacional.mesclarPacientes')).toBe(false);
  expect(isAgentToolExposed('operacional.mesclarPacientes')).toBe(false);
});
```
Run: `npx jest src/modules/operacional/__tests__/mesclar-pacientes.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Add soft-merge fields to patient schema + migration**
```ts
mergeStatus: text('merge_status').$type<'merged' | null>(),
mergedIntoId: uuid('merged_into_id'),
mergedAt: timestamp('merged_at', { withTimezone: true }),
```
```sql
ALTER TABLE patients ADD COLUMN merge_status text;
ALTER TABLE patients ADD COLUMN merged_into_id uuid;
ALTER TABLE patients ADD COLUMN merged_at timestamptz;
```

- [ ] **Step 3: Implement repository merge**
```ts
await tx.update(patientObservations).set({ patientId: winnerId }).where(eq(patientObservations.patientId, loserId));
await tx.update(appointments).set({ patientId: winnerId }).where(eq(appointments.patientId, loserId));
await tx.update(patientPreferences).set({ patientId: winnerId }).where(eq(patientPreferences.patientId, loserId));
await tx.update(patientRiskScores).set({ patientId: winnerId }).where(eq(patientRiskScores.patientId, loserId));
await tx.update(patientFeedback).set({ patientId: winnerId }).where(eq(patientFeedback.patientId, loserId));
```

- [ ] **Step 4: Soft-merge loser + keep internal-only**
```ts
await tx.update(patients).set({ mergeStatus: 'merged', mergedIntoId: winnerId, mergedAt: new Date() }).where(eq(patients.id, loserId));
```
Use a private/internal registry flag or private export path so `operacional.mesclarPacientes` stays out of public action exports and agent tools.

- [ ] **Step 5: Verify + commit**
Run: `npx jest src/modules/operacional/__tests__/mesclar-pacientes.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/operacional src/lib/db/migrations && git commit -m "feat(operacional): add patient merge action"`

---

## Task 7 — Comercial merge de leads

**Files:**
- Modify: `src/modules/comercial/schema/leads.ts`
- Create: `src/lib/db/migrations/<timestamp>_comercial_lead_soft_merge.sql`
- Create: `src/modules/comercial/actions/mesclar-leads.ts`
- Modify: `src/modules/comercial/actions/index.ts`, `src/modules/comercial/repositories/leads-repository.ts`, `activities-repository.ts`, `tasks-repository.ts`, `src/modules/comercial/index.ts`
- Test: `src/modules/comercial/__tests__/mesclar-leads.test.ts`

- [ ] **Step 1: RED lead merge tests**
```ts
it('moves activities and tasks to winner', async () => {
  expect(await mergeLeadsFixture()).toMatchObject({ winnerId: expect.any(String) });
});
it('marks loser as lost merged_duplicate and clears phoneNormalized', async () => {
  expect(await mergeLeadsFixture()).toMatchObject({ loser: { status: 'lost', lostReason: 'merged_duplicate', phoneNormalized: null } });
});
it('is internal-only and not exported to route/ui/agent tools', async () => {
  expect(isPublicComercialAction('comercial.mesclarLeads')).toBe(false);
  expect(isAgentToolExposed('comercial.mesclarLeads')).toBe(false);
});
```
Run: `npx jest src/modules/comercial/__tests__/mesclar-leads.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Add soft-merge fields to lead schema + migration**
```ts
mergeStatus: text('merge_status').$type<'merged' | null>(),
mergedIntoId: uuid('merged_into_id'),
mergedAt: timestamp('merged_at', { withTimezone: true }),
```
```sql
ALTER TABLE leads ADD COLUMN merge_status text;
ALTER TABLE leads ADD COLUMN merged_into_id uuid;
ALTER TABLE leads ADD COLUMN merged_at timestamptz;
```

- [ ] **Step 3: Implement lead merge**
```ts
await tx.update(leadActivities).set({ leadId: winnerId }).where(eq(leadActivities.leadId, loserId));
await tx.update(tasks).set({ leadId: winnerId }).where(eq(tasks.leadId, loserId));
await tx.update(leads).set({
  mergeStatus: 'merged',
  mergedIntoId: winnerId,
  mergedAt: new Date(),
  status: 'lost',
  lostReason: 'merged_duplicate',
  phoneNormalized: null,
}).where(eq(leads.id, loserId));
```
Use a private/internal registry flag or private export path so `comercial.mesclarLeads` stays out of public action exports and agent tools.

- [ ] **Step 4: Verify + commit**
Run: `npx jest src/modules/comercial/__tests__/mesclar-leads.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/comercial src/lib/db/migrations && git commit -m "feat(comercial): add lead merge action"`

---

## Task 8 — Job de reprocesso

**Files:**
- Create: `src/modules/crm/actions/reprocessar-sugestoes-duplicidade.ts`
- Create: `src/app/api/cron/crm-duplicates/route.ts`
- Test: `src/modules/crm/__tests__/reprocessar-sugestoes-duplicidade.test.ts`

- [ ] **Step 1: RED job tests**
```ts
it('recreates stale suggestions only for active winner + active candidate', async () => {
  expect(await reprocessFixture()).toEqual(expect.objectContaining({ reopened: 1, skippedLosers: 1 }));
});
```
Run: `npx jest src/modules/crm/__tests__/reprocessar-sugestoes-duplicidade.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement system action + gated cron route**
```ts
export async function GET(request: NextRequest) {
  assertCronSecret(request);
  return runCrmSystemAction(reprocessarSugestoesDuplicidade, {});
}
```

- [ ] **Step 3: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/reprocessar-sugestoes-duplicidade.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/crm src/app/api/cron/crm-duplicates && git commit -m "feat(crm): add duplicate reprocess job"`

---

## Task 9 — UI fila global + aba Duplicados

**Files:**
- Create: `src/components/contacts/duplicate-queue-panel.tsx`, `duplicate-tab.tsx`
- Modify: `src/app/dashboard/contatos/page.tsx`, `src/components/contacts/contact-detail-panel.tsx`, `src/lib/hooks/use-queries.ts`
- Test: `src/components/contacts/__tests__/duplicate-queue-panel.test.tsx`, `duplicate-tab.test.tsx`

- [ ] **Step 1: RED UI tests**
```tsx
it('shows duplicate queue entries with score and actions', () => {
  render(<DuplicateQueuePanel suggestions={[fixture]} />);
  expect(screen.getByText('90')).toBeInTheDocument();
});
it('blocks merge CTA when document conflict exists', () => {
  render(<DuplicateTab suggestion={{ ...fixture, blockedByDocumentConflict: true }} />);
  expect(screen.getByRole('button', { name: /merge/i })).toBeDisabled();
});
```
Run: `npx jest src/components/contacts/__tests__/duplicate-queue-panel.test.tsx src/components/contacts/__tests__/duplicate-tab.test.tsx --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement queue and tab**
```tsx
<TabsTrigger value="duplicates">Duplicados</TabsTrigger>
```

- [ ] **Step 3: Verify + commit**
Run: `npx jest src/components/contacts/__tests__/duplicate-queue-panel.test.tsx src/components/contacts/__tests__/duplicate-tab.test.tsx --runInBand`
Expected: PASS.
Commit: `git add src/app/dashboard/contatos src/components/contacts src/lib/hooks/use-queries.ts && git commit -m "feat(crm): add duplicate review ui"`

---

## Task 10 — Hardening + route adapters + verification

**Files:**
- Create: `src/app/api/contacts/duplicates/route.ts`, `src/app/api/contacts/duplicates/[id]/route.ts`, `src/app/api/contacts/duplicates/[id]/approve/route.ts`, `dismiss/route.ts`, `merge/route.ts`
- Modify: `src/modules/crm/ui/route-adapter.ts`
- Test: `src/modules/crm/__tests__/duplicate-routes.test.ts`

- [ ] **Step 1: RED route tests**
```ts
it('returns 403 when merge permission missing', async () => {
  const response = await POST(mockRequest('POST', 'http://localhost/api/contacts/duplicates/id/merge'));
  expect(response.status).toBe(403);
});
it('does not expose owner merge actions by route or public agent registry', async () => {
  expect(routeExists('/api/operacional/mesclar-pacientes')).toBe(false);
  expect(routeExists('/api/comercial/mesclar-leads')).toBe(false);
  expect(isAgentToolExposed('operacional.mesclarPacientes')).toBe(false);
  expect(isAgentToolExposed('comercial.mesclarLeads')).toBe(false);
});
```
Run: `npx jest src/modules/crm/__tests__/duplicate-routes.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement CRM routes only**
```ts
export const POST = withModuleRoute('crm', crmManifest)(async (request) => runCrmAction(executarMergePatient, await request.json()));
```

- [ ] **Step 3: Full verification**
Run: `npx jest src/modules/crm/__tests__/schema/duplicates-schema.test.ts src/modules/crm/__tests__/duplicate-scoring-service.test.ts src/modules/crm/__tests__/duplicate-detection-service.test.ts src/modules/crm/__tests__/duplicate-review-actions.test.ts src/modules/crm/__tests__/duplicate-execution-service.test.ts src/modules/crm/__tests__/reprocessar-sugestoes-duplicidade.test.ts src/modules/crm/__tests__/duplicate-routes.test.ts src/modules/operacional/__tests__/mesclar-pacientes.test.ts src/modules/comercial/__tests__/mesclar-leads.test.ts src/components/contacts/__tests__/duplicate-queue-panel.test.tsx src/components/contacts/__tests__/duplicate-tab.test.tsx --runInBand`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: PASS.
Commit: `git add src docs/superpowers/specs/2026-07-10-eixo2-crm-dedup-merge-design.md docs/superpowers/plans/2026-07-10-eixo2-crm-dedup-merge-implementation.md && git commit -m "feat(crm): complete duplicate merge slice"`

---

## Spec coverage
| Requirement | Covered by |
|---|---|
| REQ-CRM-MRG-01..04 | Tasks 3, 6, 7, 8 |
| REQ-CRM-MRG-05..07 | Tasks 4, 5, 9, 10 |
| REQ-CRM-MRG-08..09 | Tasks 5, 8 |
| REQ-CRM-MRG-10..11 | Tasks 6, 7, 9 |
| REQ-CRM-MRG-12 | Task 9 |

## Verification checklist
- [ ] `crm_duplicate_suggestions` criada com constraints canônicas
- [ ] `crm:review_duplicates`, `crm:merge_patients`, `crm:merge_leads` registradas
- [ ] retry `failed -> approved` testado
- [ ] refresh final antes da execução testado
- [ ] `approved -> pending` por drift material testado
- [ ] `approved -> dismissed` por `<70` testado
- [ ] sibling invalidation `stale_after_merge` testada
- [ ] patient FK repoint testado
- [ ] lead loser final `lost + merged_duplicate + phoneNormalized=null` testado
- [ ] owner merge actions internal-only/not exposed testadas
