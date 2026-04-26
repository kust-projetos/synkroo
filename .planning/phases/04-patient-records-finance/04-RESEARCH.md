# Phase 4: Patient Records & Finance - Research

**Researched:** 2026-04-26
**Domain:** Treatment plans, sessions, budgets, payments, financial summary
**Confidence:** HIGH

## Summary

Phase 4 implements patient records management (treatment plans with multi-session tracking) and financial workflows (budgets with itemized procedures, manual installment plans, payment recording, and financial summaries). The database already has `treatment_plans` and `treatment_plan_items` tables, and `budgets`/`budget_items` tables exist with accept/reject endpoints. Key gap: **installment tracking and payment recording are not yet in the schema** -- this is the primary implementation work. The split-view pattern from Phase 1 (contact list left, detail tabs right) provides the UI foundation for the financial summary tab.

**Primary recommendation:** Extend existing budget tables for installments, add a `payments` table, and create a "Financeiro" tab in the contact detail panel following the same Tabs pattern as Timeline/Notas/Campos.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Master plan with sub-treatments — one master plan grouping all patient procedures, with sub-plans per treatment
- **D-02:** Sessions tracked per sub-treatment (done/total) — master plan aggregates all sub-treatment progress
- **D-03:** Multiple practitioners per patient plan — all appear on plan, one is "principal"
- **D-04:** Visual progress indicators per sub-treatment (progress bar) + master plan aggregate
- **D-05:** One budget per master plan (not per sub-treatment) — sub-treatments have referential costs only
- **D-06:** Budget includes: itemized procedures with costs, payment terms, due dates
- **D-07:** Budget can be accepted/rejected by patient (existing endpoints)
- **D-08:** Installment amounts are manual — dentist enters exact amount per installment
- **D-09:** When payment received: sessions auto-complete proportionally (payment amount / session cost)
- **D-10:** Payment method recorded: Pix, credit card, debit card, cash, boleto, etc.
- **D-11:** Payment triggers: budget total paid -> budget accepted status, sessions completed
- **D-12:** Financial summary in contact profile tab (same split-view pattern from Phase 1)
- **D-13:** Summary shows: total billed, total paid, amount owed per treatment plan
- **D-14:** Links to detailed budget and payment history from the summary tab

### Claude's Discretion
- Budget document layout and visual design
- Progress bar colors (green/yellow/red thresholds)
- Installment schedule UI (due date picker, amount inputs)
- Payment recording form layout
- Summary chart types (bars, lines, totals)

### Deferred Ideas (OUT OF SCOPE)
- Dental charting (odontograma) — different product category, future phase
- Payment gateway integration (Pix, credit card) — requires PCI compliance, future phase
- Electronic health records (CFM/PEC) — regulatory compliance, future phase
- 2D pipeline view (urgency x progress) — Phase 2 deferred idea
- Pipeline analytics — Phase 5 or later

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRONT-01 | User can create multi-session treatment plans for patients | `treatment_plans` + `treatment_plan_items` tables already exist in schema; service layer needed |
| PRONT-02 | User can track treatment plan progress (sessions completed vs remaining) | `completed_sessions` / `total_sessions` fields; progress bar UI component needed |
| PRONT-03 | User can create treatment budgets with itemized procedures and costs | Existing `budgets` + `budget_items` tables; extend for installment tracking |
| PRONT-04 | User can define payment plans (installments, due dates) | New `installments` table linked to budget; manual amounts per D-08 |
| PRONT-05 | User can record payments and track outstanding balances | New `payments` table; update budget status when fully paid |
| PRONT-06 | User can view basic financial summary per patient (total billed, paid, owed) | New financial summary tab in contact detail panel (D-12) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Treatment plan CRUD | API / Backend | — | Database tables already exist |
| Session progress tracking | API / Backend | Frontend Server (SSR) | Data aggregation happens server-side |
| Budget creation with items | API / Backend | — | Extends existing budget.service.ts |
| Installment management | API / Backend | — | New table, new service |
| Payment recording | API / Backend | — | New payments table triggers budget/session updates |
| Financial summary display | Frontend Server (SSR) | Browser / Client | Tab in contact-detail-panel, aggregated queries |
| Progress bar visualization | Browser / Client | — | React component using treatment_plan data |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|--------|--------------|
| `@tanstack/react-query` | 5.x | Server state management | Already in project, handles loading/error states |
| `react-resizable-panels` | 4.x | Split-view layout | Already used in `ContactSplitView` |
| `zod` | (in use) | Input validation | Already project standard for API validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-tabs` | (in use) | Tab navigation | Contact detail panel tabs |
| `@radix-ui/react-progress` | (likely in use) | Progress bars | Treatment plan progress indicators |
| `@radix-ui/react-dialog` | (in use) | Modals | Payment recording, budget creation |

**Installation:**
No new packages required. All required UI primitives likely already present.

## Architecture Patterns

### System Architecture Diagram

```
[Contact Split View]
        |
        v
[ContactDetailPanel] --> [Tabs: Info | Timeline | Notas | Campos | WhatsApp | Financeiro]
        |
        v
[Financial Tab] --> Fetches: /api/patients/[id]/treatment-plans
                           /api/patients/[id]/budgets
                           /api/patients/[id]/payments
        |
        v
[Backend API] --> treatment_plans + treatment_plan_items
              --> budgets + budget_items + installments (NEW)
              --> payments (NEW)
              --> Aggregates: total_billed, total_paid, amount_owed
```

### Recommended Project Structure
```
src/
├── app/api/treatment-plans/
│   ├── route.ts                 # List, create treatment plans
│   └── [id]/
│       └── route.ts             # Get, update, delete treatment plan
├── app/api/treatment-plans/[id]/
│   └── sessions/
│       └── route.ts             # Session progress updates
├── app/api/budgets/[id]/
│   ├── installments/            # NEW: manage installments
│   │   └── route.ts             # GET, POST installments
│   └── payments/                # NEW: record payments
│       └── route.ts             # POST payment, triggers session auto-complete
├── app/api/patients/[id]/
│   └── financial-summary/       # NEW: aggregated financial data
│       └── route.ts
├── services/
│   ├── treatment-plans/         # NEW: treatment plan service
│   │   └── treatment-plan.service.ts
│   ├── installments/            # NEW: installment service
│   │   └── installment.service.ts
│   └── payments/               # NEW: payment service
│       └── payment.service.ts
├── components/contacts/
│   ├── contact-detail-panel.tsx  # Add "Financeiro" tab
│   ├── contact-financial-tab.tsx # NEW: financial summary tab
│   ├── treatment-plan-card.tsx   # NEW: treatment plan display
│   └── installment-list.tsx     # NEW: installment list component
```

### Pattern 1: Split-View + Tabbed Detail
**What:** Master list on left (contacts), detail panel on right with tabbed interface
**When to use:** Contact profile with multiple data categories
**Source:** `src/components/contacts/contact-split-view.tsx` + `contact-detail-panel.tsx`
```typescript
// Tabs structure (existing pattern)
<TabsList className="w-full justify-start rounded-none border-b">
  <TabsTrigger value="info">Info</TabsTrigger>
  <TabsTrigger value="timeline">Timeline</TabsTrigger>
  <TabsTrigger value="notes">Notas</TabsTrigger>
  <TabsTrigger value="custom">Campos</TabsTrigger>
  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
  <TabsTrigger value="financeiro">Financeiro</TabsTrigger> {/* NEW */}
</TabsList>
```

### Pattern 2: Payment Triggers Session Completion
**What:** When payment received, proportionally complete sessions (D-09)
**When to use:** Automatic session tracking based on payment
**Formula:** `sessions_to_complete = floor(payment_amount / session_cost)`
```typescript
// Source: D-09 decision
async function recordPayment(budgetId: string, amount: number, method: PaymentMethod) {
  const budget = await getBudgetById(budgetId)
  const sessionCost = budget.final_value / budget.total_sessions
  
  // Auto-complete proportional sessions
  const sessionsToComplete = Math.floor(amount / sessionCost)
  await completeSessions(budgetId, sessionsToComplete)
  
  // Update budget status if fully paid
  const totalPaid = await getTotalPaid(budgetId)
  if (totalPaid >= budget.final_value) {
    await updateBudgetStatus(budgetId, 'accepted')
  }
}
```

### Pattern 3: Financial Summary Aggregation
**What:** Per-patient totals computed from budgets, installments, payments
**When to use:** Financial summary tab
```typescript
interface FinancialSummary {
  patient_id: string
  plans: Array<{
    plan_id: string
    plan_title: string
    total_billed: number
    total_paid: number
    amount_owed: number
    progress_percent: number
  }>
  totals: {
    total_billed: number
    total_paid: number
    total_owed: number
  }
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment installments | Custom installment tracking | `budget_installments` table with status | Consistency with existing budget pattern, easier reporting |
| Session auto-complete logic | Hard-code proportional completion | Service layer with transaction | D-09 requires calculation + multiple table updates |
| Financial aggregation | Raw SQL with joins | API endpoint with computed summary | Reuse, caching, single source of truth |

## Common Pitfalls

### Pitfall 1: Budget-Session Decoupling
**What goes wrong:** Budget and treatment plan are separate entities but D-09 requires them to be linked (payment -> session completion)
**Why it happens:** No foreign key between `budgets` and `treatment_plans` tables
**How to avoid:** Add `treatment_plan_id` to `budgets` table, or link via `patient_id` + same sub-treatment
**Warning signs:** Payment doesn't auto-complete sessions, circular dependency between budget and plan

### Pitfall 2: Progress Bar Color Thresholds
**What goes wrong:** Inconsistent color logic for progress indicators (green/yellow/red)
**Why it happens:** No defined thresholds, each component implements its own logic
**How to avoid:** Define constants: <30% red, 30-70% yellow, >70% green
**Warning signs:** Different components show different colors for same progress %

### Pitfall 3: Installment Overpayment
**What goes wrong:** Recorded payments exceed budget total, causing negative balance
**Why it happens:** No validation on payment amount against remaining balance
**How to avoid:** Check `remaining_balance = budget.final_value - sum(paid_installments)` before recording
**Warning signs:** `amount_owed` becomes negative, budget status "accepted" but more payments arriving

## Code Examples

### Existing Budget Service (to extend)
```typescript
// Source: src/services/budgets/budget.service.ts (lines 103-163)
export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  // Creates budget + budget_items
  // Pattern to follow for installment service
}
```

### Existing Contact Detail Tabs Pattern
```typescript
// Source: src/components/contacts/contact-detail-panel.tsx (lines 171-178)
<TabsList className="w-full justify-start rounded-none border-b">
  <TabsTrigger value="info">Info</TabsTrigger>
  <TabsTrigger value="timeline">Timeline</TabsTrigger>
  {/* Add Financeiro tab here */}
</TabsList>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Budget as single total | Budget with line items (budget_items) | Already implemented | Enables itemized procedures |
| Payment as budget field | Separate payments table | Phase 4 | Tracks multiple payments, methods, dates |
| Session count only | Session progress (done/total) | Phase 4 | Enables visual progress bars |

**Deprecated/outdated:**
- None identified for this phase

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@radix-ui/react-progress` is available (not confirmed via npm) | Standard Stack | Install if missing, no blocking issue |
| A2 | Budget can be linked to treatment plan via `treatment_plan_id` FK (not in current schema) | Common Pitfalls | Add migration to include FK, otherwise query by patient_id |
| A3 | Payment methods (Pix, credit, etc.) stored as string enum | Code Examples | Add to installments/payments table as check constraint |

## Open Questions

1. **Budget-Treatment Plan linkage**
   - What we know: `budgets.patient_id` and `treatment_plans.patient_id` exist; budgets can be queried by patient
   - What's unclear: Should `budgets` have direct FK to `treatment_plans`, or query by patient + date range?
   - Recommendation: Add `treatment_plan_id` to `budgets` as optional FK for explicit linkage

2. **Installment due date tracking**
   - What we know: D-08 says manual amounts, D-06 says due dates part of budget
   - What's unclear: Are installments created at budget creation time, or added later?
   - Recommendation: Installments created with budget (predefined schedule), can be edited before any payment

3. **Payment-to-session mapping**
   - What we know: D-09 says proportional auto-complete
   - What's unclear: Which specific sessions get marked complete (first ones, last ones)?
   - Recommendation: Complete sessions in order (session_number ASC), oldest first

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | 22.x | — |
| npm | Package install | ✓ | 10.x | — |
| Supabase CLI | Database migrations | ✓ | latest | — |
| @tanstack/react-query | State management | ✓ | 5.x | — |
| react-resizable-panels | Split view | ✓ | 4.x | — |
| @radix-ui/react-progress | Progress bars | ✗ [ASSUMED] | — | Check existing UI components |
| zod | Validation | ✓ | in use | — |

**Missing dependencies with no fallback:**
- None identified

**Missing dependencies with fallback:**
- `@radix-ui/react-progress` — check existing UI components before installing; can use Tailwind + div if not available

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing project standard) |
| Config file | `jest.config.js` or `jest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRONT-01 | Create treatment plan with sub-treatments | unit | `npm test -- treatment-plan.service.test.ts` | ❌ Wave 0 |
| PRONT-02 | Track session progress (done/total) | unit | `npm test -- treatment-plan.service.test.ts` | ❌ Wave 0 |
| PRONT-03 | Budget with itemized procedures | unit | `npm test -- budget.service.test.ts` | ❌ Wave 0 |
| PRONT-04 | Define installment schedule | unit | `npm test -- installment.service.test.ts` | ❌ Wave 0 |
| PRONT-05 | Record payment, auto-complete sessions | unit + integration | `npm test -- payment.service.test.ts` | ❌ Wave 0 |
| PRONT-06 | Financial summary aggregation | unit | `npm test -- financial-summary.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="treatment-plans|payments|installments" -x`
- **Per wave merge:** `npm test -- --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/services/treatment-plans/__tests__/treatment-plan.service.test.ts` — PRONT-01, PRONT-02
- [ ] `src/services/installments/__tests__/installment.service.test.ts` — PRONT-04
- [ ] `src/services/payments/__tests__/payment.service.test.ts` — PRONT-05
- [ ] `src/components/contacts/__tests__/contact-financial-tab.test.tsx` — PRONT-06
- [ ] `src/services/budgets/__tests__/budget-installments.test.ts` — extends PRONT-03

*(Existing test coverage: `budget.service.test.ts` exists, `patient-history.service.test.ts` exists)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing) |
| V3 Session Management | yes | Supabase (existing) |
| V4 Access Control | yes | RLS policies on all tables |
| V5 Input Validation | yes | Zod schemas for all inputs |
| V6 Cryptography | no | No sensitive data encrypted at app level |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Payment amount manipulation | Tampering | Server-side validation, transaction wraps payment + session update |
| Installment overpayment | InformationDisclosure | Check remaining balance before recording payment |
| Budget status injection | Tampering | Enum validation on status field, server-side only |
| Cross-patient data access | InformationDisclosure | RLS policies on patient_id + clinic_id |

## Sources

### Primary (HIGH confidence)
- `src/services/budgets/budget.service.ts` — existing budget pattern (CRUD, accept/reject)
- `src/components/contacts/contact-split-view.tsx` — split-view pattern
- `src/components/contacts/contact-detail-panel.tsx` — tabs pattern
- `src/lib/supabase/database.types.ts` — existing schema types

### Secondary (MEDIUM confidence)
- Supabase migrations — existing RLS policies, table structure

### Tertiary (LOW confidence)
- D-08, D-09, D-11 interpretations — based on context doc, not yet verified with implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing project patterns well established
- Architecture: HIGH — clear data flow from context + existing patterns
- Pitfalls: MEDIUM — based on patterns seen, but specific issues may differ

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days, stable domain)