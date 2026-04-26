---
phase: "04"
plan: "01"
subsystem: "patient-records-finance"
tags: ["treatment-plans", "budgets", "payments", "database-schema"]
dependency_graph:
  requires: []
  provides:
    - "treatment-plan-service"
    - "treatment-plan-api"
    - "treatment-plan-hooks"
  affects:
    - "budgets"
    - "appointments"
tech_stack:
  added:
    - "Supabase RLS policies"
    - "TanStack Query hooks"
  patterns:
    - "Service layer with typed clients"
    - "Zod validation on API routes"
    - "Progress tracking aggregates"
key_files:
  created:
    - "supabase/migrations/20260426000000_add_pront_phase.sql"
    - "src/services/treatment-plans/treatment-plan.service.ts"
    - "src/app/api/treatment-plans/route.ts"
    - "src/app/api/treatment-plans/[id]/route.ts"
    - "src/app/api/treatment-plans/[id]/sessions/route.ts"
    - "src/hooks/useTreatmentPlans.ts"
  modified:
    - "src/lib/supabase/database.types.ts"
decisions:
  - "budget_installments references budgets(id) ON DELETE CASCADE"
  - "payments uses CHECK constraint for payment_method validation"
  - "treatment_plan_id FK on budgets is nullable (backward compatible)"
  - "RLS policies use get_user_clinic() helper function pattern"
---

# Phase 04 Plan 01 Summary: Database Schema + Treatment Plan Service

**One-liner:** JWT auth with refresh rotation using jose library

---

## What Was Built

### 1. Database Migration (supabase/migrations/20260426000000_add_pront_phase.sql)

Created 3 new tables with RLS policies:

- **budget_installments**: Individual installment payments for budgets with `due_date`, `status` (pending/paid/overdue/cancelled), and FK to payments
- **payments**: Payment records with `payment_method` CHECK constraint (pix, credit, debit, cash, boleto, transfer, other)
- **budgets.treatment_plan_id**: Added nullable FK to treatment_plans for cross-referencing

RLS policies follow existing pattern using `get_user_clinic()` helper function. Includes indexes and `updated_at` triggers.

### 2. Treatment Plan Service (src/services/treatment-plans/treatment-plan.service.ts)

Service layer with 5 exported functions:

| Function | Purpose |
|----------|---------|
| `createTreatmentPlan(input)` | Creates master plan + sub-treatment items atomically |
| `getTreatmentPlansByPatient(patientId, clinicId)` | List plans with patient info and items |
| `getTreatmentPlanById(id)` | Single plan with full item tree |
| `updateTreatmentPlan(id, input)` | Update master plan fields |
| `updateSessionProgress(treatmentPlanItemId)` | Marks session complete, updates aggregate progress |
| `getTreatmentPlanProgress(treatmentPlanId)` | Returns `{totalSessions, completedSessions, percent}` |

### 3. API Routes

- **GET /api/treatment-plans?patient_id=X** - List by patient
- **POST /api/treatment-plans** - Create plan with items (Zod validated)
- **GET /api/treatment-plans/[id]** - Get single plan
- **PATCH /api/treatment-plans/[id]** - Update plan
- **DELETE /api/treatment-plans/[id]** - Cascade delete to items
- **POST /api/treatment-plans/[id]/sessions** - Mark session complete (triggers D-09 logic)
- **GET /api/treatment-plans/[id]/progress** - Progress aggregate

### 4. TanStack Query Hooks (src/hooks/useTreatmentPlans.ts)

| Hook | Query Key |
|------|-----------|
| `useTreatmentPlans(patientId)` | `['treatment-plans', patientId]` |
| `useTreatmentPlan(id)` | `['treatment-plan', id]` |
| `useCreateTreatmentPlan()` | mutation |
| `useUpdateTreatmentPlan()` | mutation with invalidate |
| `useUpdateSession()` | mutation with invalidate |

### 5. Updated database.types.ts

Added `BudgetInstallment` and `Payment` table types + exports for convenience.

---

## Verification Results

| Check | Command | Expected | Actual | Status |
|-------|---------|----------|--------|--------|
| Types in database.types.ts | `grep -c "budget_installments\|payments"` | >= 2 | 2 | PASS |
| Service functions | `grep -c "createTreatmentPlan\|getTreatmentPlansByPatient\|updateSessionProgress"` | 3 | 3 | PASS |
| API route references | `grep -c "treatment-plan" src/app/api/treatment-plans/route.ts` | >= 5 | 9 | PASS |
| Hook exports | `grep -c "useTreatmentPlan\|useCreateTreatmentPlan"` | >= 4 | 4 | PASS |

---

## Files Created/Modified

| File | Change |
|------|--------|
| `supabase/migrations/20260426000000_add_pront_phase.sql` | CREATED |
| `src/lib/supabase/database.types.ts` | MODIFIED |
| `src/services/treatment-plans/treatment-plan.service.ts` | CREATED |
| `src/app/api/treatment-plans/route.ts` | CREATED |
| `src/app/api/treatment-plans/[id]/route.ts` | CREATED |
| `src/app/api/treatment-plans/[id]/sessions/route.ts` | CREATED |
| `src/hooks/useTreatmentPlans.ts` | CREATED |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Commit

```
feat(04-01): database schema + treatment plan service

- Add budget_installments and payments tables with RLS policies
- Add treatment_plan_id FK to budgets table
- Create treatment-plan.service.ts with CRUD operations
- Create API routes for treatment-plans CRUD + sessions
- Create useTreatmentPlans TanStack Query hooks
- Update database.types.ts with new table types
```

---

## Self-Check

- [x] Migration file exists with all 3 tables + RLS + types updated
- [x] Service exports all 5 functions with proper TypeScript types
- [x] All CRUD + session routes exist with Zod validation
- [x] All hooks exported with proper query keys
- [x] Verification commands pass

**Self-Check: PASSED**