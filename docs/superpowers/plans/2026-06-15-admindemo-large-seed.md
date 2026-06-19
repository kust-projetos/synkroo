# admindemo Large Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate real `large` demo data for `admindemo` so waitlist, leads/pipeline, campaigns, inactive patients, and related DB-backed dashboards stop rendering empty states.

**Architecture:** Keep the existing two-layer seed architecture. Use `scripts/seed-database.ts` for core relational volume (patients/appointments) only if needed, and implement the large scenario mainly in `src/app/api/seed/route.ts` with deterministic helper functions plus clinic-scoped cleanup/reseed for demo-owned tables.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, Supabase-backed schema, Jest.

**Agent Orchestration:** Supervisor-Workers — planner validates each task; coder executes focused file changes and verification.

---

### Agentic Design Patterns for Plan Execution

Based on 2026 research, the plan header should specify the agent orchestration model:

| Pattern | Best For | Structure |
|---------|----------|-----------|
| **Single-Agent Looped** | Simple features, single file | 1 agent proposes→tests→evaluates→iterates |
| **Supervisor-Workers** | Multiple independent sub-tasks | 1 supervisor delegates to N workers |
| **Hierarchical** | Large decomposed projects | Manager→Supervisor→Workers (3+ levels) |
| **Peer-to-Peer** | Collaborative/review tasks | Agents communicate directly |

Default: **Single-Agent Looped** for MVPs, **Supervisor-Workers** for plans with 3+ independent files.

### File Structure

**Modify:**
- `src/app/api/seed/route.ts` — add scenario-aware large seed helpers, scoped cleanup, richer waitlist/leads/campaign density, and summary/reporting.
- `scripts/seed-database.ts` — only if required to increase base patient/appointment volume for analytics and inactive-patient realism.

**Read/validate only:**
- `src/app/dashboard/lista-espera/page.tsx`
- `src/app/dashboard/leads/page.tsx`
- `src/app/dashboard/crm/pipeline/page.tsx`
- `src/components/pipeline/stage-column.tsx`
- `src/components/reports/pipeline-analytics-dashboard.tsx`
- `src/repositories/waitlist/index.ts`
- `src/repositories/leads/index.ts`
- `src/services/pipeline/pipeline-analytics.service.ts`

**Create:**
- `src/__tests__/api/seed/route.test.ts` — focused route/helper tests for large scenario behavior if no equivalent file exists.

---

### Task 1: Map the exact seed contract and scenario entry

**Files:**
- Modify: `src/app/api/seed/route.ts`
- Test: `src/__tests__/api/seed/route.test.ts`

- [ ] **Step 1: Write the failing test for scenario selection**

```ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }))

describe('GET /api/seed scenario selection', () => {
  it('accepts scenario=large and returns structured summary', async () => {
    const { GET } = await import('@/app/api/seed/route')
    const req = new NextRequest('http://localhost/api/seed?secret=test-secret&scenario=large')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.summary).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: FAIL because the route does not yet expose the large scenario path or test harness needs route support.

- [ ] **Step 3: Add minimal route parsing for scenario selection**

```ts
const scenario = request.nextUrl.searchParams.get('scenario') ?? 'default'
const isLargeScenario = scenario === 'large'
```

Add this near the top of `GET()` in `src/app/api/seed/route.ts` and thread `isLargeScenario` into seed helper counts.

- [ ] **Step 4: Run test to verify it passes or fails later for the next missing behavior**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: Either PASS for the parsing behavior or FAIL on missing downstream deterministic summary expectations.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/seed/route.ts src/__tests__/api/seed/route.test.ts
git commit -m "test: add large seed scenario contract"
```

---

### Task 2: Add deterministic helper builders for large waitlist data

**Files:**
- Modify: `src/app/api/seed/route.ts`
- Test: `src/__tests__/api/seed/route.test.ts`

- [ ] **Step 1: Write the failing test for large waitlist volume and status spread**

```ts
it('builds a large waitlist dataset with mixed statuses and urgent entries', async () => {
  const { buildWaitlistSeed } = await import('@/app/api/seed/route')
  const rows = buildWaitlistSeed({
    clinicId: 'c1',
    patientIds: Array.from({ length: 40 }, (_, i) => `p${i}`),
    dentistIds: ['d1', 'd2', 'd3'],
    procedureIds: ['proc1', 'proc2', 'proc3'],
    scale: 'large',
  })

  expect(rows.length).toBeGreaterThanOrEqual(35)
  expect(rows.some((r) => r.status === 'waiting')).toBe(true)
  expect(rows.some((r) => r.status === 'notified')).toBe(true)
  expect(rows.some((r) => r.status === 'scheduled')).toBe(true)
  expect(rows.some((r) => (r.priority ?? 0) >= 7)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: FAIL because `buildWaitlistSeed` does not exist.

- [ ] **Step 3: Implement the minimal helper in `src/app/api/seed/route.ts`**

```ts
export function buildWaitlistSeed(params: {
  clinicId: string
  patientIds: string[]
  dentistIds: string[]
  procedureIds: string[]
  scale: 'default' | 'large'
}) {
  const count = params.scale === 'large' ? 48 : 15
  const statuses = ['waiting', 'waiting', 'waiting', 'notified', 'scheduled', 'expired', 'cancelled'] as const
  const prefTimes = ['08:00:00', '09:00:00', '10:00:00', '11:00:00', '13:00:00', '14:00:00', '15:00:00', '16:00:00'] as const

  return Array.from({ length: count }, (_, i) => {
    const preferredTimeStart = prefTimes[i % prefTimes.length]
    const startHour = Number(preferredTimeStart.slice(0, 2))
    return {
      clinicId: params.clinicId,
      patientId: params.patientIds[i % params.patientIds.length],
      dentistId: params.dentistIds[i % params.dentistIds.length] ?? null,
      procedureId: params.procedureIds[i % params.procedureIds.length] ?? null,
      preferredDate: daysFromNow((i % 18) - 2),
      preferredTimeStart,
      preferredTimeEnd: `${String(Math.min(startHour + 3, 18)).padStart(2, '0')}:00:00`,
      priority: params.scale === 'large' ? ((i % 10) + 1) : randomInt(1, 5),
      status: statuses[i % statuses.length],
      notes: `Seed waitlist ${i + 1}`,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: PASS for waitlist helper coverage.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/seed/route.ts src/__tests__/api/seed/route.test.ts
git commit -m "feat: add large waitlist seed builder"
```

---

### Task 3: Add deterministic helper builders for large leads and campaign density

**Files:**
- Modify: `src/app/api/seed/route.ts`
- Test: `src/__tests__/api/seed/route.test.ts`

- [ ] **Step 1: Write the failing test for large leads spread**

```ts
it('builds a large leads dataset with broad lifecycle coverage', async () => {
  const { buildLeadSeed } = await import('@/app/api/seed/route')
  const rows = buildLeadSeed('large')

  expect(rows.length).toBeGreaterThanOrEqual(80)
  expect(rows.some((r) => r.status === 'new')).toBe(true)
  expect(rows.some((r) => r.status === 'qualified')).toBe(true)
  expect(rows.some((r) => r.status === 'converted')).toBe(true)
  expect(rows.some((r) => r.status === 'lost')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: FAIL because `buildLeadSeed` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export function buildLeadSeed(scale: 'default' | 'large'): LeadSeed[] {
  const base = [
    { name: 'Registro Demo 57', phone: '11977770031', email: 'renata.albuquerque@example.com', source: 'referral', status: 'proposal', temperature: 'hot', score: 82, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Proposta enviada ontem', contact_count: 3 },
    { name: 'Marcos Vinícius', phone: '11977770032', email: 'marcos.vinicius@example.com', source: 'whatsapp', status: 'negotiation', temperature: 'hot', score: 88, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Negociando valor', contact_count: 4 },
    { name: 'Registro Demo 11', phone: '11977770033', email: 'carla.augusta@example.com', source: 'instagram', status: 'qualified', temperature: 'hot', score: 79, interest: 'Clareamento', has_budget: true, has_timeline: false, notes: 'Quer fazer antes do casamento', contact_count: 2 },
  ] satisfies LeadSeed[]

  if (scale !== 'large') return base

  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'] as const
  const temperatures = ['cold', 'warm', 'hot'] as const
  const sources = ['whatsapp', 'instagram', 'web', 'referral', 'campaign'] as const

  return Array.from({ length: 96 }, (_, i) => ({
    name: `Lead Demo ${i + 1}`,
    phone: `11988${String(100000 + i).slice(-6)}`,
    email: `lead.demo.${i + 1}@example.com`,
    source: sources[i % sources.length],
    status: statuses[i % statuses.length],
    temperature: temperatures[i % temperatures.length],
    score: 20 + (i % 80),
    interest: ['Implante Dentário', 'Clareamento', 'Aparelho Ortodôntico', 'Limpeza Profissional'][i % 4],
    has_budget: i % 2 === 0,
    has_timeline: i % 3 !== 0,
    notes: `Lead large seed ${i + 1}`,
    contact_count: i % 5,
    lost_reason: statuses[i % statuses.length] === 'lost' ? 'Sem resposta' : undefined,
  }))
}
```

- [ ] **Step 4: Replace inline lead/campaign source arrays to use helpers**

Use `const leadsData = buildLeadSeed(isLargeScenario ? 'large' : 'default')` and create the same pattern for campaigns if extra campaign density is needed.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/seed/route.ts src/__tests__/api/seed/route.test.ts
git commit -m "feat: add large lead and campaign seed builders"
```

---

### Task 4: Add clinic-scoped cleanup before reseeding demo-owned tables

**Files:**
- Modify: `src/app/api/seed/route.ts`
- Test: `src/__tests__/api/seed/route.test.ts`

- [ ] **Step 1: Write the failing test for idempotent cleanup ordering**

```ts
it('cleans demo-owned seed tables before reinserting large scenario rows', async () => {
  const deleteMock = jest.fn().mockReturnThis()
  const whereMock = jest.fn().mockResolvedValue([])
  const db = { delete: deleteMock, where: whereMock }

  const { cleanupDemoSeedTables } = await import('@/app/api/seed/route')
  await cleanupDemoSeedTables(db as any, 'clinic-1')

  expect(deleteMock).toHaveBeenCalled()
  expect(whereMock).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: FAIL because `cleanupDemoSeedTables` does not exist.

- [ ] **Step 3: Implement the cleanup helper**

```ts
export async function cleanupDemoSeedTables(db: any, clinicId: string) {
  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignRecipients.campaignId))
  await db.delete(campaigns).where(eq(campaigns.clinicId, clinicId))
  await db.delete(leadActivities).where(eq(leadActivities.leadId, leadActivities.leadId))
  await db.delete(leads).where(eq(leads.clinicId, clinicId))
  await db.delete(waitlist).where(eq(waitlist.clinicId, clinicId))
  await db.delete(patientFeedback).where(eq(patientFeedback.clinicId, clinicId))
  await db.delete(procedureGuidelines).where(eq(procedureGuidelines.clinicId, clinicId))
  await db.delete(followUpConfigs).where(eq(followUpConfigs.clinicId, clinicId))
}
```

Then refine SQL/ordering as needed to satisfy relational constraints in the real schema. If `campaignRecipients`/`leadActivities` require parent-ID-driven cleanup, query IDs first and delete children before parents.

- [ ] **Step 4: Call cleanup before inserting large scenario data**

Add this just after the clinic/user/entity lookup block in `GET()`:

```ts
if (isLargeScenario) {
  await cleanupDemoSeedTables(db, cid)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: PASS or move to the next concrete relational failure, then refine once.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/seed/route.ts src/__tests__/api/seed/route.test.ts
git commit -m "feat: make large demo seed idempotent"
```

---

### Task 5: Increase inactive-patient and appointment realism if audit still shows sparse pages

**Files:**
- Modify: `scripts/seed-database.ts`
- Test: `src/__tests__/api/seed/route.test.ts` or focused helper test if added

- [ ] **Step 1: Write the failing test for patient/appointment volume helper (only if script changes are needed)**

```ts
it('builds enough core entities for large demo analytics support', async () => {
  const { getLargeCoreSeedTargets } = await import('../../scripts/seed-database')
  const targets = getLargeCoreSeedTargets()

  expect(targets.patientCount).toBeGreaterThanOrEqual(50)
  expect(targets.appointmentCount).toBeGreaterThanOrEqual(100)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: FAIL only if script participation is needed.

- [ ] **Step 3: Implement minimal core volume extension**

If current base seed is too sparse, add helper-driven counts in `scripts/seed-database.ts`:

```ts
export function getLargeCoreSeedTargets() {
  return {
    patientCount: 60,
    appointmentCount: 120,
  }
}
```

Then extend patient generation by deriving additional seeded names beyond `PATIENT_SEED`, and increase appointment generation proportionally while preserving non-overlap and status realism.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-database.ts src/__tests__/api/seed/route.test.ts
git commit -m "feat: expand core seed volume for admindemo large"
```

---

### Task 6: Wire large builders into `/api/seed` insert loops and summary

**Files:**
- Modify: `src/app/api/seed/route.ts`
- Test: `src/__tests__/api/seed/route.test.ts`

- [ ] **Step 1: Write the failing integration-style test for large summary counts**

```ts
it('returns higher summary counts for scenario=large', async () => {
  const { GET } = await import('@/app/api/seed/route')
  const req = new NextRequest('http://localhost/api/seed?secret=test-secret&scenario=large')
  const res = await GET(req)
  const body = await res.json()

  expect(body.summary.waitlist).toBeGreaterThanOrEqual(35)
  expect(body.summary.leads).toBeGreaterThanOrEqual(80)
  expect(body.summary.campaigns).toBeGreaterThanOrEqual(10)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: FAIL until the route uses the large helper builders.

- [ ] **Step 3: Replace inline counts/loops with scenario-aware helpers**

Use patterns like:

```ts
const waitlistRows = buildWaitlistSeed({
  clinicId: cid,
  patientIds,
  dentistIds,
  procedureIds,
  scale: isLargeScenario ? 'large' : 'default',
})

for (const row of waitlistRows) {
  await db.insert(waitlist).values(row)
}
```

Do the same for leads, lead activities, campaigns, and campaign recipients.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/seed/route.ts src/__tests__/api/seed/route.test.ts
git commit -m "feat: wire large scenario into demo seed route"
```

---

### Task 7: Verify the end-to-end demo result in the app

**Files:**
- Modify: none unless a concrete defect is found

- [ ] **Step 1: Run focused automated verification**

Run: `npx jest src/__tests__/api/seed/route.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 2: Run typecheck for touched files**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Trigger the seed flow for `admindemo`**

Run the existing seed command/path used by the repo (example):

```bash
npm run dev
# then call /api/seed?secret=YOUR_SECRET&scenario=large
```

Expected: JSON summary with non-zero counts for `waitlist`, `leads`, `campaigns`, `campaign_recipients`, `appointments`.

- [ ] **Step 4: Manually verify target pages in `admindemo`**

Check these pages while logged as `admindemo`:
- `/dashboard/lista-espera`
- `/dashboard/leads`
- `/dashboard/crm/pipeline`
- `/dashboard/campanhas`
- `/dashboard/pacientes/inativos`

Expected:
- waitlist has mixed statuses and urgent entries
- leads page has list/stats populated
- pipeline columns are populated
- campaigns list/details are non-empty
- inactive patients are visible across segments

- [ ] **Step 5: If a page is still empty, trace its exact DB dependency before editing**

Run targeted searches like:

```bash
rg -n "EmptyState|Nenhum|Sem dados" src/app/dashboard src/components
rg -n "fetch\(|useQuery|from\(" src/app/dashboard/<target> src/components/<target>
```

Only then decide whether the page is in-scope for additional seed rows or out-of-scope due to external/non-seeded dependencies.

- [ ] **Step 6: Commit final verified implementation**

```bash
git add src/app/api/seed/route.ts scripts/seed-database.ts src/__tests__/api/seed/route.test.ts
git commit -m "feat: add large real demo seed for admindemo"
```

---

## Self-Review

- Spec coverage: covers waitlist, leads/pipeline, campaigns, inactive patients, and audit-driven DB-backed pages.
- Placeholder scan: each task has concrete files, commands, and code snippets.
- Type consistency: uses `scenario=large`, helper names `buildWaitlistSeed`, `buildLeadSeed`, `cleanupDemoSeedTables`, and optional `getLargeCoreSeedTargets` consistently throughout the plan.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-admindemo-large-seed.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
