# Eixo 2 — Security & Integrity Hardening (execution plan)

> **Agent Orchestration:** REQUIRED SUB-SKILL: `pi-peer-planner-orchestrator` for dispatch/await/handoff. Use `workKey` per lane, `duplicatePolicy:reuse`.

**Architecture:** Legacy routes return 404 for out-of-tenant resources. Actions return `ActionError('not_found')`. Mutable queries carry tenant/budget in the predicate. CRM uses claim CAS, deterministic lease, and idempotent recovery. Every integration test receives `DATABASE_URL` exclusively from `TEST_DATABASE_URL` validated for loopback + `/synkroo_test`.

**Tech Stack:** Next.js 15 App Router, TypeScript 5.6, Drizzle ORM + `pg`, Jest + `node --test`, PostgreSQL 17 (pgvector), Cloudflare Workers (OpenNext target).

**Delta file map:**

| Task | Modify | Create |
|---|---|---|
| 0 | `scripts/integration-run.mjs` | `scripts/__tests__/integration-run.test.mjs` |
| 1 | `src/__tests__/api/tasks/route.test.ts`, `src/__tests__/api/tasks/tasks-scope/integration.test.ts` | — |
| 2 | `src/modules/followup/__tests__/inactive/integration.test.ts` | — |
| 3 | `src/__tests__/api/budgets/installments/route.test.ts`, `src/modules/financeiro/__tests__/installments-scope/integration.test.ts` | — |
| 4 | `src/modules/financeiro/services/collection-service.ts`, `src/modules/financeiro/__tests__/collection-scope/integration.test.ts` | — |
| 5 | `src/app/api/instagram/webhook/route.ts`, `src/__tests__/api/instagram/webhook/contract.test.ts` | — |
| 6 | `src/modules/crm/repositories/merge-execution-repository.ts`, `src/modules/crm/services/duplicate-execution-service.ts`, `src/modules/crm/__tests__/duplicate-execution.integration.test.ts` | `src/lib/db/migrations/0007_crm_winner_left_right.sql` |
| 7 | `src/modules/financeiro/__tests__/integration.test.ts` | — |
| 8 | No file edits | — |
| 9 | *DONE, no delta* | *DONE, no delta* |

## REQ mapping

| REQ | EARS | Task | File |
|---|---|---|---|
| REQ01 | When caller mutates another clinic task, system shall return 404 without mutation. | 1 | route |
| REQ02 | When `reativarPaciente` receives another clinic patient, system shall return `not_found`. | 2 | action |
| REQ03 | When PATCH/DELETE installment is outside budget or tenant, system shall return 404 without mutation. | 3 | route |
| REQ04 | When reminder charge is outside clinic, system shall return `missing_patient_phone`. | 4 | action |
| REQ05 | When Instagram signature is missing/invalid, system shall return 403; secret absent → 500. | 5 | route |
| REQ06 | When CRM merge recovers or races, system shall finalize exactly once or return conflict. | 6 | repo |
| REQ07 | When replacement insert fails, system shall preserve original installments. | 7 | repo |
| REQ08 | When DB tests run, system shall accept only local `synkroo_test` through `TEST_DATABASE_URL`. | 0,8,9 | runner |

## Task 0: Mandatory safe DB prerequisite

**HEAD state:** `scripts/integration-run.mjs`, `scripts/__tests__/integration-run.test.mjs` exist. 13 pre-existing test files hardened.

**Gap:** `validateTestDatabaseUrl` does not reject `http://`/`file://` protocols. No `isMainModule` exported/pure function. Windows `isMainModule` guard not tested.

**Delta `scripts/integration-run.mjs`:**
- **Pre-fix:** `validateTestDatabaseUrl('http://localhost:5432/synkroo_test')` passes (hostname OK, pathname OK).
- **Green:** Add protocol check: `if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw ...`.
- Export `isMainModule(metaUrl, argv1)` — `return pathToFileURL(resolve(argv1)).href === metaUrl` (platform-independent, forward/backslash-agnostic). Replace current `isEntrypoint` with it.
- **Pre-fix:** `fileURLToPath(import.meta.url) === resolve(process.argv[1])` fails on Windows (forward vs backslash).

**Delta `scripts/__tests__/integration-run.test.mjs`:**
- **Gap:** No http/file rejection tests. No `isMainModule` test.
- **Assertions:** `assert.throws(() => validateTestDatabaseUrl('http://localhost:5432/synkroo_test'))`. `assert.throws(() => validateTestDatabaseUrl('file:///tmp/db'))`. `assert.doesNotThrow(() => validateTestDatabaseUrl('postgresql://127.0.0.1:5432/synkroo_test'))`. `assert.doesNotThrow(() => validateTestDatabaseUrl('postgres://localhost:5432/synkroo_test'))`.
- **isMainModule:** `assert.ok(isMainModule(import.meta.url, process.argv[1]))` when script invoked directly. `assert.ok(!isMainModule('file:///fake.mjs', process.argv[1]))`. `assert.ok(isMainModule('file:///C:/project/script.mjs', 'C:\\project\\script.mjs'))` (Windows backslashes).
- **Acceptance:** `node --test scripts/__tests__/integration-run.test.mjs` → exits 0, all protocol + `isMainModule` tests.

## Task 1: Scope task PUT/DELETE

**HEAD state:** `src/app/api/tasks/route.ts` — PUT `.where(and(eq(tasks.id, id), eq(tasks.clinicId, auth.profile!.clinic_id)))`. DELETE same. `.returning()` → empty = 404.

**ClinicId mechanism:** **UNREAD** — route never reads `clinicId` from request body/query/header. `auth.profile!.clinic_id` sourced from JWT session only. Zod schema doesn't accept `clinicId`. Body/query/header forgery is structurally impossible; any spoofed value is simply ignored.

**Gap:** No unit test asserts forged clinicId in body/query/header is ignored AND the mocked repo received auth clinicId in the `.where()` predicate. No integration test asserts DB unchanged row count.

**Delta `src/__tests__/api/tasks/route.test.ts`:**
- **Pre-fix:** No spoofing regression exists.
- **3 unit assertions:** Each creates a request with forged clinicId in (1) body JSON (`{"clinicId":"clinic-B"}`), (2) query param (`?clinicId=clinic-B`), (3) header (`x-clinic-id: clinic-B`). Each asserts: response status 404 + the mocked `mockUpdWhere`/`mockDelWhere` received `eq(tasks.clinicId, AUTH_CLINIC)` (auth session clinicId, not the forgery). Proves forgery is UNREAD — route never processed the fake value.
- **Acceptance:** `npx jest src/__tests__/api/tasks/route.test.ts` → exits 0, 3 spoofing tests with repo arg assertions.

**Delta `src/__tests__/api/tasks/tasks-scope/integration.test.ts`:**
- **Assertion:** DB integration: attempt PUT/DELETE with foreign clinicId in session → 404. SELECT COUNT before/after unchanged.
- **Acceptance:** `npm run test:integration:run -- src/__tests__/api/tasks/tasks-scope/integration.test.ts` → exits 0, DB unchanged.

## Task 2: Scope patient reactivation

**HEAD state:** `reativar-paciente.ts` passes `ctx.clinicId`. Service predicates on patientId + clinicId.

**ClinicId mechanism:** **UNREAD** — action never reads clinicId from input. `ctx.clinicId` sourced from auth session. Any forged clinicId in action input is ignored.

**Gap:** No test asserts forged clinicId (in request body/params passed to action) is rejected while ctx.clinicId is used. No test proves foreign patient leaves row unchanged.

**Delta `src/modules/followup/__tests__/inactive/integration.test.ts`:**
- **Pre-fix:** No forged-clinicId regression.
- **Assertion 1:** Attempt reactivation with forged clinicId in action input → `ActionError('not_found')`. Action's `ctx.clinicId` (from auth) is used, not the forgery — ActionResult returns `not_found` because no patient exists for the wrong clinic.
- **Assertion 2:** Attempt reactivation with foreign patientId under same clinic ctx → `ActionError('not_found')`. SELECT COUNT on patient table shows zero change.
- **Acceptance:** `npm run test:integration:run -- src/modules/followup/__tests__/inactive/integration.test.ts` → exits 0, forged clinicId + foreign patient unchanged.

## Task 3: Scope installment route atomically

**HEAD state:** `financeiro-scope-repository.ts` mutations JOIN on `budgets.clinic_id`. Route delegates to `budget-scope-service.ts`.

**ClinicId mechanism:** **UNREAD** — route uses `auth.profile!.clinic_id` from JWT session. Zod schema doesn't accept `clinicId`. Body/query/header forgery ignored.

**Gap:** Same as Task1 — no body/query/x-clinic spoofing tests with repo arg assertions.

**Delta `src/__tests__/api/budgets/installments/route.test.ts`:**
- **Pre-fix:** No spoofing tests.
- **3 assertions:** Body, query, x-clinic header spoofing. Each asserts 404 + mocked repo received auth clinicId.
- **Acceptance:** `npx jest src/__tests__/api/budgets/installments/route.test.ts` → exits 0.

**Delta `src/modules/financeiro/__tests__/installments-scope/integration.test.ts`:**
- **Assertion:** DB unchanged (SELECT COUNT) after foreign clinicId attempt.
- **Acceptance:** `npm run test:integration:run -- src/modules/financeiro/__tests__/installments-scope/integration.test.ts` → exits 0.

## Task 4: Scope reminder before supplied phone

**HEAD state:** `collection-service.ts` → `getPaymentChargeForClinic(chargeId, clinicId)`.

**ClinicId mechanism:** **UNREAD** — action uses `ctx.clinicId` from auth. Forged clinicId in input ignored.

**Gap:** No test asserts forged clinicId in action input is rejected. No test proves supplied phone cannot bypass tenant scope.

**Delta `src/modules/financeiro/services/collection-service.ts` (or its action entry):**
- **Pre-fix:** Forged clinicId in action input may reach service. Supplied phone from foreign patient could bypass scope.
- **Assertion 1:** Call action with forged clinicId → service uses `ctx.clinicId`. Foreign charge → `missing_patient_phone`.
- **Assertion 2:** Attempt `sendReminder` with foreign chargeId + valid supplied phone for that foreign patient → `missing_patient_phone` (scope check happens BEFORE phone resolution). Charge row for original clinic unchanged (SELECT COUNT).
- **Acceptance:** `npm run test:integration:run -- src/modules/financeiro/__tests__/collection-scope/integration.test.ts` → exits 0, forged clinicId + phone bypass tests.

## Task 5: Fail-closed Instagram webhook

**HEAD state:** `src/app/api/instagram/webhook/route.ts` — reads `INSTAGRAM_APP_SECRET` before rate-limit. `startsWith('sha256=')` + length guard + `timingSafeEqual`. Body via `request.text()`. JSON.parse after verification (correct order).

**Gaps:**
1. `request.text()` decodes UTF-8; HMAC must be over raw bytes (`arrayBuffer()`).
2. `startsWith('sha256=')` allows non-hex chars; need regex `^sha256=[0-9a-fA-F]{64}$`.
3. No malformed/truncated/padded signature tests.
4. No "signed-valid-JSON-with-X-whitespace, send-different-JSON-with-Y-whitespace" test (HMAC mismatch → 403).
5. Parse only after verification — already correct order, but must use raw bytes body for parse.

**Delta `src/app/api/instagram/webhook/route.ts`:**
- **Pre-fix:** `const body = await request.text()` → UTF-8 decoded string. `createHmac('sha256', secret).update(body)` uses text, not raw bytes.
- **Green:** `const rawBody = Buffer.from(await request.arrayBuffer())` — raw bytes from wire. `createHmac('sha256', secret).update(rawBody).digest('hex')` — `update()` accepts `Buffer`. `const body = rawBody.toString('utf8')` for `JSON.parse(body)` ONLY after HMAC verification passes.
- **Pre-fix:** `startsWith('sha256=')` lets `sha256=GGGG...` pass (non-hex chars) until `timingSafeEqual`.
- **Green:** `!/^sha256=[0-9a-fA-F]{64}$/.test(signature)` → 403. Remove length guard (regex covers it).

**Delta `src/__tests__/api/instagram/webhook/contract.test.ts`:**
- **Gap:** No format/bytes/whitespace tests.
- **Assertions:**
  1. `non-hex chars (sha256=GGGG...GG)` → 403.
  2. `truncated hex (sha256= + 63 hex chars)` → 403.
  3. `trailing whitespace in signature header` → 403 (regex rejects trailing space).
  4. `leading whitespace in signature header` → 403.
  5. **compact-vs-whitespace JSON mismatch:** Sign payload `{"a":1}` (compact, no spaces). Compute HMAC over compact bytes. Send body `{ "a": 1 }` (pretty, with spaces) with the compact-JSON HMAC signature → route reads raw bytes via `arrayBuffer()`, computes HMAC over `{ "a": 1 }` bytes → HMAC differs → 403. Proves whitespace differences in valid JSON produce different HMAC — attacher cannot reuse a compact-JSON signature on a pretty-JSON body.
  6. **raw bytes vs text encoding:** Mock sends binary payload `Buffer.from([0xff,0xfe,...])`. Route reads via `arrayBuffer()`. HMAC on raw bytes. String-based HMAC would differ — proves arrayBuffer path is required.
- **Acceptance:** `npx jest src/__tests__/api/instagram/webhook/contract.test.ts` → exits 0, includes format/whitespace/bytes/signed-one-send-other tests.

## Task 6: CRM merge CAS and recovery

**HEAD state:** `merge-execution-repository.ts` — `claimSuggestion` (incl. clinicId). `markSuggestionFailed` / `finalizeMergeAndDismissSiblings`. `MERGE_LEASE_MS=30000`. Integration tests pass.

**Migration constraints (0004):**
```sql
CONSTRAINT "crm_duplicate_suggestions_status_check" CHECK (status IN ('pending','approved','executing','merged','failed','dismissed'))
CONSTRAINT "crm_duplicate_suggestions_owner_type_check" CHECK (owner_type IN ('patient','lead'))
CONSTRAINT "crm_duplicate_suggestions_winner_check" CHECK (status NOT IN ('executing','merged') OR winner_confirmed_id IS NOT NULL)
```
Winner constraint: **not-null when executing/merged**. Does NOT enforce `winner_confirmed_id IN (left_id, right_id)`.

**DECISION: winner_confirmed_id must be IN (left_id, right_id).** Add migration 0007.

**Gaps:**
1. `markSuggestionFailed` does NOT include `clinicId` in WHERE.
2. `finalizeMergeAndDismissSiblings` winner finalize CAS does NOT include `clinicId`.
3. No cross-clinic tests for fail or finalize.
4. Winner left/right constraint absent from DB — must add via migration 0007.

**Delta — 4 tenant predicates, all must include `clinicId`:**

| Operation | Predicate | clinicId? |
|---|---|---|
| `claimSuggestion` | `id + clinicId + status('approved')` | ✅ |
| `markSuggestionFailed` | `id + mergeOperationKey + status('executing')` | ❌ add `clinicId` |
| `finalizeMerge` (winner) | `id + mergeOperationKey + status('executing')` | ❌ add `clinicId` |
| `finalizeMerge` (sibling dismiss) | `clinicId + ownerType + status!='merged'` | ✅ |

**Delta `src/modules/crm/repositories/merge-execution-repository.ts`:**
- **Pre-fix:** `markSuggestionFailed('id','key','reason')` — no clinicId check.
- **Green:** Add `clinicId: string` parameter. Where: `and(eq(id, id), eq(clinicId, clinicId), eq(mergeOperationKey, mergeOperationKey), eq(status, 'executing'))`.
- **Pre-fix:** `finalizeMergeAndDismissSiblings` winner WHERE: `id + mergeOperationKey + status`.
- **Green:** Add `eq(crmDuplicateSuggestions.clinicId, clinicId)` to winner finalize WHERE.

**Delta `src/modules/crm/services/duplicate-execution-service.ts`:**
- Pass `clinicId` to `markSuggestionFailed` and `finalizeMergeAndDismissSiblings`.

**Delta `src/modules/crm/__tests__/duplicate-execution.integration.test.ts`:**
- **Pre-fix:** Only `claimSuggestion` has foreign clinic test.
- **3 foreign no-op assertions:**
  1. `claimSuggestion returns false for foreign clinic` — ✅ exists.
  2. `markSuggestionFailed with foreign clinicId returns false` — claim with clinic-A, fail with foreign-B → false. Row unchanged (still executing).
  3. `finalizeMergeAndDismissSiblings with foreign clinicId returns false` — claim with clinic-A, finalize with foreign-B → false. Row unchanged (still executing).
- **Acceptance:** `npm run test:integration:run -- src/modules/crm/__tests__/duplicate-execution.integration.test.ts` → exits 0, all 3 foreign no-ops.

**Delta `src/lib/db/migrations/0007_crm_winner_left_right.sql`** (REQUIRED — winner invariant):
```sql
ALTER TABLE crm_duplicate_suggestions
  ADD CONSTRAINT crm_duplicate_suggestions_winner_member_check
  CHECK (winner_confirmed_id IS NULL OR winner_confirmed_id IN (left_id, right_id));
```
- **Acceptance:** `npm run db:migrate` → exits 0, constraint applied. Winner_confirmed_id must be left_id or right_id (not any other UUID).

## Task 7: Transactional replacement

**HEAD state:** `installment-replacement-repository.ts` — `replaceInstallmentsAtomic` wraps DELETE+INSERT in `db.transaction()`. Schema: `amount numeric NOT NULL`, `dueDate date NOT NULL`, `budgetId FK → budgets.id`.

**Gap:** Current test uses `dueDate: 'not-a-date'` (type coercion, may be client-caught). Need deterministic server-side constraint.

**Delta `src/modules/financeiro/__tests__/integration.test.ts`:**
- **Pre-fix:** `not-a-date` may be rejected by pg client before transmitting to server.
- **Green:** Replace with `replaceInstallmentsAtomic` directly (real repo path — not service layer). Send `amount: null` — Drizzle passes `NULL` as SQL parameter. Postgres rejects with `null value in column "amount" violates not-null constraint` INSIDE `db.transaction()` after DELETE executes. `null` is a valid SQL parameter value — client cannot pre-validate it.

```typescript
test('deterministic NOT NULL rollback preserves originals', async () => {
  const BUDGET_ID = '...';
  let origRows: BudgetInstallmentRow[];
  try {
    origRows = await replaceInstallments(BUDGET_ID, [
      { amount: 100, dueDate: '2026-08-15' },
      { amount: 200, dueDate: '2026-09-15' },
    ]);
    expect(origRows).toHaveLength(2);
    const origIds = origRows.map(r => r.id).sort();
    const origAmounts = origRows.map(r => r.amount).sort();
    const origDueDates = origRows.map(r => r.dueDate).sort();

    await expect(
      replaceInstallmentsAtomic(BUDGET_ID, [
        { budgetId: BUDGET_ID, amount: null as unknown as string, dueDate: '2026-10-01', status: 'pending' },
      ]),
    ).rejects.toThrow();

    const remaining = await listInstallments(BUDGET_ID);
    // Assert count
    expect(remaining).toHaveLength(2);
    // Assert IDs preserved
    expect(remaining.map(r => r.id).sort()).toEqual(origIds);
    // Assert amounts preserved
    expect(remaining.map(r => r.amount).sort()).toEqual(origAmounts);
    // Assert dueDates preserved
    expect(remaining.map(r => r.dueDate).sort()).toEqual(origDueDates);
  } finally {
    await pool.query('DELETE FROM budget_installments WHERE budget_id = $1', [BUDGET_ID]);
  }
});
```
- **Acceptance:** `npm run test:integration:run -- src/modules/financeiro/__tests__/integration.test.ts` → exits 0, count + IDs + amounts + dueDates verified.

## Task 8: CI integration service

**HEAD state:** `.github/workflows/ci.yml` — `pgvector/pgvector:pg16` service, health check, integration step with `TEST_DATABASE_URL`.

**Status: PARTIAL.** No green GitHub Actions run. Push separately authorized by planner. No file edits in this delta.

- **Acceptance:** Push to remote → GitHub Actions `ci` job green → integration step exits 0.

## Task 9: Focused security gates

**HEAD state:** All configs/scripts/tests exist. Verified:
- `stryker.services.config.json`: positional config (`stryker run stryker.services.config.json`, no `--config` flag). `concurrency: 1`. `jest-runner`. `coverageAnalysis: perTest`. `jest.config.js` base. `projectType: custom`. 18 `ignorePatterns`. 6 `mutate`. Focused 5-path `testMatch`. `thresholds: {high:80, low:70, break:70}`.
- `stryker.repositories.config.json`: `concurrency: 1`. `jest.security.integration.config.js` config, custom projectType. 3 `mutate`. 3-path `testMatch`.
- `jest.security.config.js`: 9 testMatch paths, 9 collectCoverageFrom, per-file 80% thresholds.
- `jest.security.integration.config.js`: 4 testMatch paths, 5 collectCoverageFrom, per-file 80% thresholds.
- `scripts/repository-mutation-run.mjs`: pipeline migrate→seed→Jest security integration→Stryker repos.

**Status: DONE.** No delta needed.

## NOT in scope

- Global Jest threshold increase.
- Production migrations.
- Webhook provider redesign.
- Browser E2E tests (see `docs/adr/e2e-deferral.md`).

## Final gate checklist

- [ ] Task 0: protocol + `isMainModule` tests.
- [ ] Task 1: 3 spoofing tests + repo arg assertions + DB unchanged integration.
- [ ] Task 2: forged clinicId + foreign patient unchanged.
- [ ] Task 3: 3 spoofing tests + repo args + DB unchanged.
- [ ] Task 4: forged clinicId + phone bypass tests.
- [ ] Task 5: `arrayBuffer()` raw bytes + regex + whitespace/bytes/signed-one-send-other tests.
- [ ] Task 6: `clinicId` in all 4 tenant predicates + cross-clinic all 3 + migration 0007 (winner IN left/right).
- [ ] Task 7: `try/finally` + `amount: null` + count/IDs/amounts/dueDates.
- [ ] Task 8: push → green GA run.
- [ ] Plan `??` unstaged, no source edits.
