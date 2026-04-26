# Phase 4 Plan: Patient Records & Finance

**Phase:** 04
**Slug:** patient-records-finance
**Goal:** Multi-session treatment plans with progress tracking + financial workflows (budgets, payment plans, payment recording, financial summary)

## Source Audit

| Source | Items | Covered |
|--------|-------|---------|
| ROADMAP.md Goal | 4 success criteria | YES |
| REQUIREMENTS.md PRONT | PRONT-01 through PRONT-06 | YES |
| RESEARCH.md Features | treatment plan service, installment service, payment service, financial summary | YES |
| CONTEXT.md D-01..D-19 | All locked decisions | YES |

---

## Wave Structure

| Wave | Plans | Focus | Files Modified |
|------|-------|-------|----------------|
| 1 | 04-01 | Database schema extensions + Treatment Plan service | 6 files |
| 2 | 04-02 | Installment & Payment services + Budget extensions | 5 files |
| 3 | 04-03 | Financial Summary UI (contact tab + charts) | 6 files |

**Rationale:** Schema changes must precede services. Services must precede UI. No intra-wave conflicts.

---

## Multi-Source Coverage

### Goal (ROADMAP.md)
- Multi-session treatment plans with visual progress tracking
- Budgets with itemized procedures and payment plans
- Payment recording with auto session-complete
- Financial summary per patient (billed/paid/owed)

### Requirements (PRONT-01..PRONT-06)
- PRONT-01, PRONT-02: Treatment plan CRUD + session progress
- PRONT-03: Budget with itemized procedures
- PRONT-04: Payment plans (installments)
- PRONT-05: Payment recording + balance tracking
- PRONT-06: Financial summary tab in contact profile

### Decisions (D-01..D-19) — All Implemented
- D-01: Master plan with sub-treatments (via treatment_plan_id FK in budget)
- D-02: Sessions tracked per sub-treatment (treatment_plan_items)
- D-03: Multiple practitioners (practitioner_id in treatment_plan_items)
- D-04: Visual progress indicators (per sub-treatment + aggregate)
- D-05: One budget per master plan
- D-06: Budget includes items with costs
- D-08: Installment amounts manual
- D-09: Sessions auto-complete proportionally on payment
- D-10: Payment method recorded
- D-11: Budget accepted when fully paid
- D-12: Financial summary in contact profile tab
- D-13: Summary shows billed/paid/owed per plan
- D-14: Links to budget detail and payment history
- D-17: Two-column budget layout
- D-18: Horizontal bar charts (Recharts)
- D-19: Installment generator + manual edit

---

## Plan 04-01: Database Schema + Treatment Plan Service

**Wave:** 1
**Type:** execute
**Autonomous:** true
**Depends on:** []
**Files modified:** supabase/migrations/, src/lib/supabase/database.types.ts, src/services/treatment-plans/, src/app/api/treatment-plans/, src/hooks/

```typescript
// Key interfaces created by this plan

interface TreatmentPlan {
  id: string
  clinic_id: string
  patient_id: string
  title: string
  description: string | null
  total_sessions: number
  completed_sessions: number
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  practitioner_id: string | null  // principal practitioner
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface TreatmentPlanItem {
  id: string
  treatment_plan_id: string
  procedure_id: string | null
  procedure_name: string
  session_number: number
  practitioner_id: string | null  // per-session practitioner
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

// Budget extended with treatment_plan_id FK
interface Budget {
  // ... existing fields ...
  treatment_plan_id: string | null  // NEW: links to master plan per D-05
}
```

### Task 1: Database Migration — Installments, Payments, Budget FK

**Files:** `supabase/migrations/20260426000000_add_pront_phase.sql`, `src/lib/supabase/database.types.ts`

**Action:** Create migration with:
1. `budget_installments(id, budget_id, amount, due_date, status, paid_at, payment_id)`
2. `payments(id, budget_id, amount, payment_method, paid_at, notes, created_by)`
3. Add `treatment_plan_id` FK to `budgets` table
4. Add RLS policies for new tables
5. Add check constraint for payment_method: `CHECK (payment_method IN ('pix', 'credit', 'debit', 'cash', 'boleto', 'transfer', 'other'))`
6. Update database.types.ts with new types

**Verify:**
```bash
grep -c "budget_installments\|payments" src/lib/supabase/database.types.ts
# Must return: 2
```

**Done:** Migration file exists with all 3 tables + RLS + types updated

---

### Task 2: Treatment Plan Service

**Files:** `src/services/treatment-plans/treatment-plan.service.ts`

**Action:** Create service with:
- `createTreatmentPlan(input)` — creates master plan + sub-treatment items
- `getTreatmentPlansByPatient(patientId, clinicId)` — list with progress aggregate
- `getTreatmentPlanById(id)` — single plan with items
- `updateTreatmentPlan(id, input)` — update master plan
- `updateSessionProgress(treatmentPlanItemId, status)` — per-session update
- `getTreatmentPlanProgress(treatmentPlanId)` — returns `{totalSessions, completedSessions, percent}`

**Verify:**
```bash
grep -c "createTreatmentPlan\|getTreatmentPlansByPatient\|updateSessionProgress" src/services/treatment-plans/treatment-plan.service.ts
# Must return: 3
```

**Done:** Service exports all 5 functions with proper TypeScript types

---

### Task 3: Treatment Plan API Routes

**Files:** `src/app/api/treatment-plans/route.ts`, `src/app/api/treatment-plans/[id]/route.ts`, `src/app/api/treatment-plans/[id]/sessions/route.ts`

**Action:** Create routes:
- `GET /api/treatment-plans?patient_id=X` — list by patient
- `POST /api/treatment-plans` — create plan with items
- `GET /api/treatment-plans/[id]` — get single plan
- `PATCH /api/treatment-plans/[id]` — update plan
- `DELETE /api/treatment-plans/[id]` — delete plan (cascades to items)
- `POST /api/treatment-plans/[id]/sessions` — update session status (triggers D-09 logic when called from payment flow)
- `GET /api/treatment-plans/[id]/progress` — get progress aggregate

All routes use Zod validation, Supabase auth, proper error handling.

**Verify:**
```bash
grep -c "treatment-plan" src/app/api/treatment-plans/route.ts
# Must return: >= 5
```

**Done:** All CRUD + session routes exist with Zod validation

---

### Task 4: useTreatmentPlans Hook

**Files:** `src/hooks/useTreatmentPlans.ts`

**Action:** Create TanStack Query hooks:
- `useTreatmentPlans(patientId)` — `['treatment-plans', patientId]`
- `useTreatmentPlan(id)` — `['treatment-plan', id]`
- `useCreateTreatmentPlan()` — mutation
- `useUpdateTreatmentPlan()` — mutation
- `useUpdateSession()` — mutation with invalidate

**Verify:**
```bash
grep -c "useTreatmentPlan\|useCreateTreatmentPlan" src/hooks/useTreatmentPlans.ts
# Must return: >= 4
```

**Done:** All hooks exported with proper query keys

---

## Plan 04-02: Installment, Payment Services + Budget Extensions

**Wave:** 2
**Type:** execute
**Autonomous:** true
**Depends on:** [04-01]
**Files modified:** src/services/installments/, src/services/payments/, src/app/api/budgets/[id]/installments/, src/app/api/budgets/[id]/payments/, src/hooks/

```typescript
// Key interfaces created by this plan

interface BudgetInstallment {
  id: string
  budget_id: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  paid_at: string | null
  payment_id: string | null
  created_at: string
}

interface Payment {
  id: string
  budget_id: string
  amount: number
  payment_method: 'pix' | 'credit' | 'debit' | 'cash' | 'boleto' | 'transfer' | 'other'
  paid_at: string
  notes: string | null
  created_by: string | null
  created_at: string
}
```

### Task 1: Installment Service + API

**Files:** `src/services/installments/installment.service.ts`, `src/app/api/budgets/[id]/installments/route.ts`

**Action:** Create:
- `createInstallments(budgetId, installments[])` — batch create per D-08 (manual amounts)
- `getInstallmentsByBudget(budgetId)` — list with status
- `updateInstallment(id, input)` — edit amount/due_date before paid
- `deleteInstallment(id)` — delete unpaid installment
- `markInstallmentPaid(id, paymentId)` — mark as paid, link payment
- `getRemainingBalance(budgetId)` — calculate budget.final_value minus sum(paid installments)

**Verify:**
```bash
grep -c "createInstallments\|getRemainingBalance" src/services/installments/installment.service.ts
# Must return: 2
```

**Done:** Installment service with all 6 functions

---

### Task 2: Payment Service + API

**Files:** `src/services/payments/payment.service.ts`, `src/app/api/budgets/[id]/payments/route.ts`, `src/hooks/usePayments.ts`

**Action:** Create payment service implementing D-09, D-11:
- `recordPayment(input)` — validates amount <= remaining balance, creates payment, triggers installment update, triggers session auto-complete
- `getPaymentsByBudget(budgetId)` — list payments
- `getPaymentsByPatient(patientId)` — all payments for patient
- Auto-complete formula: `sessions_to_complete = floor(payment_amount / session_cost)` where `session_cost = budget.final_value / treatment_plan.total_sessions`
- Complete sessions oldest-first via `treatment_plan_items` ordered by `session_number ASC`

API routes:
- `POST /api/budgets/[id]/payments` — record payment (triggers D-09 + D-11)
- `GET /api/budgets/[id]/payments` — list payments for budget

**Verify:**
```bash
grep -c "recordPayment\|sessions_to_complete" src/services/payments/payment.service.ts
# Must return: 2
```

**Done:** Payment service with D-09 auto-complete logic and D-11 budget status trigger

---

### Task 3: Budget Extensions — Installments + Payment Status

**Files:** `src/services/budgets/budget.service.ts`, `src/app/api/budgets/[id]/route.ts`

**Action:** Extend existing budget service:
- Add `treatment_plan_id` to `CreateBudgetInput`
- Add `installments` to `Budget` type (joined)
- Add `getBudgetsByTreatmentPlan(treatmentPlanId)` — per D-05 (one budget per master plan)
- Add `getBudgetWithInstallments(budgetId)` — budget + installments list

Extend `PATCH /api/budgets/[id]` to accept `treatment_plan_id` field.

**Verify:**
```bash
grep "treatment_plan_id" src/services/budgets/budget.service.ts
# Must return: >= 2 matches
```

**Done:** Budget service extended with treatment_plan_id and installment support

---

### Task 4: Financial Summary API

**Files:** `src/app/api/patients/[id]/financial-summary/route.ts`, `src/hooks/useFinancialSummary.ts`

**Action:** Create endpoint implementing D-12, D-13:
- `GET /api/patients/[id]/financial-summary`

Returns per-treatment-plan financial data:
```typescript
interface TreatmentPlanFinancial {
  treatment_plan_id: string
  treatment_plan_title: string
  budget_id: string
  budget_status: BudgetStatus
  total_billed: number      // budget.final_value
  total_paid: number        // sum of payments
  amount_owed: number       // total_billed - total_paid
  progress_percent: number  // sessions completed / total sessions
  installments: BudgetInstallment[]
}

interface FinancialSummary {
  patient_id: string
  plans: TreatmentPlanFinancial[]
  totals: {
    total_billed: number
    total_paid: number
    total_owed: number
  }
}
```

Also create `useFinancialSummary(patientId)` hook with query key `['financial-summary', patientId]`.

**Verify:**
```bash
grep -c "financial-summary\|total_billed\|total_paid\|amount_owed" src/app/api/patients/\[id\]/financial-summary/route.ts
# Must return: >= 4
```

**Done:** Financial summary endpoint returns per-plan and totals aggregation

---

## Plan 04-03: Financial Summary UI

**Wave:** 3
**Type:** execute
**Autonomous:** false (has checkpoint)
**Depends on:** [04-01, 04-02]
**Files modified:** src/components/contacts/contact-detail-panel.tsx, src/components/contacts/contact-financial-tab.tsx, src/components/contacts/treatment-plan-card.tsx, src/components/contacts/budget-detail-panel.tsx, src/components/contacts/installment-list.tsx, src/components/contacts/payment-recorder-dialog.tsx

### Task 1: Progress Bar Component

**Files:** `src/components/ui/progress-bar.tsx` (NEW)

**Action:** Create `ProgressBar` component using Tailwind (no @radix-ui needed):
- Props: `value: number` (0-100), `showLabel?: boolean`
- Color thresholds per UI-SPEC: <30% red (`bg-red-500`), 30-70% amber (`bg-amber-500`), >70% green (`bg-green-500`)
- Smooth transition animation
- Shows "X%" label when showLabel=true

**Verify:**
```bash
grep -c "bg-red-500\|bg-amber-500\|bg-green-500" src/components/ui/progress-bar.tsx
# Must return: 3
```

**Done:** ProgressBar component with threshold colors and smooth animation

---

### Task 2: Installment List Component

**Files:** `src/components/contacts/installment-list.tsx` (NEW)

**Action:** Create `InstallmentList` component:
- Props: `installments: BudgetInstallment[]`, `onPay: (installment) => void`, `onEdit: (installment) => void`
- Shows: installment amount (BRL format), due date, status badge
- Status colors: pending (gray), paid (green), overdue (red)
- "Registrar Pagamento" button per unpaid installment
- Empty state: "Nenhuma parcela cadastrada" + "Adicione parcelas para controlar o pagamento deste orcamento."

**Verify:**
```bash
grep "Nenhuma parcela" src/components/contacts/installment-list.tsx
# Must return: 1 match
```

**Done:** Installment list with status badges and payment buttons

---

### Task 3: Payment Recorder Dialog

**Files:** `src/components/contacts/payment-recorder-dialog.tsx` (NEW)

**Action:** Create `PaymentRecorderDialog` component:
- Props: `open`, `onOpenChange`, `budgetId`, `prefillAmount?`, `installmentId?`
- Fields: amount (currency input), date (date picker, default today), method (Select: Pix, credit, debit, cash, boleto, transferencia, other), notes (textarea, optional)
- Validation: amount must not exceed remaining balance (from D-08 principle, prevents overpayment per Pitfall 3)
- On submit: calls `useRecordPayment` mutation, shows success toast, closes dialog
- On error: shows error toast, form stays open

**Verify:**
```bash
grep -c "payment_method\|remaining_balance" src/components/contacts/payment-recorder-dialog.tsx
# Must return: >= 2
```

**Done:** Payment recorder dialog with validation and method dropdown

---

### Task 4: Budget Detail Panel

**Files:** `src/components/contacts/budget-detail-panel.tsx` (NEW)

**Action:** Create `BudgetDetailPanel` implementing D-17 (two-column layout):
- Left column: `BudgetItemList` — procedure name, quantity, unit price, total
- Right column: `InstallmentList` with "Gerar Parcelas" button (D-19)
- D-19 generator: user enters number of installments + first due date, system generates equal amounts, user edits individual amounts before confirming
- Bottom section: totals (subtotal, discount, final value), status badge, action buttons (Enviar, Aceitar, Rejeitar)

**Verify:**
```bash
grep "grid-cols-2" src/components/contacts/budget-detail-panel.tsx
# Must return: 1 match (two-column desktop layout)
```

**Done:** Two-column budget detail with items left, installments right

---

### Task 5: Treatment Plan Card

**Files:** `src/components/contacts/treatment-plan-card.tsx` (NEW)

**Action:** Create `TreatmentPlanCard` component:
- Shows: plan title, status badge (draft/active/completed/cancelled), principal practitioner name
- Progress bar (sessions completed / total) using ProgressBar component
- Progress color thresholds per D-04
- Aggregate progress: `sum(completed_items) / sum(total_items)` across all sub-treatments
- Expandable: click to show sub-treatment list
- "Criar Budget" button when no budget linked (D-05)

**Verify:**
```bash
grep -c "completed_sessions\|total_sessions" src/components/contacts/treatment-plan-card.tsx
# Must return: >= 2
```

**Done:** Treatment plan card with progress bar and expandable sub-treatments

---

### Task 6: Financial Tab + Chart Integration

**Files:** `src/components/contacts/contact-financial-tab.tsx` (NEW), `src/components/contacts/contact-detail-panel.tsx`

**Action:**

A. Add "Financeiro" tab to contact-detail-panel.tsx:
```tsx
<TabsTrigger value="financeiro">Financeiro</TabsTrigger>
```

B. Create `contact-financial-tab.tsx`:
- Uses `useFinancialSummary(patientId)` hook
- Renders vertical stack of `TreatmentPlanCard` components
- Per-card: shows total_billed, total_paid, amount_owed
- Horizontal bar chart using Recharts BarChart (D-18) — simple bars for billed/paid/owed
- Chart uses `LayoutBuilder` pattern from existing project (check existing Recharts usage)

D-18 implementation:
```tsx
<BarChart layout="vertical" data={[{
  name: plan.title,
  billed: plan.total_billed,
  paid: plan.total_paid,
  owed: plan.amount_owed
}]}>
  <XAxis type="number" />
  <YAxis type="category" dataKey="name" width={100} />
  <Bar dataKey="billed" fill="hsl(var(--primary))" />
  <Bar dataKey="paid" fill="hsl(var(--accent))" />
  <Bar dataKey="owed" fill="hsl(var(--destructive))" />
</BarChart>
```

**Verify:**
```bash
grep "BarChart\|billed\|paid\|owed" src/components/contacts/contact-financial-tab.tsx
# Must return: >= 4 matches
```

**Done:** Financial tab with treatment plan cards + Recharts horizontal bar chart

---

### Task 7: Human Verification Checkpoint

**Type:** checkpoint:human-verify
**Gate:** blocking

**What Built:** Financial tab in contact detail panel showing treatment plans with progress bars, financial summaries, and installment management.

**How to Verify:**
1. Open any patient contact profile (e.g., via dashboard contacts list)
2. Click "Financeiro" tab
3. Verify: tab shows "Nenhum plano de tratamento" empty state OR list of treatment plan cards
4. If plans exist: verify progress bars show correct colors (red <30%, amber 30-70%, green >70%)
5. Click on a treatment plan card to expand sub-treatments
6. If budget exists: verify two-column layout (items left, installments right)
7. Click "Registrar Pagamento" on an installment — verify dialog opens with amount/date/method fields
8. Verify horizontal bar chart shows billed/paid/owed bars

**Resume Signal:** Type "approved" or describe issues

---

## Threat Model (ASVS L1)

| Threat | Category | Component | Disposition | Mitigation |
|--------|----------|-----------|------------|------------|
| T-04-01 | Tampering | Payment amount | mitigate | Server-side validation: amount <= remaining_balance; Zod schema min(0) |
| T-04-02 | Information Disclosure | Cross-patient data | mitigate | RLS policies on patient_id + clinic_id for all new tables |
| T-04-03 | Tampering | Budget status injection | mitigate | Enum validation (BudgetStatus type) server-side only |
| T-04-04 | Information Disclosure | Installment overpayment | mitigate | getRemainingBalance() check before recording payment |
| T-04-05 | Tampering | Session count manipulation | mitigate | Transaction wraps payment + session update in payment.service.ts |

---

## Verification Commands

```bash
# Phase 4 gate: all tests pass
npm test -- --testPathPattern="treatment-plans|installments|payments" -x

# Build check
npm run build 2>&1 | head -50

# Health check
curl -s http://localhost:3000/api/health | jq .
```

---

## Output

After completion, create `.planning/phases/04-patient-records-finance/04-01-SUMMARY.md` and `04-02-SUMMARY.md` and `04-03-SUMMARY.md`.

---

## Source Audit: Unplanned Items

None. All PRONT requirements, all D-01..D-19 decisions, and all success criteria have tasks in this plan set.
