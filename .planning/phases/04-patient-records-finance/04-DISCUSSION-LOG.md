# Phase 4: Patient Records & Finance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 04-patient-records-finance
**Areas discussed:** Plan ownership & session structure, Budget granularity & linkage, Installment & payment triggers, Financial summary location & content

---

## Area 1: Plan Ownership & Session Structure

| Option | Description | Selected |
|--------|-------------|----------|
| One plan per procedure | Simples, bom para casos com um tratamento principal. Cada procedimento = um plano. | |
| One master plan with sub-treatments | Um plano 'maestro' agrupando todos os procedimentos do paciente, com sub-planos por tratamento. | ✓ |
| Let the user decide per case | Depende do tipo de procedimento — casos simples usam A, casos complexos usam B. | |

**User's choice:** One master plan with sub-treatments
**Notes:** User prefers organized structure with master plan aggregating sub-treatments

---

### Sessions per Sub-Treatment vs Globally

| Option | Description | Selected |
|--------|-------------|----------|
| Sessions per sub-treatment | Cada sub-tratamento tracks done/total. Master plan aggregate de todos sub-tratamentos. Simples, visual. | ✓ |
| Sessions tracked globally | Sessões sãotracked individualmente, independente de sub-tratamento. Mais granular, mais complexo. | |
| Link sessions to appointments | Cada sessão é linkada a um appointment existente. Aproveita dados já existentes do calendário. | |

**User's choice:** Sessions per sub-treatment
**Notes:** Simple and visual, aggregates nicely in master plan

---

### Multiple Practitioners

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple practitioners per patient | O paciente pode ter mais de um dentista no mesmo plano. Todos aparecem no plano, um é 'principal'. | ✓ |
| One dentist per sub-treatment | Cada sub-tratamento tem um dentista responsável. Simples, mas menos flexível. | |
| Let the user decide per sub-treatment | O dentista é uma propriedade do sub-tratamento, não do plano. | |

**User's choice:** Multiple practitioners per patient
**Notes:** More flexibility for cases where patient sees multiple dentists

---

## Area 2: Budget Granularity & Linkage

| Option | Description | Selected |
|--------|-------------|----------|
| One budget per sub-treatment | Cada sub-tratamento tem seu próprio orçamento. Master plan não tem orçamento próprio. | |
| One budget per master plan | Budget só no master plan, sub-tratamentos só tienen custos referenciales. Menos granular. | ✓ |
| Let the user decide per case | Usuário escolhe por caso: simples = budget único, complexo = budget por sub-tratamento. | |

**User's choice:** One budget per master plan
**Notes:** Less granular but simpler, aligns with master plan structure

---

## Area 3: Installment & Payment Triggers

### Installment Calculation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-split | Divide equally by number of installments. Example: 3x = 33.3% each. | |
| Manual amounts per installment | Dentist enters exact amount per installment. More control, more work. | ✓ |
| Auto with manual override | Suggested equal split, dentist can edit before confirming. | |

**User's choice:** Manual amounts per installment
**Notes:** User prefers full control over installment amounts

---

### Auto-Complete Sessions on Payment

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-complete sessions | When user records a payment, system marks sessions as complete proportionally. Simple. | ✓ |
| Manual session marking | User manually marks which session is being paid. More control, more clicks. | |
| Hybrid | For partial payments, dentist chooses. For full payments, auto-complete. | |

**User's choice:** Auto-complete sessions
**Notes:** Simple flow, proportional marking

---

### Payment Method Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Record payment method | Pix, cartão de crédito, cartão de débito, dinheiro, boleto, etc. Útil para reconciliation. | ✓ |
| No payment method tracking | Simples, mas perde informação útil para financeiro. | |
| Optional | O usuário escolhe quando registrar - útil quando não importa. | |

**User's choice:** Record payment method
**Notes:** Useful for reconciliation and financial tracking

---

## Area 4: Financial Summary Location & Content

| Option | Description | Selected |
|--------|-------------|----------|
| Contact profile tab | Mesma estrutura do Phase 1: lista de contatos à esquerda, detail à direita com tabs. Tab 'Financeiro' mostra resumo. | ✓ |
| Separate Reports page | Nova página em /dashboard/financeiro ou /dashboard/relatorios-financeiros. Mais destacado, menos integrado. | |
| Compact in profile + separate page | Card compacto dentro do profile, com link para página detalhada. BalanCO简单 mas menos poderoso. | |

**User's choice:** Contact profile tab
**Notes:** Consistent with Phase 1 split-view pattern, well integrated

---

## Deferred Ideas

- Dental charting (odontograma) — different product category, future phase
- Payment gateway integration (Pix, credit card) — requires PCI compliance, future phase
- Electronic health records (CFM/PEC) — regulatory compliance, future phase
- 2D pipeline view (urgency × progress) — Phase 2 deferred idea
- Pipeline analytics — Phase 5 or later