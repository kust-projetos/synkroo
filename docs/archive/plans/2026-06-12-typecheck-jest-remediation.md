# Typecheck + Jest Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Synkroo repo type-clean and make Jest exit cleanly after tests.

**Architecture:** Keep fixes test-local where errors are test mocks. Do not relax `tsconfig.json`. Add explicit `typecheck` npm script so CI/local checks share one command.

**Tech Stack:** Next.js 15, TypeScript 5.6, Jest 29, Drizzle-style repository mocks.

**Agent Orchestration:** Supervisor-Workers — planner owns plan/validation; `worker1` coder owns implementation in isolated worktree.

---

## Context / Evidence

| Command | Result | Evidence |
|---|---|---|
| `npm run lint` | PASS | no ESLint warnings/errors |
| `npm test -- --runInBand` | WARN | 58/58 suites, 712/712 tests pass; Jest hangs with open handles |
| `npm run build` | PASS | Next build green; warning: `MINIMAX_API_KEY` missing |
| `npx tsc --noEmit` | FAIL | type errors in appointment, WhatsApp, lead notification, memory tests |

## Requirements (EARS)

- REQ-1: When developer runs `npm run typecheck`, project shall execute `tsc --noEmit`.
- REQ-2: When developer runs `npm run typecheck`, command shall exit `0` without changing `tsconfig.json` strictness.
- REQ-3: When developer runs `npm test -- --runInBand`, Jest shall pass all suites and exit without open-handle timeout.
- REQ-4: When developer runs `npm run lint` and `npm run build`, both commands shall remain green.
- REQ-5: If open handles are caused by test mocks/timers, tests shall close/reset them without hiding failures.

## File Map

| File | Responsibility | Expected change |
|---|---|---|
| `package.json` | npm scripts | add `typecheck`: `tsc --noEmit` |
| `jest.setup.ts` | global Jest cleanup | only if open handles need shared teardown |
| `src/__tests__/api/appointments/conflict-detection.test.ts` | appointment API tests | fix mock return types / POST signature calls |
| `src/__tests__/whatsapp.webhook.test.ts` | WhatsApp webhook test | fix invalid thenable typing; maybe cleanup handles |
| `src/app/api/whatsapp/webhook/__tests__/route.test.ts` | route-local webhook test | fix invalid thenable typing; maybe cleanup handles |
| `src/services/leads/__tests__/lead-notification.service.test.ts` | lead notification tests | use `Lead`-compatible fixtures |
| `src/services/leads/lead-notification.service.ts` | lead notifications | only if production signature mismatch is real |
| `src/services/memory/__tests__/memory.manager.test.ts` | memory manager tests | align with L4 service API or mock typed service |
| `src/services/memory/L4-conversation.service.ts` | L4 conversations | only add `updateStatus` if product API needs it |

## Tests

| Type | Tool | Scope | Required |
|---|---|---|---|
| Unit | Jest | affected test files | yes |
| Contract | TypeScript | `npm run typecheck` | yes |
| Build | Next | `npm run build` | yes |
| Lint | Next lint | `npm run lint` | yes |
| Open handles | Jest | `--detectOpenHandles` | yes |
| Mutation | N/A | test-only fixes | no |
| E2E | Playwright | no UI behavior change | no |

---

## Task 1: Add typecheck script

**Files:**
- Modify: `package.json`

- [ ] Add script:

```json
"typecheck": "tsc --noEmit"
```

- [ ] Run:

```bash
npm run typecheck
```

Expected before fixes: FAIL with current TS errors.

## Task 2: Fix appointment conflict test types

**Files:**
- Modify: `src/__tests__/api/appointments/conflict-detection.test.ts`

- [ ] Replace `makeAppt` return annotation with awaited repository row type, not `Promise<...>`.

Suggested shape:

```ts
type AppointmentWithJoins = Awaited<ReturnType<typeof import('@/repositories/appointments').findByIdWithJoins>>
type AppointmentRow = NonNullable<AppointmentWithJoins>

function makeAppt(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return { ...baseAppointment, ...overrides }
}
```

- [ ] Fix all `POST(req, makeParams())` calls if route `POST` accepts only one argument. Preserve auth test import behavior.

- [ ] Run focused checks:

```bash
npm test -- --runInBand src/__tests__/api/appointments/conflict-detection.test.ts
npm run typecheck
```

Expected: focused test PASS; appointment TS errors gone.

## Task 3: Fix WhatsApp webhook thenable mocks

**Files:**
- Modify: `src/__tests__/whatsapp.webhook.test.ts`
- Modify: `src/app/api/whatsapp/webhook/__tests__/route.test.ts`

- [ ] Replace custom `thenable.then = ...` with plain promise or typed helper.

Preferred:

```ts
limit: jest.fn().mockResolvedValue(result)
```

If chain requires thenable from `limit()`, use:

```ts
limit: jest.fn(() => Promise.resolve(result))
```

- [ ] Do not override `Promise.then` manually.

- [ ] Run:

```bash
npm test -- --runInBand src/__tests__/whatsapp.webhook.test.ts src/app/api/whatsapp/webhook/__tests__/route.test.ts
npm run typecheck
```

Expected: tests PASS; `then` TS errors gone.

## Task 4: Fix Lead fixture type mismatch

**Files:**
- Modify: `src/services/leads/__tests__/lead-notification.service.test.ts`

- [ ] Make `coolLeads` and `hotLeads` use `Lead` shape expected by `getHotLeads`.

Suggested helper:

```ts
import type { Lead } from '../leads.service'

function createMockLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    clinic_id: 'clinic-1',
    patient_id: null,
    name: 'Maria Silva',
    phone: '+5511999999999',
    email: null,
    source: 'whatsapp',
    status: 'new',
    temperature: 'hot',
    score: 85,
    interest: null,
    notes: null,
    assigned_to: null,
    last_contact_at: null,
    next_followup_at: null,
    converted_at: null,
    lost_reason: null,
    deal_value: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}
```

- [ ] Replace camelCase row fixtures passed to `mockGetHotLeads.mockResolvedValue(...)` with `createMockLead(...)`.

- [ ] Run:

```bash
npm test -- --runInBand src/services/leads/__tests__/lead-notification.service.test.ts
npm run typecheck
```

Expected: test PASS; Lead errors gone.

## Task 5: Fix L4 conversation status API mismatch

**Files:**
- Modify: `src/services/memory/__tests__/memory.manager.test.ts`
- Modify only if needed: `src/services/memory/L4-conversation.service.ts`

Decision rule:
- If product needs status mutation, add `updateStatus(conversationId, status): Promise<boolean>` to service using existing repository update path.
- If test only mocks a non-existing API, remove/adjust test to actual API.

- [ ] Prefer product API if repository has update support. Keep function small:

```ts
async updateStatus(conversationId: string, status: string): Promise<boolean> {
  try {
    await updateConversationStatus(conversationId, status)
    return true
  } catch (error) {
    dbLogger.error('Error updating conversation status', error, { conversationId, status })
    return false
  }
}
```

- [ ] If no repository update exists, change test to assert existing `getSummary`/`getById` behavior instead of invented `updateStatus`.

- [ ] Run:

```bash
npm test -- --runInBand src/services/memory/__tests__/memory.manager.test.ts
npm run typecheck
```

Expected: memory test PASS; `updateStatus` TS errors gone.

## Task 6: Identify and fix Jest open handles

**Files:**
- Modify minimal file found by diagnostics; likely `jest.setup.ts` or test mocks above.

- [ ] Run:

```bash
npm test -- --runInBand --detectOpenHandles
```

- [ ] Fix real handle source only. Common fixes:
  - close DB pool/client if test creates one;
  - clear timers in `afterEach`/`afterAll`;
  - avoid unresolved custom thenables;
  - restore mocks that start background work.

- [ ] Re-run:

```bash
npm test -- --runInBand
npm test -- --runInBand --detectOpenHandles
```

Expected: both PASS and process exits naturally.

## Task 7: Final validation

**Commands:**

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm test -- --runInBand --detectOpenHandles
npm run build
```

Expected: all exit `0`.

## Guardrails

- Do not edit `tsconfig.json` to hide errors.
- Do not add `skip`/`only` to tests.
- Do not remove tests to pass checks.
- Do not commit/push without planner approval.
- Keep changes inside claimed paths unless planner expands claim.
