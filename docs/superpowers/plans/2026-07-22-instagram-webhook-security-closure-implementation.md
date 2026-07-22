# Instagram Webhook Security Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Track steps with checkboxes.

**Goal:** Validate Instagram webhook HMAC over exact request bytes and reject malformed signatures without weakening the fail-closed contract.

**Architecture:** The route owns raw request extraction and verification. Tests sign the exact submitted bytes; no new helper or module boundary is necessary.

**Tech Stack:** Next.js 15, TypeScript, Node `crypto`, Jest.

**Agent Orchestration:** Single-Agent Looped — one tightly coupled security fix, TDD per behavior.

## File map

| Task | Files |
|---|---|
| 1 | `src/app/api/instagram/webhook/__tests__/route.test.ts` |
| 2 | `src/__tests__/api/instagram/webhook/contract.test.ts` |
| 3 | `src/app/api/instagram/webhook/route.ts` and both tests |

### Task 1: Repair the stale legacy test contract

**Files:** Modify `src/app/api/instagram/webhook/__tests__/route.test.ts`.

- [ ] **Step 1: Add signing support and a configured app secret**

```ts
import { createHmac } from 'crypto'

const APP_SECRET = 'test-app-secret-at-least-32-chars!!'
const signBody = (body: string) =>
  `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`
```

Set `INSTAGRAM_APP_SECRET: APP_SECRET` in the test environment. Add `x-hub-signature-256: signBody(JSON.stringify(payload))` to the non-Instagram POST request.

- [ ] **Step 2: Verify the existing stale test is RED before its update**

Run:
```bat
cmd.exe /c npx jest --runTestsByPath src/app/api/instagram/webhook/__tests__/route.test.ts --runInBand
```
Expected: FAIL at `should ignore non-Instagram payloads`, `Expected: 200`, `Received: 500`.

- [ ] **Step 3: Verify the legacy contract is GREEN after the test update**

Run the same command. Expected: PASS; signed non-Instagram payload still returns `{ status: 'ignored' }`.

- [ ] **Step 4: Commit test alignment**

```bash
git add src/app/api/instagram/webhook/__tests__/route.test.ts
git commit -m "test(instagram): sign legacy webhook payload"
```

### Task 2: Add RED tests for Security Task 5

**Files:** Modify `src/__tests__/api/instagram/webhook/contract.test.ts`.

- [ ] **Step 1: Add strict signature format cases**

Add complete tests asserting `403` for non-hex, truncated, leading-whitespace and trailing-whitespace signatures.

```ts
it.each([
  `sha256=${'G'.repeat(64)}`,
  `sha256=${'a'.repeat(63)}`,
  ` sha256=${'a'.repeat(64)}`,
  `sha256=${'a'.repeat(64)} `,
])('rejects malformed signature %s', async (signature) => {
  const request = new Request('https://localhost/api/instagram/webhook', {
    method: 'POST',
    headers: { 'x-hub-signature-256': signature },
    body: JSON.stringify({ object: 'instagram', entry: [] }),
  });
  expect((await POST(request as any)).status).toBe(403);
});
```

- [ ] **Step 2: Add exact-byte mismatch case**

Sign `'{"a":1}'`, submit `'{ "a": 1 }'`, and assert `403`. This is a permanent regression test: the current text-based implementation already rejects different signed JSON bytes.

- [ ] **Step 3: Add raw binary case**

Build a fresh request from `const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x61])` and sign exactly that buffer. On HEAD, the HMAC over decoded text mismatches and resolves `403`. After the raw-byte fix, verification succeeds and the subsequent invalid JSON parse rejects with `SyntaxError`. This proves the signature was checked over raw bytes without requiring invalid binary to be valid JSON.

```ts
it('verifies a signature calculated over raw binary bytes before JSON parsing', async () => {
  const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x61]);
  const signature = `sha256=${createHmac('sha256', VALID_APP_SECRET).update(bytes).digest('hex')}`;
  const request = new Request('https://localhost/api/instagram/webhook', {
    method: 'POST', headers: { 'x-hub-signature-256': signature }, body: bytes,
  });
  await expect(POST(request as any)).rejects.toThrow(SyntaxError);
});
```

- [ ] **Step 4: Verify RED**

Run:
```bat
cmd.exe /c npx jest --runTestsByPath src/__tests__/api/instagram/webhook/contract.test.ts --runInBand
```
Expected: the 64-character non-hex signature test and raw-binary test fail. Truncated/whitespace and different-JSON-byte tests may already pass and serve as regression coverage.

### Task 3: Implement raw-byte HMAC verification

**Files:** Modify `src/app/api/instagram/webhook/route.ts`; verify both test files.

- [ ] **Step 1: Replace text-first extraction and prefix check**

```ts
const rawBody = Buffer.from(await request.arrayBuffer());
// read secret/signature and rate-limit in the existing order
if (!/^sha256=[0-9a-fA-F]{64}$/.test(signature)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
}
const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
}
const payload = JSON.parse(rawBody.toString('utf8'));
```

Keep secret-missing before rate limit. Regex guarantees equal input lengths before `timingSafeEqual`.

- [ ] **Step 2: Verify GREEN**

Run:
```bat
cmd.exe /c npx jest --runTestsByPath src/app/api/instagram/webhook/__tests__/route.test.ts src/__tests__/api/instagram/webhook/contract.test.ts --runInBand
```
Expected: PASS.

- [ ] **Step 3: Run focused regression gates**

```bat
cmd.exe /c npx jest src/modules/atendimento --runInBand
cmd.exe /c npm run typecheck
```
Expected: both exit 0. If PostgreSQL-dependent tests are skipped/blocked, record rather than changing test infrastructure.

- [ ] **Step 4: Commit implementation**

```bash
git add src/app/api/instagram/webhook/route.ts src/__tests__/api/instagram/webhook/contract.test.ts
git commit -m "fix(instagram): verify webhook HMAC over raw bytes"
```

## Self-review

- Security Task 5 requirements map to Tasks 2–3: raw bytes, strict format, whitespace/length/non-hex rejection, parse-after-verify, and raw-byte test.
- No Follow-up, Agents SDK, Cloudflare configuration, or API redesign is in scope.
- All production changes follow a verified RED → GREEN sequence.
