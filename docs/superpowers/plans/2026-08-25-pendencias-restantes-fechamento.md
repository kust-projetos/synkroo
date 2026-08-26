# Pendências Restantes Fechamento — 2026-08-25 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zerar 39 VERIFIED com `local evidence or implementation required` + 1 gate W3 fraco (F3.14 global coverage 63.11%→70%) e provar gates W4-W11 localmente, sem executar nenhum EXTERNAL/W12, elevando ledger local para fechamento técnico e `npm run verify` verde.

**Architecture:** Sequência única em 6 tasks: (1) fechar F3.14 com suites TDD reais + coverage/lcov audit, (2) consolidar W4 contratos/shell, (3) provar W5 jornadas operacionais, (4) fechar W6 canais/IA/Vectorize/Sidecar, (5) provar W7-W9 follow-up/CRM/finance races, (6) fechar W10-W11 LGPD/analytics/deploy e regenerar ledger+verify. Orca planner+coder paralelo onde houver isolamento por schema/lane.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript 5.6 + Drizzle ORM + pg (Supabase removido) + NextAuth/Auth.js JWT + Cloudflare Workers OpenNext + Hyperdrive + Vectorize pgvector + Zustand 5 + TanStack Query 5 + Tailwind/Radix + Jest 29 (277→279 suites) + Playwright + Stryker 8.7.1 + Wrangler 4 / Evolution API / Asaas / LLM factory MiniMax/OpenAI/OpenRouter.

## Global Constraints

- Framework: Next.js 15 App Router + React 19 + TypeScript 5.6 — não regredir major
- DB: PostgreSQL 17 via Drizzle ORM + pg — migrations `src/lib/db/schema/` + `drizzle-kit generate/migrate`, `DATABASE_URL` obrigatória
- Auth: NextAuth/Auth.js JWT edge middleware — `AUTH_SECRET` ≥32 chars, `JWT_SECRET` ≥16, `crypto.timingSafeEqual` em cron/webhook
- Runtime alvo: Cloudflare Workers (OpenNext) + Hyperdrive + Vectorize — `build:cf` deve passar
- Workers auxiliares: `src/workers/ia-agent` (Agents SDK/DO porta 8788) + `src/workers/ia-bridge` — typecheck isolado
- Lint: `npm run lint` com `--max-warnings=0` — zero warnings
- Typecheck: `tsc --noEmit` + `typecheck:ia-bridge` + `typecheck:ia-agent` — green
- Testes: Jest unit/integration (loopback isolado `synkroo_test`) + Playwright E2E (14 specs) — thresholds 70% branches/functions/lines/statements em `jest.config.js:41`
- Segurança: nunca ler/imprimir/armazenar/rotacionar/commitar valores de secret; apenas fingerprints/nomes/provider/owner; rate-limit em auth/agent/leads/messages/instagram
- Não fazer push/merge/rewrite production sem autorização owner explícita; W12 piloto só com owner approval
- Ledger: `docs/superpowers/audits/roadmap-143-ledger.json` fonte única — `npm run roadmap:check` deve bater 143 unique `DEFERRED=3 EXTERNAL=14 VERIFIED=126` antes deste plano, `VERIFIED` sobe ao fechar tasks

---

## File Structure

**Criar:**
- `src/__tests__/coverage-boost.test.ts` — já criado 2026-08-24 (9 tests, +19 stmts) — estender com suites abaixo
- `coverage/lcov.info` + `coverage/lcov-report/index.html` — gerados por `npm test -- --runInBand --coverage`, artefato de F3.14
- `docs/superpowers/audits/f3-14-coverage-2026-08-25.md` — relatório coverage global vs targeted, delta por arquivo
- `docs/ops/w10-retention-policy.md` — retenção mensagens/DO/audit/gateway/exports (F10.08)
- `docs/ops/w11-rollout-runbook.md` — pipeline backup→expand→workers→app→smoke (F11.05/11.11)

**Modificar:**
- `jest.config.js:35` — avaliar `collectCoverageFrom` se manter exclusões `!src/repositories/** !src/lib/db/**` apenas se justificado por integração; preferir manter config atual e adicionar testes reais
- `src/lib/auth/__tests__/password.test.ts:1` — já 7 tests (inclui timingSafeEqual guard `password.ts:28-31`) — referência para F3.14 delta
- `src/modules/financeiro/lib/__tests__/crypto.test.ts:57` — já 11 tests (100% em `crypto.ts:84,95`)
- `src/lib/api/__tests__/action-route.test.ts:57` — já 9 tests (100% em `action-route.ts:27-36`) — fechar W4 adapter
- `src/lib/validations/*`, `src/lib/validation.ts:40`, `src/lib/utils.ts:4`, `src/lib/timezone.ts:10` — alvos cheap para boost, já parcialmente cobertos em coverage-boost
- `src/workers/ia-bridge/index.ts:44`, `src/workers/ia-agent/index.ts:36`, `src/lib/env.ts:63` — F3.02 sidecar wiring remanescente (F6.13)
- `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md:24` — atualizar audit result `VERIFIED 29/58/39/14/3 → 126` e Appendix A evidências
- `docs/superpowers/audits/roadmap-143-ledger.json:1` — regenerado via `roadmap:write` após cada task que fecha item

**Testar:**
- `npm test -- --runInBand --coverage 2>&1 | grep -E "All files|% Stmts|% Branch"` — F3.14 gate
- `npx jest src/__tests__/coverage-boost.test.ts src/lib/auth/__tests__/password.test.ts src/modules/financeiro/lib/__tests__/crypto.test.ts src/lib/api/__tests__/action-route.test.ts --runInBand --coverage` — targeted 100% já verde
- `npm run verify` — lint→typecheck→typecheck:bridge/agent→coverage→test:release
- `npm run roadmap:check` / `roadmap:write` — ledger 143

---

### Task 1: Fechar F3.14 — global 63.11% → 70% (único gate local bloqueando W3)

**Files:**
- Modify: `jest.config.js:35-40`
- Modify: `src/__tests__/coverage-boost.test.ts:1` — estender
- Create: `docs/superpowers/audits/f3-14-coverage-2026-08-25.md`
- Test: `npm test -- --runInBand --coverage`, `scripts/verify.mjs:10`

**Interfaces:**
- Consumes: `collectCoverageFrom` atual `['src/**/*.ts','!src/**/*.d.ts','!src/**/__tests__/**','!src/**/*.tsx']`, thresholds 70% `jest.config.js:41`
- Produces: `Statements ≥70% (≥11383/16262) Lines ≥70% (≥10385/14836) Branches ≥70% Functions ≥70%` + `coverage/lcov.info` + relatório audit

- [ ] **Step 1: Write failing test — medir gap real e registrar RED**

```bash
npm test -- --runInBand --coverage 2>&1 | grep -E "All files|% Stmts|% Branch"
# Expected RED atual (2026-08-24): Statements 63.11% (10263/16262) Lines 64.19% (9524/14836) Branches 48.74% Functions 55.20% — FAIL thresholds
# Gerar artefatos para audit:
npx jest --runInBand --coverage --collectCoverageFrom='src/**/*.ts'
# Abrir coverage/lcov-report/index.html e anotar top 3 deltas (ex: src/repositories/budgets/index.ts 0% 521 lines, src/services/campaigns/* 20.98%, src/services/followup/inactive-patient.service.ts 18.09%)
```

Registrar em `docs/superpowers/audits/f3-14-coverage-2026-08-25.md` tabela `File | %Stmts | Uncovered Lines` para os 10 maiores deltas.

- [ ] **Step 2: Run — confirma FAIL threshold**

Run: `npm test -- --runInBand --coverage`
Expected: `Jest: "global" coverage threshold for statements (70%) not met: 63.11%` — falha nominal, prova gap

- [ ] **Step 3: Minimal implementation — atacar 3 arquivos de maior delta com TDD sem mock trivial inflado**

Alvos por custo/benefício (já feito 3, faltam próximos 3 maiores):
- `src/services/campaigns/*` (ex: `campaign.service.ts:60,93-108` 55%) — adicionar `src/services/campaigns/__tests__/campaign-execution.test.ts` branch `campaign 100% falha → failed` + retry
- `src/services/followup/inactive-patient.service.ts:62-156 18%` — adicionar `src/services/followup/__tests__/inactive-patient.test.ts` com segmentação inativos
- `src/repositories/budgets/index.ts:6-521 0%` — escolher 1 repo representativo (`clinics` 45 lines) para provar padrão; marcar demais como integração (`jest.integration.config.js`) ou adicionar `!src/repositories/**` apenas com ADR justificando

Exemplo TDD para campaigns (seguir `test-driven-development` skill):

```typescript
// RED: src/services/campaigns/__tests__/campaign-branch.test.ts
import { runCampaign } from '@/services/campaigns/campaign.service';
test('100% failure ends failed', async () => {
  const result = await runCampaign({ contacts: [{phone:null}], template:'hi'} as any);
  expect(result.status).toBe('failed');
});
```

Executar `npm test -- src/services/campaigns/__tests__/campaign-branch.test.ts --runInBand` → FAIL, depois implementar minimal em `campaign.service.ts:144` `if (success===0) status='failed'`.

Repetir para os outros 2 alvos, sempre `RED → verify fails correctly → GREEN → verify passes`.

Também estender `src/__tests__/coverage-boost.test.ts:1` com mais `src/lib/validations/*` + `src/lib/errors.ts:50` `handleApiError` + `src/lib/retry.ts:72` `withRetry` branches — já adicionado 9 tests, acrescentar 3-5 para `retry`/`circuitBreaker`.

- [ ] **Step 4: Run — PASS ≥70%**

Run: `npm test -- --runInBand --coverage 2>&1 | grep -E "All files"`
Expected: `Statements 70.x% Lines 70.x% Branches …` — PASS thresholds. Também `npm run verify` coverage step verde.

Se ainda <70% após 3 arquivos: documentar em `f3-14-coverage-2026-08-25.md` que restante exige integração (`src/repositories` testadas via `npm run test:integration:run`) e propor ADR para ajustar `collectCoverageFrom` com `!src/repositories/**` — não reduzir threshold.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/coverage-boost.test.ts src/services/campaigns/__tests__/campaign-branch.test.ts src/services/followup/__tests__/inactive-patient.test.ts docs/superpowers/audits/f3-14-coverage-2026-08-25.md coverage/lcov.info
git commit -m "test(coverage): F3.14 global 63→70% via campaign/followup/repo branches TDD"
```

---

### Task 2: W4 Contracts & Shell — fechar F4.02-F4.11 restantes

**Files:**
- Modify: `src/lib/api/action-route.ts:17` (já 100% com 9 tests) — apenas revalidar
- Modify: `src/lib/ui/sidebar.tsx:48`, `src/lib/ui/manifest.ts:1`, `src/app/dashboard/layout.tsx:1` — F4.05/F4.06/F4.07
- Modify: `src/components/clinic-selector.tsx:1` — já F4.09/F4.10
- Create: `src/lib/ui/__tests__/sidebar-manifest.test.ts` (se ainda não existe)
- Test: `src/__tests__/security/manifest-paths.test.ts`, `src/lib/__tests__/sidebar-manifest.test.ts`, `npm run lint && npm run typecheck`

**Interfaces:**
- Consumes: `coreManifest`, `operacionalManifest` de `src/lib/ui/manifest.ts`, `auth()` server de `src/lib/auth/*`
- Produces: `getVisibleCoreMenu(): Promise<MenuItem[]>` sem stale paths, `DashboardLayout` com server `auth()` guard + client `ClinicSelector`, `ApiSuccess`/`ApiFailure` envelope validado

- [ ] **Step 1: Write failing test — manifest sem stale + sidebar RBAC filtering**

```typescript
import { coreManifest } from '@/lib/ui/manifest';
test('F4.06 no stale paths', () => {
  const stale = ['/dashboard/conversations'];
  const paths = coreManifest.menu.map(m=>m.path);
  for(const s of stale) expect(paths).not.toContain(s);
});
test('F4.05 sidebar RBAC only from manifest', () => {
  const { filterMenuByAccess } = require('@/lib/ui/sidebar');
  expect(filterMenuByAccess([{path:'/dashboard/financeiro', roles:['admin']}], {role:'viewer'})).toEqual([]);
});
```

- [ ] **Step 2: Run — FAIL se stale existir**

Run: `npm test -- src/__tests__/security/manifest-paths.test.ts --runInBand`
Expected: FAIL se `/dashboard/conversations` ainda presente

- [ ] **Step 3: Implement — corrigir manifest + garantir server guard**

```typescript
// src/lib/ui/manifest.ts — trocar stale
{ path: '/dashboard/conversations' } -> { path: '/dashboard/conversas' }
// src/app/dashboard/layout.tsx — server wrapper (já parcialmente)
import { auth } from '@/lib/auth';
export default async function DashboardLayout({children}) {
  const session = await auth();
  if(!session) redirect('/login');
  return <>{children}</>;
}
```

- [ ] **Step 4: Run — PASS + lint/typecheck**

Run: `npm test -- src/__tests__/security/manifest-paths.test.ts src/lib/ui/__tests__/sidebar-manifest.test.ts --runInBand && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/manifest.ts src/lib/ui/sidebar.tsx src/app/dashboard/layout.tsx src/__tests__/security/manifest-paths.test.ts
git commit -m "fix(w4): F4.05-F4.07 manifest stale + RBAC sidebar + server guard"
```

---

### Task 3: W5 Operacional J-04 — provar jornadas paciente/dentista/agenda/waitlist

**Files:**
- Modify: `src/services/patients/*`, `src/modules/operacional/services/catalog-service.ts:1`, `src/services/appointments/*`, `src/services/waitlist/*`
- Create: `src/__tests__/api/patients/journey.test.ts`, `src/__tests__/api/waitlist/idempotent.test.ts`
- Test: `npm test -- --runInBand`, `npm run test:e2e -- --grep "J-04"`

**Interfaces:**
- Consumes: `createPatient`, `updatePatient`, `dedupPatient` de `src/services/patients/patient-dedup.service.ts`, `getAvailability` de `src/modules/operacional/services/availability-service.ts`
- Produces: jornadas `lista→detalhe→create→edit→dedup` com tenant isolation, `waitlist fill idempotente`, `calendar conflict timezone America/Sao_Paulo`

- [ ] **Step 1: Write failing test — waitlist idempotência**

```typescript
import { fillWaitlist } from '@/services/waitlist/waitlist.service';
test('F5.04 fill idempotent', async () => {
  const a = await fillWaitlist({ slotId:'s1', patientId:'p1' } as any);
  const b = await fillWaitlist({ slotId:'s1', patientId:'p1' } as any);
  expect(a.id).toBe(b.id);
});
```

- [ ] **Step 2: Run — FAIL se duplicar**

Run: `npm test -- src/__tests__/api/waitlist/idempotent.test.ts --runInBand`
Expected: FAIL `a.id !== b.id` antes do fix

- [ ] **Step 3: Implement — transaction + clinicId check**

```typescript
// src/services/waitlist/waitlist.service.ts:1 — garantir WHERE clinicId + FOR UPDATE
await db.transaction(async tx => {
  const existing = await tx.select().from(waitlist).where(eq(waitlist.slotId, slotId)).limit(1);
  if(existing.length) return existing[0];
  return tx.insert(waitlist).values({...}).returning();
});
```

Prover também patient journey E2E via `e2e/journey-patient.spec.ts` usando Playwright auth setup obrigatório (F3.11).

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/__tests__/api/waitlist/idempotent.test.ts --runInBand && npm run test:integration:run`
Expected: PASS + integration green

- [ ] **Step 5: Commit**

```bash
git add src/services/waitlist/waitlist.service.ts src/__tests__/api/waitlist/idempotent.test.ts e2e/journey-patient.spec.ts
git commit -m "feat(operacional): F5.01-F5.06 patient/waitlist J-04 idempotent TDD"
```

---

### Task 4: W6 Canais/IA — Vectorize→pgvector, DO versioning, Sidecar

**Files:**
- Modify: `src/workers/ia-bridge/index.ts:44`, `src/workers/ia-agent/index.ts:36`, `src/lib/env.ts:63` (F3.02 sidecar)
- Create: `src/workers/sidecar/package.json` (se F6.13), `docs/adr/adr-llm-embedding.md` (F6.06), `docs/superpowers/audits/f6-sidecar-mtls.md`
- Test: `src/workers/ia-agent/__tests__/index.test.ts`, `src/services/rag/__tests__/rag.service.test.ts`

**Interfaces:**
- Consumes: `parseRuntimeEnv('app'|'bridge'|'agent'|'sidecar')` de `src/lib/env.ts:63`, `vector` extension pgvector
- Produces: smoke `app→bridge→agent` verde, `knowledge ingestão chunked + busca vetorial` com `pgvector`, `DO state version + retention`

- [ ] **Step 1: Write failing test — sidecar env schema fail-closed**

```typescript
import { parseRuntimeEnv } from '@/lib/env';
test('F6.13 sidecar requires PLAYWRIGHT_SECRET', () => {
  delete process.env.PLAYWRIGHT_SECRET;
  expect(()=> parseRuntimeEnv('sidecar')).toThrow(/PLAYWRIGHT_SECRET/);
});
```

- [ ] **Step 2: Run — FAIL se schema não exige**

Run: `npm test -- src/lib/__tests__/env.test.ts --runInBand`
Expected: FAIL `did not throw` antes do fix

- [ ] **Step 3: Implement — env schema sidecar + Vectorize removal**

```typescript
// src/lib/env.ts:63
export function parseRuntimeEnv(runtime:'app'|'bridge'|'agent'|'sidecar'){
  if(runtime==='sidecar') return z.object({PLAYWRIGHT_SECRET:z.string().min(16)}).parse(process.env);
}
// Remover Vectorize binding de wrangler.toml, manter apenas pgvector
```

Também versionar `src/workers/ia-agent` DO state com `STATE_VERSION=2` + migration.

- [ ] **Step 4: Run — PASS + Wrangler dry-run**

Run: `npm test -- src/lib/__tests__/env.test.ts --runInBand && npx wrangler deploy --dry-run --config wrangler.ia-agent.jsonc`
Expected: PASS + dry-run OK

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/workers/ia-agent/index.ts docs/adr/adr-llm-embedding.md
git commit -m "feat(ia): F6.06-F6.15 sidecar env + pgvector consolidate + DO versioning"
```

---

### Task 5: W7-W9 Follow-up/CRM/Finance — Queue/Consent/Races

**Files:**
- Modify: `src/services/followup/*`, `src/services/campaigns/*`, `src/modules/financeiro/*`, `src/modules/crm/*`
- Create: `src/__tests__/api/followup/consent.test.ts`, `src/__tests__/api/finance/race.test.ts`
- Test: `npm test -- --runInBand`, `npm run test:integration:run` (concorrência 8-way)

**Interfaces:**
- Consumes: `dispatchCampaign` de `src/services/followup/campaign.service.ts`, `recordPayment` de `src/services/payments/payment.service.ts`
- Produces: `retry com backoff bounded + DLQ observável`, `consent versionado antes de cada send`, `finance event + payment em 1 transaction` + race proof

- [ ] **Step 1: Write failing test — consent antes de dispatch**

```typescript
import { dispatchFollowup } from '@/services/followup/followup.service';
test('F7.08 consent required', async () => {
  await expect(dispatchFollowup({ patientId:'p1', consentVersion:0 } as any)).rejects.toThrow(/consent/);
});
```

- [ ] **Step 2: Run — FAIL se não checa**

Run: `npm test -- src/__tests__/api/followup/consent.test.ts --runInBand`
Expected: FAIL `did not throw`

- [ ] **Step 3: Implement — check versionado + finance transaction**

```typescript
// src/services/followup/followup.service.ts — antes de send
const consent = await getConsent(patientId);
if(consent.version !== payload.consentVersion) throw new Error('consent stale');
// src/modules/financeiro/services/charge-service.ts — transaction única
await db.transaction(async tx => {
  await tx.insert(gatewayEvents).values(event);
  await tx.update(payments).set({status}).where(eq(payments.id, id));
});
```

Testar races com `Promise.all([webhook(), webhook()])` idempotente.

- [ ] **Step 4: Run — PASS + integration race**

Run: `npm test -- src/__tests__/api/followup/consent.test.ts src/__tests__/api/finance/race.test.ts --runInBand && npm run test:integration:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/followup/followup.service.ts src/modules/financeiro/services/charge-service.ts src/__tests__/api/followup/consent.test.ts
git commit -m "feat(followup+finance): F7.08 consent + F9.06-F9.08 transaction & race idempotent"
```

---

### Task 6: W10-W11 LGPD/Analytics/Deploy — fechar gates locais finais

**Files:**
- Create: `docs/ops/w10-retention-policy.md`, `docs/ops/w11-rollout-runbook.md`
- Modify: `src/services/reports/*`, `src/app/api/lgpd/*`, `src/app/api/internal/readiness/route.ts:1`, `src/__tests__/security/headers.test.ts:1`
- Test: `src/__tests__/api/lgpd/export.test.ts`, `npm run verify`, `npm run roadmap:check`

**Interfaces:**
- Consumes: `exportData`/`anonymize` de `src/services/lgpd/*`, `health`/`readiness` handlers
- Produces: retenção documentada, export transaction + purge, `readiness` barato protegido, `CSP/HSTS` headers + rollback runbook

- [ ] **Step 1: Write failing test — LGPD purge verificável**

```typescript
import { purgePatient } from '@/services/lgpd/anonymize';
test('F10.10 purge removes PII but keeps audit', async () => {
  const before = await getPatient('p1');
  await purgePatient('p1');
  const after = await getPatient('p1');
  expect(after.email).not.toBe(before.email);
  expect(await getAudit('p1')).toBeTruthy();
});
```

- [ ] **Step 2: Run — FAIL se não purga**

Run: `npm test -- src/__tests__/api/lgpd/export.test.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement — retenção + headers + runbook**

```markdown
// docs/ops/w10-retention-policy.md
Mensagens: 90 dias | DO: 30 dias | audit: 2 anos | gateway: 1 ano | exports: 7 dias
Legal hold: flag `legal_hold` impede purge
```

```typescript
// src/__tests__/security/headers.test.ts — já existe, revalidar
expect(response.headers.get('content-security-policy')).toBeTruthy();
```

Criar `docs/ops/w11-rollout-runbook.md` com ordem `backup→expand→workers→app→smoke→cleanup`.

- [ ] **Step 4: Run — PASS ledger + verify**

Run: `npm run roadmap:write && node scripts/roadmap-ledger.mjs --check # deve ser VERIFIED 126→~140 (restantes locais) EXTERNAL 14 DEFERRED 3`
Run: `npm run verify`
Expected: `records=143 unique=143` + `all gates passed` (F3.14 agora verde, W10/W11 docs verdes)

- [ ] **Step 5: Commit**

```bash
git add docs/ops/w10-retention-policy.md docs/ops/w11-rollout-runbook.md docs/superpowers/audits/roadmap-143-ledger.json docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md
git commit -m "docs(ledger): close W10-W11 LGPD/analytics/deploy — remaining local gates green"
```

---

## Self-Review

1. **Cobertura do report:** 39 VERIFIED genéricos + F3.14 (63.11%→70%) mapeados: T1 (F3.14), T2 (F4.05-4.07/F4.11), T3 (F5.01-5.06), T4 (F6.03-6.15 + F3.02 sidecar), T5 (F7.03-7.08/F8-F9), T6 (F10.02/05/06/08/10/F11). Cada ID tem task owner; EXTERNAL F0.04-0.07/0.10/F1.01/F12.01-08 permanecem EXTERNAL (owner approval) e DEFERRED F0.01/F1.03-04 com ADR.
2. **Placeholder scan:** nenhum `TODO`/`TBD`/`implement later`; todos steps com código exato, comandos e expected.
3. **Consistência de tipos:** `parseRuntimeEnv(runtime): Env`, `ClinicSelector` props `ClinicOption {id,name,role}`, `createActionRoute<T>(handler:ActionRouteHandler<T>)`, `timingSafeEqual(a:string,b:string):boolean`, `dispatchFollowup(payload:{patientId,consentVersion})` — uniformes.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

---

## Rubrica de Fechamento — 2026-08-26 (verificação pós-tranche, ledger 126 VERIFIED)

> Escala 0-10 (10 = gate provado com teste RED→GREEN + artefato + `npm run verify`/`roadmap:check` verdes). Verificação 2026-08-26 confirma média 8.0/10; detalhes em `docs/superpowers/audits/2026-08-26-verificacao-pendencias.md` + `docs/superpowers/audits/rubrica-fechamento-2026-08-25.md`.

| Task | Gate | Nota | Evidência local (comando/arquivo) | Gap para 10 |
|------|------|------|-----------------------------------|-------------|
| T1 F3.14 global 63.11%→70% | W3 | **7.5/10** | `coverage-boost` 13/13 + `inactive-patient` 4/4 + `clinics` 3/3 + `consent-guard` 4/4 + `charge-race` 2/2 + `sidebar-manifest` 3/3 + `waitlist` 6/6 = **35/35 PASS**, `campaign-execution` já coberto, `tsc EXIT 0`, audit `f3-14-coverage-2026-08-25.md` atualizado; verificação 2026-08-26 confirma gap global persiste | `budgets` 521 lines (0%) + `lcov.info` global exigem CI Linux 300s ou ADR `!src/repositories/**`; 8M+18?? não commitados |
| T2 W4 Contracts/Shell | W4 | **8.0/10** | `sidebar-manifest` 3/3 + `manifest-paths` 3/3 + `gates` PASS + `getVisibleCoreMenu` Server Action + `adr-dashboard-server-guard.md` (client `useAuth` + server DEFERRED per ADR) + `src/lib/api/__tests__/action-route.test.ts` 9 tests | `lint --max-warnings=0` full timeout env (não falha de código) |
| T3 W5 Operacional J-04 | W5 | **8.0/10** | `waitlist.fill` 6/6 idempotente + `e2e/journey-patient.spec.ts` + availability/timezone/conflict PG + treatment-plan 8 tests + `w5-waitlist-for-update.md` (FOR UPDATE+clinicId) | `test:integration:run` 8-way + `test:e2e J-04` pendente integração |
| T4 W6 Canais/IA | W6 | **8.0/10** | `parseRuntimeEnv` 4/4 (`runtime-env.test.ts`) + `wrangler` bridge/agent 2×EXIT 0 + `adr-llm-embedding` + `f6-sidecar-mtls` + `STATE_VERSION=2` em `src/workers/ia-agent/index.ts:36` (typecheck:ia-agent EXIT 0) + `metric-dictionary.md` | — |
| T5 W7-W9 Follow-up/CRM/Finance | W7-W9 | **8.0/10** | campaign execution + `inactive-patient` 4/4 + `consent-guard` 4/4 + `charge-race` 2/2 + `dispatch-dlq` 3/3 (F7.07 retry bounded+DLQ) + outbox/lead dedup | `Queue` consumer runtime + consent versionado audit completo |
| T6 W10-W11 LGPD/Analytics/Deploy | W10-W11 | **8.0/10** | `w10-retention-policy.md` + `w11-rollout-runbook.md` (untracked) + `metric-dictionary.md` (F10.02) + health/readiness + headers + logger PASS + `roadmap:check` 126 VERIFIED | `npm run verify` full global (lint+coverage) pendente CI; `roadmap:write` pendente para promover VERIFIED |

**Critério:** 10 = RED→GREEN+artefato+verify/roadmap verdes; 8-9 = teste+artefato verdes mas verify parcial (targeted vs global); 5-7 = código+doc+teste alvo verdes mas suite global/ledger não fecha; 3-4 = doc/código parcial sem teste.

**Próximos passos ranqueados (verificação 2026-08-26):** 1) T1 repo clinics focused → coverage ≥70%+`coverage/lcov.info`; 2) T5 consent/race `Promise.all` concorrência; 3) T3 waitlist E2E J-04; 4) T4 sidecar/vectorize + `wrangler deploy --dry-run`; 5) `npm run roadmap:write && node scripts/roadmap-ledger.mjs --check && npm run verify` → commit por task (sem EXTERNAL/W12).

*Atualizado 2026-08-26 — rubrica viva em `docs/superpowers/audits/2026-08-26-verificacao-pendencias.md` + `docs/superpowers/audits/rubrica-fechamento-2026-08-25.md` (detalhe) e aqui (resumo no plano).*

---

## Verificação 2026-08-26 — atualização incorporada

> Relatório completo: `docs/superpowers/audits/2026-08-26-verificacao-pendencias.md`. Master plan `2026-08-15` atualizado em `## Current audit result` e `Appendix B`.

**Ledger:** `records=143 unique=143` `VERIFIED=126 EXTERNAL=14 DEFERRED=3` — verificado `node scripts/roadmap-ledger.mjs --check`. Nenhuma reclassificação EXTERNAL/W12.

**Git `main`:** 8 modificados (`docs/adr/adr-llm-embedding.md`, `src/lib/__tests__/runtime-env.test.ts`, `src/lib/auth/password.ts` etc) + 18 untracked (`src/__tests__/coverage-boost.test.ts`, `docs/ops/w10-retention-policy.md`, `e2e/journey-patient.spec.ts` etc) — todo o tranche Tasks 1-6 permanece não commitado; risco de perda se não comitado por task.

**Gates:** 39 VERIFIED fraco (`local evidence or implementation required`) + F3.14 coverage 63.11%→70% seguem como pendências locais. `ai-memory` 112 páginas / 121 sessões / lint 2026-08-26 5 duplicate warnings. Próximo gate técnico: fechar T1-T6 localmente e executar `roadmap:write` para elevar VERIFIED; EXTERNAL 14 e DEFERRED 3 permanecem bloqueados com ADR. 
