# Audit Remediation W2 Auth and Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [x]`) syntax for tracking.

**Goal:** Unificar sessão e garantir efeito único em cobrança e campanha sob retry/concorrência.

**Architecture:** NextAuth é autoridade única. Guard server-side compara sessão com usuário atual e
acesso à clínica. Comandos persistem outbox na transaction; dispatcher usa claim atômico e chave
estável.

**Tech Stack:** NextAuth v4, PostgreSQL, Drizzle, Cloudflare Queues, Jest.

**Agent Orchestration:** Supervisor-Workers — auth precede switch-clinic; schema precede cobrança e
campanha; financeiro e follow-up podem avançar em paralelo após schema.

---

### Task 1: Inventariar e remover auth paralela

**Files:**
- Modify: `src/lib/auth/context.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/session/route.ts`
- Test: `src/app/api/auth/__tests__/jwt-auth.test.ts`
- Test: `src/__tests__/api/auth/auth.test.ts`

- [x] **Step 1: mapear consumidores antes da remoção**

```bash
rg "api/auth/(login|logout|session)|useAuth\(" src e2e
```

Registrar cada consumidor no ledger; sem adapter preventivo para consumidor inexistente.

- [x] **Step 2: escrever teste RED do fluxo NextAuth único**

```ts
it('uses the same session cookie for login, session and logout', async () => {
  const cookie = await signInWithCredentials(validCredentials)
  expect(cookie.name).toMatch(/next-auth\.session-token$/)
  await expect(readSession(cookie)).resolves.toMatchObject({ user: { id: userId } })
  await expect(readSession(await signOut(cookie))).resolves.toBeNull()
})
```

- [x] **Step 3: confirmar RED por cookie/endpoint divergente**

```bash
npm test -- src/app/api/auth/__tests__/jwt-auth.test.ts --runInBand
```

- [x] **Step 4: migrar UI para `signIn`, `signOut`, `useSession`**

```ts
const result = await signIn('credentials', { email, password, redirect: false })
if (result?.error) return { error: 'Credenciais inválidas' }
router.replace(redirectTo)
```

Remover rotas manuais quando último consumidor migrar. Se compatibilidade for necessária, adapter
chama NextAuth; não emite JWT/cookie próprio.

- [x] **Step 5: executar auth unit + E2E focado e commit**

```bash
npm test -- src/app/api/auth src/lib/auth --runInBand
npx playwright test e2e/auth --project=unauthenticated
git add src/lib/auth src/app/login src/app/api/auth
git commit -m "refactor: use NextAuth as sole session authority"
```

### Task 2: Aplicar revogação em todo guard server-side

**Files:**
- Modify: `src/lib/auth/session.ts`
- Modify: `src/lib/security/request-guards.ts`
- Modify: `src/lib/auth/auth.ts`
- Test: `src/lib/auth/__tests__/session.test.ts`
- Test: `src/__tests__/middleware.security.test.ts`

- [x] **Step 1: escrever matriz RED**

```ts
it.each([
  ['inactive', { isActive: false, sessionVersion: 3 }, 3],
  ['stale', { isActive: true, sessionVersion: 4 }, 3],
])('rejects %s session', async (_name, user, tokenVersion) => {
  mockCurrentUser(user)
  await expect(requireActiveSession({ sessionVersion: tokenVersion })).rejects.toThrow('Unauthorized')
})
```

- [x] **Step 2: confirmar RED**

```bash
npm test -- src/lib/auth/__tests__/session.test.ts --runInBand
```

- [x] **Step 3: criar um único guard fail-closed**

```ts
export async function requireActiveProfile(): Promise<ServerUserProfile> {
  const session = await getSession()
  if (!session?.user?.id) throw new AuthError('UNAUTHORIZED')
  const profile = await findUserProfileById(session.user.id)
  if (!profile?.isActive) throw new AuthError('UNAUTHORIZED')
  if (profile.sessionVersion !== session.user.sessionVersion) throw new AuthError('UNAUTHORIZED')
  return toProfileCamel(profile)
}
```

`requireAuth`, `requireRole`, Action context e rotas sensíveis delegam ao mesmo guard.

- [x] **Step 4: testar sessão ativa, inativa, stale e DB indisponível**

```bash
npm test -- src/lib/auth src/__tests__/api/auth --runInBand
npm run test:security
```

- [x] **Step 5: commit**

```bash
git add src/lib/auth src/lib/security src/__tests__/middleware.security.test.ts
git commit -m "fix: enforce immediate session revocation"
```

### Task 3: Corrigir switch-clinic ponta a ponta

**Files:**
- Modify: `src/app/api/auth/switch-clinic/route.ts`
- Modify: `src/lib/auth/auth.ts`
- Modify: `src/lib/auth/context.tsx`
- Modify: `src/core/actions/context.ts`
- Test: `src/app/api/auth/switch-clinic/route.test.ts`
- E2E: `e2e/auth/switch-clinic.spec.ts`

- [x] **Step 1: escrever RED para acesso, cookie e ActionContext**

```ts
it('uses switched clinic in the next action context', async () => {
  const cookie = await switchClinic(sessionCookie, clinicB)
  const context = await buildContextFromCookie(cookie)
  expect(context.clinicId).toBe(clinicB)
})
```

- [x] **Step 2: confirmar RED**

```bash
npm test -- src/app/api/auth/switch-clinic/route.test.ts --runInBand
```

- [x] **Step 3: emitir sessão pelo mecanismo NextAuth e invalidar caches**

```ts
await update({ clinicId })
queryClient.clear()
resetClinicScopedStores()
router.refresh()
```

Callback `jwt({ token, trigger, session })` aceita `session.clinicId` somente após consultar
`userClinicAccess`; update forjado preserva clínica anterior. `buildUserContext` usa clínica ativa
da sessão, nunca `users.clinicId` como override silencioso.

- [x] **Step 4: executar unit e E2E**

```bash
npm test -- src/app/api/auth/switch-clinic/route.test.ts src/core/actions/__tests__/context.test.ts
npx playwright test e2e/auth/switch-clinic.spec.ts
```

- [x] **Step 5: commit**

```bash
git add src/app/api/auth/switch-clinic src/lib/auth src/core/actions e2e/auth
git commit -m "fix: propagate active clinic through session"
```

### Task 4: Corrigir claim de idempotência

**Files:**
- Modify: `src/lib/idempotency/index.ts`
- Modify: `src/lib/db/schema/infra.ts`
- Test: `src/lib/idempotency/__tests__/idempotency.test.ts`
- Test: `src/lib/idempotency/__tests__/idempotency.integration.test.ts`

- [x] **Step 1: escrever RED concorrente**

```ts
it('allows exactly one claimant', async () => {
  const results = await Promise.all([
    tryClaimIdempotencyKey('same-key', 'charge'),
    tryClaimIdempotencyKey('same-key', 'charge'),
  ])
  expect(results.sort()).toEqual([false, true])
})
```

- [x] **Step 2: confirmar RED**

```bash
npm run test:integration -- --runInBand idempotency.integration.test.ts
```

- [x] **Step 3: usar `returning` para detectar insert**

```ts
const rows = await db.insert(idempotencyKeys)
  .values(values)
  .onConflictDoNothing()
  .returning({ key: idempotencyKeys.key })
return rows.length === 1
```

Scope da key inclui clínica + operação + business key. Falha não libera claim enquanto execução
concorrente pode estar ativa; retry exige transição condicional após TTL.

- [x] **Step 4: testar claim, completed, failed, TTL e corrida**

```bash
npm test -- src/lib/idempotency/__tests__/idempotency.test.ts --runInBand
npm run test:integration -- --runInBand idempotency.integration.test.ts
```

- [x] **Step 5: commit**

```bash
git add src/lib/idempotency src/lib/db/schema/infra.ts
git commit -m "fix: claim idempotency keys atomically"
```

### Task 5: Criar outbox transacional mínima

**Files:**
- Modify: `src/lib/db/schema/infra.ts`
- Create: `src/lib/outbox/outbox-repository.ts`
- Create: `src/lib/outbox/dispatch-outbox.ts`
- Test: `src/lib/outbox/__tests__/outbox.integration.test.ts`
- Migration: `src/lib/db/migrations/0015_outbox_jobs.sql`
- Create: `src/lib/db/migrations/meta/0015_snapshot.json`
- Modify: `src/lib/db/migrations/meta/_journal.json`

- [x] **Step 1: escrever RED para claim concorrente e retry**

```ts
it('dispatches one job once under concurrent workers', async () => {
  await enqueueOutbox(tx, job)
  const results = await Promise.all([dispatchNext(workerA), dispatchNext(workerB)])
  expect(results.filter(result => result.status === 'delivered')).toHaveLength(1)
})
```

- [x] **Step 2: confirmar RED**

```bash
npm run test:integration -- --runInBand outbox.integration.test.ts
```

- [x] **Step 3: criar schema e transições**

```ts
type OutboxStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter'
```

Tabela: `clinicId`, `operation`, `businessKey`, `payload`, `status`, `attempts`, `nextAttemptAt`,
`lastErrorCode`, timestamps. Unique `(clinic_id, operation, business_key)`. Claim usa
`FOR UPDATE SKIP LOCKED`; payload não contém secrets ou PII desnecessária.

```bash
npm run db:generate -- --name=outbox_jobs
```

- [x] **Step 4: implementar dispatcher com backoff limitado**

```ts
const delaySeconds = Math.min(2 ** attempts * 30, 3600)
const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000)
```

- [x] **Step 5: testar e commit**

```bash
npm run test:integration -- --runInBand outbox.integration.test.ts
git add src/lib/outbox src/lib/db/schema/infra.ts src/lib/db/migrations
git commit -m "feat: add transactional outbox"
```

### Task 6: Migrar criação/cancelamento de cobrança

**Files:**
- Modify: `src/modules/financeiro/services/charge-service.ts`
- Modify: `src/modules/financeiro/repositories/financeiro-repository.ts`
- Create: `src/modules/financeiro/services/dispatch-charge-job.ts`
- Test: `src/modules/financeiro/services/__tests__/charge-service.test.ts`
- Test: `src/modules/financeiro/services/__tests__/charge-service.integration.test.ts`

- [x] **Step 1: escrever RED para duas criações concorrentes**

```ts
it('creates one provider charge for concurrent requests', async () => {
  await Promise.all([createCharge(command), createCharge(command)])
  expect(provider.createCharge).toHaveBeenCalledTimes(1)
  expect(await countLocalCharges(command.installmentId)).toBe(1)
})
```

- [x] **Step 2: confirmar RED**

```bash
npm run test:integration -- --runInBand charge-service.integration.test.ts
```

- [x] **Step 3: persistir intent + outbox na mesma transaction**

```ts
await db.transaction(async tx => {
  const charge = await createPendingCharge(tx, command)
  await enqueueOutbox(tx, chargeCreatedJob(charge))
})
```

Dispatcher envia chave estável ao provider, valida contrato e aplica transição condicional
`pending -> active`; cancelamento usa `active -> cancelling -> cancelled`.

- [x] **Step 4: testar timeout, resposta inválida, retry e cancel/create race**

```bash
npm test -- src/modules/financeiro/services/__tests__/charge-service.test.ts --runInBand
npm run test:integration -- --runInBand charge-service.integration.test.ts
```

- [x] **Step 5: commit**

```bash
git add src/modules/financeiro
git commit -m "fix: make charge side effects idempotent"
```

### Task 7: Migrar campanhas para outbox

**Files:**
- Modify: `src/services/followup/campaign.service.ts`
- Modify: `src/repositories/campaigns/index.ts`
- Create: `src/services/followup/dispatch-campaign-recipient.ts`
- Test: `src/services/followup/__tests__/campaign-execution.test.ts`
- Test: `src/services/followup/__tests__/campaign-execution.integration.test.ts`

- [x] **Step 1: escrever RED para futuro, corrida e status parcial**

```ts
it('does not claim future campaigns', async () => {
  await createCampaign({ scheduledAt: addHours(now, 1), status: 'scheduled' })
  expect(await claimDueCampaigns(now)).toEqual([])
})
```

- [x] **Step 2: confirmar RED**

```bash
npm run test:integration -- --runInBand campaign-execution.integration.test.ts
```

- [x] **Step 3: claim somente campanhas vencidas e recipients elegíveis**

```ts
where(and(
  eq(campaigns.status, 'scheduled'),
  lte(campaigns.scheduledAt, now),
))
```

Cada recipient recebe business key `campaignId:contactId:channel`. Opt-out é revalidado no
momento do dispatch. Status final deriva de delivered/failed/suppressed.

- [x] **Step 4: testar concorrência, retry, opt-out e parcial**

```bash
npm test -- src/services/followup/__tests__/campaign-execution.test.ts --runInBand
npm run test:integration -- --runInBand campaign-execution.integration.test.ts
```

- [x] **Step 5: commit**

```bash
git add src/services/followup src/repositories/campaigns
git commit -m "fix: dispatch campaigns once and on schedule"
```

### Task 8: Gate W2

```bash
npm run test:security:services
npm run test:security:repositories
npm run test:integration
npm run lint && npm run typecheck && npm test -- --runInBand && npm run build
```

- [x] Mutation ≥70% em auth, idempotency, cobrança e campanha.
- [x] Testes de corrida executados com duas conexões PostgreSQL.
- [x] Ledger atualizado com zero P1 de side effects.
- [x] Review correctness + domain + AppSec aprovado.


## Checkbox reconciliation (2026-08-14)

All planned implementation steps are marked complete because the corresponding wave was previously completed and its gates are recorded in the audit ledger. This reconciliation does not claim new execution of historical steps.

W2 auth/idempotency/outbox evidence is recorded in docs/superpowers/audits/2026-08-13-final-gate-results.json and the historical ledger; current candidate local gates are linked by the 2026-08-14 gate record.

Current-candidate follow-up: the fail-closed API/cron implementation migration, Stryker, OpenNext build, Wrangler dry-run, and startup check are tracked in docs/superpowers/audits/2026-08-14-final-gate-results.json.
