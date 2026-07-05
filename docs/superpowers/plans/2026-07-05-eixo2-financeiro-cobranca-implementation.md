# Eixo 2 — Financeiro & Cobrança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Financeiro & Cobrança como módulo Action Layer: orçamentos, parcelas, charges PIX/link Asaas, pagamentos, cobrança atrasada, dashboard e compat legado.

**Architecture:** `route/UI → financeiro action → service → repository/gateway`. Financeiro owns budgets/installments/charges/payments/gateways. Comercial owns lead→patient conversion. Atendimento owns WhatsApp send.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Jest, Zod, Asaas HTTP API.

**Spec:** `docs/superpowers/specs/2026-07-05-eixo2-financeiro-cobranca-design.md`.

**Agent Orchestration:** Supervisor-Workers — one worker per task, planner reviews handoff after each task.

---

## Context

- Legacy seams: `src/app/api/budgets/**`, `src/services/budgets/*`, `src/services/payments/*`, `src/services/installments/*`.
- Preserve consumers: `src/hooks/usePayments.ts`, `src/components/contacts/*`.
- PITFALLS rule: expand-contract migrations, nullable columns first, no destructive drops.
- Worktree unrelated files must not be staged: `src/middleware.ts`, `src/app/pi-finance/`, `src/components/pi-finance/`, `src/lib/pi-finance/`.

## Stack

| Pkg | Versão | Uso |
|---|---:|---|
| Next.js | 15 | route handlers + dashboard |
| React | 19 | finance UI tabs |
| TypeScript | 5.6 | Action contracts |
| Drizzle | repo | schema/repositories |
| Jest | repo | unit/route/integration |
| Zod | repo | action/gateway validation |

## Architecture

```
src/modules/financeiro/{actions,gateways,repositories,services,ui,manifest.ts,permissions.ts,types.ts,index.ts}
src/app/api/financeiro/**
src/app/dashboard/financeiro/page.tsx
src/components/financeiro/*.tsx
```

Rules:
- Routes call actions through `runActionRoute`.
- Financeiro never mutates owner tables directly.
- Lead acceptance calls `comercial.converterLeadSemAgendar`.
- Gateway secrets are write-only/masked/server-only.
- `payments.paidAt` remains canonical settlement timestamp.

## Schemas

```ts
// src/lib/db/schema/business.ts nullable-first additions
budgets: leadId, convertedFromLeadId, campaignId, acceptedAt, rejectedAt, lastSentAt
payments: chargeId, status // keep paidAt canonical
paymentCharges: clinicId, budgetId, gatewayId, externalChargeId, paymentUrl, pixQrCode, dueDate, status, amount
paymentGateways: clinicId, provider, isDefault, isEnabled, maskedLabel, encryptedConfig
gatewayRoutingRules: clinicId, gatewayId, campaignId?, patientId?, leadId? // exactly one scope
gatewayEvents: clinicId, gatewayId, chargeId?, provider, externalEventId, payload, processedAt
collectionAttempts: clinicId, chargeId?, installmentId?, channel, stage, status, sentAt, errorMessage
```

## Endpoints

| Route | Action |
|---|---|
| `GET/POST /api/financeiro/budgets` | list/create |
| `GET /api/financeiro/budgets/:id` | detail with items/installments/payments/charges |
| `POST /api/financeiro/budgets/:id/send|accept|reject` | state transitions |
| `GET/PUT /api/financeiro/budgets/:id/installments` | list/save installments |
| `GET /api/financeiro/budgets/:id/payments` | list settled payments |
| `POST /api/financeiro/payments/manual` | record settled payment |
| `POST /api/financeiro/charges` | create Asaas charge |
| `GET /api/financeiro/charges/:id` | charge detail |
| `POST /api/financeiro/charges/:id/cancel` | cancel open charge |
| `GET/POST /api/financeiro/gateways` | masked list/save config |
| `GET/POST /api/financeiro/gateway-rules` | list/save routing |
| `POST /api/financeiro/webhooks/[provider]` | provider webhook, reconciliation exception |

## Milestones

| Tasks | Deliverables |
|---|---|
| 1-2 | schema/repositories + Comercial bridge |
| 3-5 | module scaffold + actions + routes/adapters |
| 6-8 | webhook/collections + UI + verification |

## Tests

| Type | Tool | Scope |
|---|---|---|
| Unit | Jest | totals, installments, routing, metrics, collection rule |
| Contract | Jest/Zod/MSW | Asaas create/webhook payload |
| Route | Jest | gates, RBAC, masked secrets, legacy shape |
| Integration | Jest + Postgres | lead accept → patient conversion → budget patientId |
| Snapshot | Jest | dashboard/config/collections states |
| Mutation | Stryker | finance calculations + routing target ≥70% |
| E2E | Playwright | decide after implementation |

---

## Task 1 — Schema + repository foundation

**Files:**
- Modify: `src/lib/db/schema/business.ts`
- Create: `src/modules/financeiro/repositories/financeiro-repository.ts`
- Test: `src/modules/financeiro/repositories/__tests__/financeiro-repository.test.ts`

- [ ] **Step 1: RED repository tests**

```ts
import { assertSingleRoutingScope, buildChargeInsert } from '../financeiro-repository';

test('routing rule accepts exactly one scope', () => {
  expect(() => assertSingleRoutingScope({ campaignId: 'ca1', patientId: 'p1' })).toThrow('gateway_routing_rule_scope_conflict');
  expect(() => assertSingleRoutingScope({ leadId: 'l1' })).not.toThrow();
});

test('charge insert keeps tenant fields', () => {
  expect(buildChargeInsert({ clinicId: 'c1', budgetId: 'b1', gatewayId: 'g1', amount: 100, dueDate: '2026-07-10' }))
    .toMatchObject({ clinicId: 'c1', budgetId: 'b1', gatewayId: 'g1', status: 'pending' });
});
```

Run: `npx jest src/modules/financeiro/repositories/__tests__/financeiro-repository.test.ts --runInBand`
Expected: FAIL, module missing.

- [ ] **Step 2: Add schema**

Add nullable fields to existing tables and create `paymentCharges`, `paymentGateways`, `gatewayRoutingRules`, `gatewayEvents`, `collectionAttempts`. Use explicit `clinicId` on new tables. Keep `payments.paidAt`; add only `chargeId` and `status` to `payments`.

- [ ] **Step 3: Add repository helpers**

```ts
export function assertSingleRoutingScope(rule: { campaignId?: string|null; patientId?: string|null; leadId?: string|null }) {
  const count = [rule.campaignId, rule.patientId, rule.leadId].filter(Boolean).length;
  if (count !== 1) throw new Error('gateway_routing_rule_scope_conflict');
}
export function buildChargeInsert(input: { clinicId: string; budgetId: string; gatewayId: string; amount: number; dueDate: string }) {
  return { clinicId: input.clinicId, budgetId: input.budgetId, gatewayId: input.gatewayId, amount: String(input.amount), dueDate: input.dueDate, status: 'pending' as const };
}
```

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/modules/financeiro/repositories/__tests__/financeiro-repository.test.ts --runInBand`
Expected: PASS.

```bash
git add src/lib/db/schema/business.ts src/modules/financeiro/repositories
git commit -m "feat(financeiro): add finance schema foundation"
```

---

## Task 2 — Comercial bridge without scheduling

**Files:**
- Modify: `src/modules/comercial/services/lead-conversion-service.ts`
- Modify: `src/modules/comercial/actions/converter-lead.ts`
- Modify: `src/modules/comercial/actions/index.ts`, `src/modules/comercial/index.ts`
- Test: `src/modules/comercial/services/__tests__/lead-conversion-service.test.ts`

- [ ] **Step 1: RED service test**

```ts
import { converterLeadSemAgendar } from '../lead-conversion-service';

test('converts lead to patient without appointment', async () => {
  const result = await converterLeadSemAgendar({ leadId: 'lead-1', clinicId: 'clinic-1' });
  expect(result).toMatchObject({ leadId: 'lead-1', status: 'converted' });
});
```

Run: `npx jest src/modules/comercial/services/__tests__/lead-conversion-service.test.ts --runInBand`
Expected: FAIL, function missing.

- [ ] **Step 2: Extract patient resolution**

Move current patient create/update logic from `agendarAvaliacao` into `ensurePatientForLead(leadId, clinicId)`. It must use existing `criarPaciente`, `obterPaciente`, `atualizarPaciente` actions and return `patientId`.

- [ ] **Step 3: Add service + action**

```ts
export async function converterLeadSemAgendar(input: { leadId: string; clinicId: string }) {
  const patientId = await ensurePatientForLead(input.leadId, input.clinicId);
  await updateLead(input.leadId, input.clinicId, { status: 'converted', patientId, convertedAt: new Date() });
  await insertActivity({ leadId: input.leadId, activityType: 'lead_converted', description: 'Lead converted via Financeiro budget acceptance', metadata: { patientId } });
  return { leadId: input.leadId, patientId, status: 'converted' as const };
}
```

Action name: `comercial.converterLeadSemAgendar`, permission `comercial:edit_leads`.

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/modules/comercial/services/__tests__/lead-conversion-service.test.ts --runInBand`
Expected: PASS.

```bash
git add src/modules/comercial
git commit -m "feat(comercial): convert lead without scheduling"
```

---

## Task 3 — Financeiro scaffold + gateway contracts

**Files:**
- Create: `src/modules/financeiro/{manifest.ts,permissions.ts,index.ts,types.ts}`
- Create: `src/modules/financeiro/gateways/{contracts.ts,registry.ts,providers/asaas/{mapper.ts,client.ts,webhook.ts}}`
- Create: `src/modules/financeiro/ui/route-adapter.ts`
- Test: `src/modules/financeiro/__tests__/manifest.test.ts`
- Test: `src/modules/financeiro/gateways/__tests__/routing.test.ts`

- [ ] **Step 1: RED tests**

```ts
import { financeiroManifest } from '../manifest';
import { financeiroAccessPermissions } from '../permissions';

test('defines Financeiro menu and permissions', () => {
  expect(financeiroManifest.menu[0]).toMatchObject({ path: '/dashboard/financeiro', permission: 'financeiro:view' });
  expect(financeiroAccessPermissions.map((p) => p.key)).toContain('financeiro:manage_gateways');
});
```

Run: `npx jest src/modules/financeiro/__tests__/manifest.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Create module public surface**

Permissions: `financeiro:view`, `financeiro:create_budget`, `financeiro:manage_budget`, `financeiro:record_payment`, `financeiro:manage_collections`, `financeiro:manage_gateways`.

Manifest menu: `{ moduleId:'financeiro', permission:'financeiro:view', label:'Financeiro', path:'/dashboard/financeiro', icon:'BanknotesIcon' }`.

- [ ] **Step 3: Gateway contract**

```ts
export type GatewayProvider = 'asaas' | 'mercado_pago' | 'pagarme' | 'efi';
export type CreateChargeResult = { externalChargeId: string; paymentUrl: string | null; pixQrCode: string | null; status: 'pending' | 'paid' | 'cancelled' | 'overdue' };
export interface PaymentGateway { createCharge(input: CreateChargeInput): Promise<CreateChargeResult>; getCharge(input: GetChargeInput): Promise<CreateChargeResult>; cancelCharge(input: CancelChargeInput): Promise<{ cancelled: boolean }>; handleWebhook(input: WebhookInput): Promise<NormalizedGatewayEvent>; }
```

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/modules/financeiro/__tests__/manifest.test.ts src/modules/financeiro/gateways/__tests__/routing.test.ts --runInBand`
Expected: PASS.

```bash
git add src/modules/financeiro
git commit -m "feat(financeiro): scaffold module and gateways"
```

---

## Task 4 — Budget, payment and charge actions

**Files:**
- Create: `src/modules/financeiro/actions/*.ts`
- Create: `src/modules/financeiro/services/{budget-service.ts,payment-service.ts,charge-service.ts,dashboard-service.ts}`
- Test: `src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts`

- [ ] **Step 1: RED action tests**

```ts
import { criarOrcamento } from '../criar-orcamento';
import { renderRatio } from '../../services/dashboard-service';

test('criarOrcamento requires exactly patientId or leadId', async () => {
  await expect(criarOrcamento.input.parseAsync({ clinicId: 'c1', patientId: 'p1', leadId: 'l1', items: [] })).rejects.toBeTruthy();
});

test('dashboard null ratios render as dash', () => {
  expect(renderRatio(null)).toBe('—');
});
```

Run: `npx jest src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement Zod contracts**

`criarOrcamento` input includes `patientId?`, `leadId?`, `campaignId?`, `items`, `discountPercent`, `installments?`. Use `.refine()` for exactly one contact id and non-empty items.

- [ ] **Step 3: Implement services**

- Budget totals match existing `calculateBudgetTotals` behavior.
- `aceitarOrcamento`: if `leadId` exists and `patientId` missing, call `converterLeadSemAgendar`.
- `registrarPagamento`: creates settled payment and updates installments.
- `gerarCobranca`: resolves gateway, calls Asaas, inserts `payment_charges`.
- `cancelarCobranca`: pending only; settled charge returns no-op.

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts --runInBand`
Expected: PASS.

```bash
git add src/modules/financeiro/actions src/modules/financeiro/services
git commit -m "feat(financeiro): add finance actions"
```

---

## Task 5 — Canonical routes + legacy adapters

**Files:**
- Create: `src/app/api/financeiro/**/route.ts`
- Modify: `src/app/api/budgets/**/route.ts`
- Test: `src/modules/financeiro/__tests__/routes.test.ts`

- [ ] **Step 1: RED route tests**

```ts
test('gateway list masks secrets', async () => {
  const res = await GET(makeRequest('/api/financeiro/gateways'));
  expect(JSON.stringify(await res.json())).not.toContain('apiKey');
});

test('legacy budget payments route keeps payments key', async () => {
  const res = await legacyPaymentsGET(makeRequest('/api/budgets/b1/payments'), { params: Promise.resolve({ id: 'b1' }) });
  expect(await res.json()).toHaveProperty('payments');
});
```

Run: `npx jest src/modules/financeiro/__tests__/routes.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Add canonical route handlers**

Use `withModuleRoute('financeiro', moduleManifest)` for all non-webhook routes. Use `runActionRoute` from `src/modules/financeiro/ui/route-adapter.ts`.

Webhook route does not use `withModuleRoute`; it validates provider secret and only reconciles existing charges.

- [ ] **Step 3: Replace legacy routes with adapters**

`src/app/api/budgets/[id]/payments/route.ts` returns `{ payments }`. `installments` route keeps `remaining_balance`. `/api/budgets/**` must stop importing deprecated services after migration.

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/modules/financeiro/__tests__/routes.test.ts --runInBand`
Expected: PASS.

```bash
git add src/app/api/financeiro src/app/api/budgets src/modules/financeiro/ui
git commit -m "feat(financeiro): expose finance routes"
```

---

## Task 6 — Asaas webhook, collections job and reminders

**Files:**
- Create/modify: `src/modules/financeiro/gateways/providers/asaas/*`
- Create: `src/modules/financeiro/services/collection-service.ts`
- Create: `src/app/api/cron/financeiro-collections/route.ts`
- Test: `src/modules/financeiro/gateways/__tests__/asaas-webhook.test.ts`
- Test: `src/modules/financeiro/services/__tests__/collection-service.test.ts`

- [ ] **Step 1: RED webhook idempotency test**

```ts
test('Asaas webhook settles charge only once', async () => {
  await handleAsaasWebhook(validPaidPayload);
  await handleAsaasWebhook(validPaidPayload);
  expect(await countPaymentsForCharge('charge-1')).toBe(1);
});
```

Run: `npx jest src/modules/financeiro/gateways/__tests__/asaas-webhook.test.ts --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement webhook + collection service**

Map Asaas paid events to normalized `{ provider:'asaas', externalEventId, externalChargeId, status:'paid', paidAt }`. Upsert `gateway_events` before settlement. Collection rule: D+1 light, D+3 firm, D+7 internal alert.

- [ ] **Step 3: Add cron route**

`src/app/api/cron/financeiro-collections/route.ts` validates `CRON_SECRET`, then `assertModuleForJob('financeiro', moduleManifest)`.

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/modules/financeiro/gateways/__tests__/asaas-webhook.test.ts src/modules/financeiro/services/__tests__/collection-service.test.ts --runInBand`
Expected: PASS.

```bash
git add src/modules/financeiro/gateways src/modules/financeiro/services src/app/api/cron/financeiro-collections
git commit -m "feat(financeiro): process charges and collections"
```

---

## Task 7 — Dashboard, config UI and CRM summary links

**Files:**
- Create: `src/app/dashboard/financeiro/page.tsx`
- Create: `src/components/financeiro/*.tsx`
- Modify: `src/components/contacts/contact-financial-tab.tsx`
- Test: `src/components/financeiro/__tests__/FinanceDashboard.test.tsx`

- [ ] **Step 1: RED UI tests**

```tsx
import { render, screen } from '@testing-library/react';
import { FinanceDashboard } from '../FinanceDashboard';

test('renders null ratios as dash', () => {
  render(<FinanceDashboard metrics={{ budgetConversion: null, collectionRecovery: null }} />);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
});

test('shows cancel charge only for open charge with permission', () => {
  render(<FinanceDashboard charges={[{ id: 'ch1', status: 'pending' }]} canManageBudget />);
  expect(screen.getByRole('button', { name: /cancelar cobrança/i })).toBeInTheDocument();
});
```

Run: `npx jest src/components/financeiro/__tests__/FinanceDashboard.test.tsx --runInBand`
Expected: FAIL.

- [ ] **Step 2: Implement page and tabs**

Tabs: Orçamentos, Parcelas/Pagamentos, Cobranças, Config. Config masks gateway credentials. Cancel button appears only for open charges and users with `financeiro:manage_budget`.

- [ ] **Step 3: CRM summary link**

Keep CRM contact financial tab read-only. Add deep links to Financeiro. Do not reintroduce write logic into CRM.

- [ ] **Step 4: GREEN + commit**

Run: `npx jest src/components/financeiro/__tests__/FinanceDashboard.test.tsx --runInBand`
Expected: PASS.

```bash
git add src/app/dashboard/financeiro src/components/financeiro src/components/contacts/contact-financial-tab.tsx
git commit -m "feat(financeiro): add finance dashboard"
```

---

## Task 8 — Focused verification and cleanup

**Files:**
- Modify only docs/tests needed for verification. No feature expansion.

- [ ] **Step 1: Scan**

Run:
```bash
rg -n "as any|console\.log|apiKey|secret" src/modules/financeiro src/app/api/financeiro src/app/api/budgets
```
Expected: no secret logging; any `as any` removed or isolated to schema constraints.

- [ ] **Step 2: Unit + route**

Run:
```bash
npm test -- --runInBand src/modules/financeiro src/components/financeiro src/modules/comercial/services/__tests__/lead-conversion-service.test.ts
```
Expected: PASS.

- [ ] **Step 3: Integration**

Run:
```bash
npm run test:integration -- --runInBand
```
Expected: PASS. Known residual open-handle warning may appear; do not fix with `forceExit`.

- [ ] **Step 4: Static gates**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: PASS.

- [ ] **Step 5: Mutation target**

Run if Stryker config exists:
```bash
npx stryker run --mutate "src/modules/financeiro/services/**/*.ts,src/modules/financeiro/gateways/**/*.ts"
```
Expected: ≥70% mutation score. If config missing, document blocker in handoff.

- [ ] **Step 6: E2E decision**

Ask user after unit/route/integration pass: yes Playwright smoke, no unit+contract+route only, or deferred ADR.

- [ ] **Step 7: Final commit**

```bash
git status --short
git commit --allow-empty -m "test(financeiro): verify finance module gates"
```

