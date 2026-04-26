# Phase 04 Plan 02: Installment, Payment Services + Budget Extensions Summary

**Plan:** 04-02
**Phase:** 04 - Patient Records & Finance
**Wave:** 2
**Status:** COMPLETED
**Date:** 2026-04-26
**Commit:** d0b7c4ee

## What Was Built

Implemented installment and payment services with D-09 auto-complete logic and D-11 budget status triggers. Extended budget service to support treatment plan linking.

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/services/installments/installment.service.ts` | Created | Installment service with 6 functions |
| `src/app/api/budgets/[id]/installments/route.ts` | Created | REST API for installments CRUD |
| `src/services/payments/payment.service.ts` | Created | Payment service with D-09/D-11 logic |
| `src/app/api/budgets/[id]/payments/route.ts` | Created | REST API for payments |
| `src/hooks/usePayments.ts` | Created | TanStack Query hooks for payments |
| `src/services/budgets/budget.service.ts` | Modified | Added treatment_plan_id, getBudgetsByTreatmentPlan, getBudgetWithInstallments |
| `src/lib/validations/budget.ts` | Modified | Added treatment_plan_id to schemas |
| `src/app/api/budgets/[id]/route.ts` | Modified | PATCH accepts treatment_plan_id |

## Verification Results

| Task | Verify Command | Result |
|------|----------------|--------|
| Task 1 | `grep -c "createInstallments\|getRemainingBalance" installment.service.ts` | 2 (PASS) |
| Task 2 | `grep -c "recordPayment\|sessions_to_complete" payment.service.ts` | 2 (PASS) |
| Task 3 | `grep -c "treatment_plan_id\|getBudgetWithInstallments" budget.service.ts` | 5 (PASS) |

## Key Implementation Details

### Installment Service Functions
- `createInstallments(budgetId, installments[])` - Batch create per D-08
- `getInstallmentsByBudget(budgetId)` - List with status calculation
- `updateInstallment(id, input)` - Edit before paid
- `deleteInstallment(id)` - Delete unpaid only
- `markInstallmentPaid(id, paymentId)` - Mark paid, link payment
- `getRemainingBalance(budgetId)` - Calculate remaining

### Payment Service (D-09 + D-11)
- Auto-complete formula: `sessions_to_complete = floor(payment_amount / session_cost)`
- `session_cost = budget.final_value / treatment_plan.total_sessions`
- Completes sessions oldest-first via `treatment_plan_items` ordered by `session_number ASC`
- When all installments paid: budget status -> 'converted'

### Budget Extensions
- `treatment_plan_id` added to Budget interface and CreateBudgetInput
- `installments` joined to Budget type
- `getBudgetsByTreatmentPlan(treatmentPlanId)` - One budget per master plan (D-05)
- `getBudgetWithInstallments(budgetId)` - Budget + installments list

## Decisions Made

1. Used 'converted' status as terminal paid state per D-11
2. Installment updates/deletes blocked after payment (not paid status)
3. Payment amount validation: must not exceed remaining balance
4. Auto-complete only triggers when budget has treatment_plan_id set

## Issues Encountered

None - all tasks completed successfully on first attempt.
