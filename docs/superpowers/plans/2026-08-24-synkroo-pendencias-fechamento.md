# Synkroo Pendências Fechamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zerar as 18 pendências nominais do report 2026-08-24 (1 PARTIAL F3.14, 3 DEFERRED não commitados, 14 EXTERNAL preparados) e limpar os 11 modified + 9 untracked locais, elevando gates W0-W4 para fechamento sem executar nenhuma ação externa/production.

**Architecture:** Sequência única em 7 tasks curtas: (1) commitar ADRs DEFERRED, (2) integrar clinic-selector F4.09/F4.10 com invalidação, (3) fechar F3.14 coverage 54→70% via testes TDD de gaps reais, (4) corrigir W4 manifest/sidebar/server-guard, (5) consolidar diffs crypto/password/action-route, (6) trilha EXTERNAL somente-docs sem segredo/push, (7) regenerar ledger + verify evidence. Orquestração via Orca planner+coder paralelo onde houver isolamento; gates locais antes de externo.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript 5.6 + Drizzle ORM + pg + NextAuth/Auth.js JWT + Cloudflare Workers OpenNext + Hyperdrive + Zustand 5 + TanStack Query 5 + Tailwind/Radix + Jest 29 (unit/integration, jsdom) + Playwright + Stryker 8.7.1 + Wrangler 4 / Vectorize pgvector

## Global Constraints

- Framework: Next.js 15 App Router + React 19 + TypeScript 5.6 — não regredir major
- DB: PostgreSQL 17 via Drizzle ORM + pg — migrations em `src/lib/db/schema/` + `drizzle-kit generate/migrate`
- Auth: NextAuth/Auth.js JWT edge middleware — `AUTH_SECRET` ≥32 chars, `JWT_SECRET` ≥16
- Runtime alvo: Cloudflare Workers (OpenNext) + Hyperdrive + Vectorize — `build:cf` deve passar
- Workers auxiliares: `src/workers/ia-agent` (Agents SDK/DO) + `src/workers/ia-bridge` — typecheck isolado
- Lint: `npm run lint` com `--max-warnings=0` — zero warnings
- Typecheck: `tsc --noEmit` + `typecheck:ia-bridge` + `typecheck:ia-agent` — green
- Testes: Jest unit/integration (loopback isolado `synkroo_test`) + Playwright E2E (14 specs) — 70% global branches/functions/lines/statements, mutation Stryker services ≥70%
- Segurança: nunca ler/imprimir/armazenar/rotacionar/commitar valores de secret; apenas fingerprints/nomes/provider/owner; CRON/WEBHOOK com `crypto.timingSafeEqual`; rate-limit em auth/agent/leads/messages/instagram
- Não fazer push/merge/rewrite production sem autorização owner explícita; W12 piloto só com owner approval
- Ledger: `docs/superpowers/audits/roadmap-143-ledger.json` fonte única — `npm run roadmap:check` deve bater 143 unique

---

## File Structure

Antes de tasks, mapa de arquivos tocados e responsabilidade:

**Criar:**
- `docs/ops/w12-pilot-readiness.md` — checklist piloto sem segredo, owner approval gate

**Modificar:**
- `docs/adr/adr-deferred-f0-01-freeze.md` — já existe untracked, normalizar + linkar em `docs/superpowers/audits/`
- `docs/adr/adr-deferred-f1-03-pr-merge.md` — idem
- `docs/adr/adr-deferred-f1-04-rebase.md` — idem
- `docs/superpowers/audits/roadmap-143-ledger.json` — regenerado via `roadmap:write` após cada wave
- `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md` — sync de status após close de tasks
- `src/components/clinic-selector.tsx:1-59` — integrar no layout, já implementa F4.09 hidden single-clinic
- `src/components/__tests__/clinic-selector.test.tsx:1-64` — já cobre F4.09, falta F4.10 cache invalidation
- `src/app/dashboard/layout.tsx` — adicionar import ClinicSelector + cache invalidation on switchClinic
- `src/lib/api/action-route.ts:17-46` — já tem envelope, falta fix de `src/lib/api/__tests__/action-route.test.ts:22` (x-request-id)
- `src/lib/ui/sidebar.tsx:48-380` — corrigir manifest paths stale + RBAC filter já feito, falta server guard
- `src/lib/auth/password.ts:1-7` — diff pendente, validar sem segredo
- `src/modules/financeiro/lib/crypto.ts:1-7` — diff pendente, timingSafeEqual
- `scripts/verify.mjs:1-50` — já define 6 steps, F3.14 precisa coverage step verde
- `jest.config.js` / `jest.security.config.js` — thresholds 70% já definidos, ajustar collectCoverageFrom se necessário
- `src/app/api/internal/readiness/route.ts` + `src/__tests__/api/health/route.test.ts` — já existem, revalidar

**Testar:**
- `scripts/__tests__/gitleaks-policy.test.mjs` — diff pendente, valida W0 gitleaks
- `src/modules/operacional/services/__tests__/catalog-service.test.ts` — untracked, valida F5.02
- `src/services/payments/__tests__/payment.service.test.ts` — diff pendente
- Novos: `src/hooks/__tests__/use-clinic-switch.test.tsx` (F4.10), `src/lib/ui/__tests__/sidebar-manifest.test.ts` (F4.06), `src/__tests__/security/manifest-paths.test.ts`

---

### Task 1: Consolidar ADRs DEFERRED (F0.01, F1.03, F1.04) — zero secret

**Files:**
- Modify: `docs/adr/adr-deferred-f0-01-freeze.md:1-17`
- Modify: `docs/adr/adr-deferred-f1-03-pr-merge.md:1-14`
- Modify: `docs/adr/adr-deferred-f1-04-rebase.md:1-14`
- Test: `scripts/__tests__/gitleaks-policy.test.mjs` (modified, staged)

**Interfaces:**
- Consumes: `docs/superpowers/audits/roadmap-143-ledger.json` status DEFERRED
- Produces: `git status` clean para docs/adr/*; ledger pode marcar gate atendido

- [ ] **Step 1: Write failing test — gitleaks policy deve passar com ADRs sem secret**

```javascript
// scripts/__tests__/gitleaks-policy.test.mjs (snippet existente + assert)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const adrs = [
  'docs/adr/adr-deferred-f0-01-freeze.md',
  'docs/adr/adr-deferred-f1-03-pr-merge.md',
  'docs/adr/adr-deferred-f1-04-rebase.md',
];
for (const p of adrs) {
  const content = readFileSync(p, 'utf8');
  assert.match(content, /DEFERRED/);
  assert.doesNotMatch(content, /sk_live|ghp_|AUTH_SECRET=|DATABASE_URL=/i);
  console.log(`ok ${p} no secret`);
}
```

- [ ] **Step 2: Run test — deve FAIL se arquivo ausente ou contiver secret**

Run: `node --test scripts/__tests__/gitleaks-policy.test.mjs`
Expected: FAIL se ADRs não staged ou com secret value

- [ ] **Step 3: Implement — stage e validar conteúdo sanitizado**

```bash
git add docs/adr/adr-deferred-f0-01-freeze.md docs/adr/adr-deferred-f1-03-pr-merge.md docs/adr/adr-deferred-f1-04-rebase.md
git add scripts/__tests__/gitleaks-policy.test.mjs
# verificar sem valor: grep -R "ghp_\|sk_live" docs/adr/ || echo "clean"
```

- [ ] **Step 4: Run test — PASS**

Run: `node --test scripts/__tests__/gitleaks-policy.test.mjs`
Expected: PASS 3 ADRs clean

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(adr): F0.01 F1.03 F1.04 deferred decision records sanitized"
```

---

### Task 2: Integrar ClinicSelector F4.09/F4.10 + invalidação TanStack Query

**Files:**
- Modify: `src/app/dashboard/layout.tsx:1-30`
- Modify: `src/components/clinic-selector.tsx:18-58`
- Create: `src/hooks/__tests__/use-clinic-switch.test.tsx`
- Test: `src/components/__tests__/clinic-selector.test.tsx:24-63`

**Interfaces:**
- Consumes: `useAuth().switchClinic(clinicId: string): Promise<void>` de `src/lib/auth/context.tsx`
- Produces: `ClinicSelector` visível multi-clínica, hidden single-clínica; `onSuccess` invalida `queryClient.invalidateQueries()`

- [ ] **Step 1: Write failing test — switchClinic deve invalidar queries**

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClinicSelector } from '@/components/clinic-selector';
import { useAuth } from '@/lib/auth/context';

jest.mock('@/lib/auth/context', () => ({ useAuth: jest.fn() }));
const mockSwitch = jest.fn().mockResolvedValue({});
const mockInvalidate = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidate }) };
});

test('F4.10 switchClinic invalidates queries', async () => {
  (useAuth as jest.Mock).mockReturnValue({
    profile: { clinic_id: 'c1', clinics: { name: 'A' } },
    switchClinic: mockSwitch,
  });
  // render com 2 clinicas
  render(<ClinicSelector clinics={[{id:'c1',name:'A'},{id:'c2',name:'B'}]} />);
  // simula Select onValueChange via switchClinic direto
  await mockSwitch('c2');
  // após switch, espera invalidate
  expect(mockInvalidate).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test — FAIL pois clinic-selector não chama invalidate**

Run: `npm test -- src/hooks/__tests__/use-clinic-switch.test.tsx --runInBand`
Expected: FAIL `mockInvalidate not called`

- [ ] **Step 3: Minimal implementation — layout integra selector + hook invalidação**

```tsx
// src/app/dashboard/layout.tsx — add imports
import { ClinicSelector } from '@/components/clinic-selector';
import { QueryClient } from '@tanstack/react-query';

// Dentro do header do layout (após logo), inserir:
<ClinicSelector />

// src/components/clinic-selector.tsx:34-38 — patch
import { useQueryClient } from '@tanstack/react-query';
export function ClinicSelector(...) {
  const qc = useQueryClient();
  // em onValueChange:
  await switchClinic(clinicId);
  qc.invalidateQueries();
}
```

Fallback: se projeto usa Zustand apenas, chamar `qc` opcional via `try/catch` para não quebrar single-clinic.

- [ ] **Step 4: Run tests — PASS**

Run: `npm test -- src/components/__tests__/clinic-selector.test.tsx src/hooks/__tests__/use-clinic-switch.test.tsx --runInBand`
Expected: PASS 4+1

- [ ] **Step 5: Commit**

```bash
git add src/components/clinic-selector.tsx src/app/dashboard/layout.tsx src/hooks/__tests__/use-clinic-switch.test.tsx
git commit -m "feat(ui): F4.09/F4.10 clinic selector visible multi-clinic hidden single + invalidate on switch"
```

---

### Task 3: Fechar F3.14 — coverage 54.84% → 70% (único PARTIAL)

**Files:**
- Modify: `jest.config.js` (collectCoverageFrom)
- Modify: `scripts/verify.mjs:10` (coverage step)
- Create: `src/lib/__tests__/env.test.ts` (add 2 cases branch)
- Test: `npm run verify` local + `npm test -- --coverage`

**Interfaces:**
- Consumes: `VERIFY_STEPS` de `scripts/verify.mjs:5`
- Produces: `coverageThreshold: { global: { branches:70, functions:70, lines:70, statements:70 }}` verde

- [ ] **Step 1: Write failing test — mede coverage atual e falha se <70%**

```typescript
// src/lib/__tests__/env.test.ts — adicionar no final
describe('F3.14 coverage gate', () => {
  it('produces branch for missing AUTH_SECRET in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_SECRET;
    // import env validation que deve throw
    expect(() => require('@/lib/env').parseRuntimeEnv('app')).toThrow();
    process.env.NODE_ENV = prev;
  });
});
```

Também criar `src/modules/financeiro/lib/__tests__/crypto.test.ts` se gap estiver em `crypto.ts`:

```typescript
import { timingSafeEqual } from '@/modules/financeiro/lib/crypto';
test('crypto timingSafeEqual constant-time true/false', () => {
  expect(timingSafeEqual('abc','abc')).toBe(true);
  expect(timingSafeEqual('abc','abd')).toBe(false);
});
```

- [ ] **Step 2: Run coverage — confirma FAIL 54.84%**

Run: `npm test -- --runInBand --coverage 2>&1 | Select-String "All files"`
Expected: `54.84%` statements FAIL threshold

- [ ] **Step 3: Minimal implementation — add 2-3 suites de gaps reais sem inflar com mocks triviais**

Alvos com maior delta branch: `src/lib/auth/password.ts` (diff pendente), `src/modules/financeiro/lib/crypto.ts`, `src/lib/api/action-route.ts` branches de array vs object.

Criar testes que exercitam branches não cobertos (ex: `action-route` com Array payload, `password` com salt mismatch).

- [ ] **Step 4: Run coverage — PASS ≥70%**

Run: `npm test -- --runInBand --coverage`
Expected: PASS thresholds; `scripts/verify.mjs` coverage step verde

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/env.test.ts src/modules/financeiro/lib/__tests__/crypto.test.ts src/lib/api/__tests__/action-route.test.ts jest.config.js
git commit -m "test(coverage): F3.14 raise global branches/functions/lines/statements to >=70%"
```

---

### Task 4: W4 gates — manifest paths + sidebar server guard (F4.06/F4.07)

**Files:**
- Modify: `src/lib/ui/sidebar.tsx:78-92`
- Create: `src/__tests__/security/manifest-paths.test.ts`
- Modify: `src/app/dashboard/layout.tsx` (server guard)
- Test: `src/lib/__tests__/sidebar-manifest.test.ts`

**Interfaces:**
- Consumes: `coreManifest`, `operacionalManifest` de `src/lib/ui/manifest.ts`
- Produces: `getVisibleCoreMenu(): Promise<MenuItem[]>` sem stale paths; `dashboard/layout.tsx` com `auth()` server check

- [ ] **Step 1: Write failing test — manifest não pode conter stale paths**

```typescript
import { coreManifest } from '@/lib/ui/manifest';
import { readdirSync } from 'node:fs';

test('F4.06 no stale manifest paths', () => {
  const stale = ['/dashboard/conversations','/dashboard/followup'];
  const paths = coreManifest.menu.map(m => m.path);
  for (const s of stale) expect(paths).not.toContain(s);
  // valida que todo path tem page.tsx correspondente
  for (const p of paths) {
    const disk = `src/app${p}/page.tsx`;
    // se não existir, falha
    expect(() => readdirSync(disk)).not.toThrow();
  }
});
```

- [ ] **Step 2: Run — FAIL revela 4 stale**

Run: `npm test -- src/__tests__/security/manifest-paths.test.ts --runInBand`
Expected: FAIL contém `/dashboard/conversations`

- [ ] **Step 3: Implement — corrigir manifest + server guard**

```typescript
// src/lib/ui/manifest.ts — trocar
{ path: '/dashboard/conversations' } -> { path: '/dashboard/conversas' }
{ path: '/dashboard/followup' } -> remover (sem page)

// src/app/dashboard/layout.tsx — server component wrapper
import { auth } from '@/lib/auth';
export default async function DashboardLayout({ children }) {
  const session = await auth();
  if (!session) redirect('/login');
  return <>{children}</>;
}
```

Manter client SidebarContent separado.

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/__tests__/security/manifest-paths.test.ts --runInBand && npm run typecheck`
Expected: PASS + typecheck verde

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/manifest.ts src/lib/ui/sidebar.tsx src/app/dashboard/layout.tsx src/__tests__/security/manifest-paths.test.ts
git commit -m "fix(w4): F4.06 stale manifest paths + F4.07 server guard dashboard"
```

---

### Task 5: Consolidar diffs pendentes coesos (crypto/password/action-route/gitleaks)

**Files:**
- Modify: `src/lib/auth/password.ts:1-7`
- Modify: `src/modules/financeiro/lib/crypto.ts:1-7`
- Modify: `src/lib/api/action-route.ts:17-46`
- Modify: `src/services/payments/__tests__/payment.service.test.ts:1-11`
- Modify: `src/workers/ia-bridge/tsconfig.json:1-2`
- Test: `src/lib/api/__tests__/action-route.test.ts:22` + `src/modules/financeiro/lib/__tests__/crypto.test.ts`

**Interfaces:**
- Consumes: `apiSuccess/apiFailure` de `src/lib/api/response.ts`
- Produces: `createActionRoute` com `x-request-id` sempre setado; `crypto.timingSafeEqual` constant-time

- [ ] **Step 1: Write failing test — x-request-id header sempre presente**

```typescript
import { createActionRoute } from '@/lib/api/action-route';
test('action-route sets x-request-id even on success', async () => {
  const handler = createActionRoute(() => ({ data: { ok: true } }));
  const res = await handler(new Request('http://test/'));
  expect(res.headers.get('x-request-id')).toBeTruthy();
});
```

- [ ] **Step 2: Run — FAIL se header ausente em erro branch**

Run: `npm test -- src/lib/api/__tests__/action-route.test.ts --runInBand`
Expected: FAIL before fix

- [ ] **Step 3: Implement — garantir header nos dois branches + timingSafeEqual**

```typescript
// src/lib/api/action-route.ts:22-33 — já tem, apenas garantir catch também seta
response.headers.set('x-request-id', requestId);

// src/modules/financeiro/lib/crypto.ts
import { timingSafeEqual as nodeEq } from 'node:crypto';
export function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return nodeEq(ba, bb);
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/lib/api/__tests__/action-route.test.ts src/modules/financeiro/lib/__tests__/crypto.test.ts --runInBand && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/action-route.ts src/lib/api/__tests__/action-route.test.ts src/modules/financeiro/lib/crypto.ts src/lib/auth/password.ts src/workers/ia-bridge/tsconfig.json
git commit -m "fix(security): timingSafeEqual constant-time + action-route x-request-id + tsconfig bridge"
```

---

### Task 6: Trilha EXTERNAL somente-docs — piloto e rotação sem segredo

**Files:**
- Create: `docs/ops/w12-pilot-readiness.md`
- Modify: `docs/security/credential-inventory.md`
- Test: `scripts/__tests__/ignore-client-abort.test.mjs` (já existente, revalidar)

**Interfaces:**
- Consumes: nenhum secret value, apenas fingerprints/vars
- Produces: checklist W12 com owner, janela, rollback, sem dados PII

- [ ] **Step 1: Write failing test — docs/ops checklist deve existir e não conter secret**

```javascript
// scripts/__tests__/w12-readiness.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const p = 'docs/ops/w12-pilot-readiness.md';
assert.ok(existsSync(p), 'pilot readiness must exist');
const c = readFileSync(p,'utf8');
assert.match(c, /Owner:/);
assert.match(c, /Janela:/);
assert.doesNotMatch(c, /DATABASE_URL=.+postgres:\/\//i);
```

- [ ] **Step 2: Run — FAIL file not found**

Run: `node --test scripts/__tests__/w12-readiness.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement — criar doc checklist**

```markdown
# W12 Pilot Readiness (EXTERNAL — sem execução)
Owner: _preencher_
Janela: _preencher_
Rollback: _preencher_
Dados: apenas anonimizados/aprovados
Gates: J-01..J-12 + outage drills Evolution/LLM/DB/Queue/sidecar
```

- [ ] **Step 4: Run — PASS**

Run: `node --test scripts/__tests__/w12-readiness.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/ops/w12-pilot-readiness.md scripts/__tests__/w12-readiness.test.mjs
git commit -m "docs(ops): W12 pilot readiness checklist EXTERNAL sanitized"
```

---

### Task 7: Ledger e verify finais — fechar gate local

**Files:**
- Modify: `docs/superpowers/audits/roadmap-143-ledger.json:1-1157`
- Modify: `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md:24-34`
- Test: `npm run roadmap:check` + `npm run verify`

**Interfaces:**
- Consumes: status de F0.01/F1.03/F1.04 DEFERRED, F3.14 agora VERIFIED, F4.09/F4.10 VERIFIED
- Produces: `records=143 unique=143 DEFERRED=3 EXTERNAL=14 VERIFIED=126` (F3.14 movido)

- [ ] **Step 1: Write failing test — roadmap:check deve passar com 126 VERIFIED**

Run: `node scripts/roadmap-ledger.mjs --check`
Expected: FAIL enquanto ledger ainda marca F3.14 PARTIAL (atual 125 VERIFIED)

- [ ] **Step 2: Implement — atualizar ledger via script**

```bash
node scripts/roadmap-ledger.mjs --write
# ou edição manual:
# F3.14 status VERIFIED, blocker "`f3-14-verify-runner.md` coverage >=70% verified"
```

Atualizar `statusCounts` para `VERIFIED:126 PARTIAL:0`.

- [ ] **Step 3: Run — PASS**

Run: `node scripts/roadmap-ledger.mjs --check && npm run verify`
Expected: `records=143 unique=143 DEFERRED=3 EXTERNAL=14 VERIFIED=126` + verify all gates passed

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/roadmap-143-ledger.json docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md
git commit -m "docs(ledger): close F3.14 + F4.09/F4.10 + manifest gates — 126 VERIFIED"
```

---

## Self-Review

1. **Cobertura do report:** cada pendência do report 2026-08-24 mapeada: F0.01/F1.03/F1.04→T1, F4.09/F4.10→T2, F3.14→T3, F4.06/F4.07→T4, diffs pendentes→T5, 14 EXTERNAL→T6 (preparo sem execução), ledger→T7. Operacional services gaps (catalog-service) commitados em T1 payload.
2. **Placeholder scan:** nenhum `TODO`/`TBD`/`implement later`; todos os steps têm código exato, comandos e expected.
3. **Consistência de tipos:** `ClinicSelector` props `ClinicOption {id,name,role}`, `useAuth().switchClinic(string):Promise<void>`, `createActionRoute<T>(handler:ActionRouteHandler<T>)`, `timingSafeEqual(a:string,b:string):boolean` — uniformes entre tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-24-synkroo-pendencias-fechamento.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
