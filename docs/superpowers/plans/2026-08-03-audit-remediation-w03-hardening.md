# Audit Remediation W3 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar superfícies P1/P2 de HTTP, exportação, dados, embeddings, migrations e supply chain.

**Architecture:** Segurança fail-closed em boundaries. Constraints incluem tenant. Integrações têm
contrato, timeout e ownership. Architecture tests analisam conjuntos reais e falham vazios.

**Tech Stack:** Next.js, Drizzle, PostgreSQL, Zod, Jest, npm audit.

**Agent Orchestration:** Supervisor-Workers — HTTP, CSV, embeddings e architecture tests podem ser
implementados em paralelo; consent migration e dependency update entram serialmente.

---

### Task 1: Substituir prefixos públicos por allowlist exata

**Files:**
- Modify: `src/middleware.ts`
- Test: `src/__tests__/middleware.security.test.ts`

- [ ] **Step 1: escrever tabela RED de rotas**

```ts
it.each([
  ['/api/health', true],
  ['/api/auth/signin', true],
  ['/api/messages/inbound', false],
  ['/api/messages/send', false],
  ['/api/cron/cleanup', false],
  ['/api/agent/classify', false],
])('%s public=%s', async (path, expected) => {
  expect(isPublicPath(path)).toBe(expected)
})
```

- [ ] **Step 2: confirmar RED**

```bash
npm test -- src/__tests__/middleware.security.test.ts --runInBand
```

- [ ] **Step 3: criar allowlist exata e matchers explícitos**

```ts
const PUBLIC_EXACT = new Set(['/api/health'])
const PUBLIC_PREFIXES = ['/api/auth/', '/api/financeiro/webhooks/'] as const
```

Cada prefixo permitido recebe autenticação própria dentro da rota. `/api/health/db` deixa de ser
público; readiness detalhado muda para `/api/internal/readiness` protegido.

- [ ] **Step 4: executar security suite e commit**

```bash
npm test -- src/__tests__/middleware.security.test.ts --runInBand
npm run test:security
git add src/middleware.ts src/__tests__/middleware.security.test.ts
git commit -m "fix: narrow public route allowlist"
```

### Task 2: Adicionar headers de segurança

**Files:**
- Modify: `next.config.ts`
- Test: `src/__tests__/security/headers.test.ts`

- [ ] **Step 1: escrever teste RED da configuração**

```ts
expect(headers).toEqual(expect.arrayContaining([
  expect.objectContaining({ key: 'X-Content-Type-Options', value: 'nosniff' }),
  expect.objectContaining({ key: 'Referrer-Policy' }),
  expect.objectContaining({ key: 'Permissions-Policy' }),
]))
```

- [ ] **Step 2: confirmar RED**

```bash
npm test -- src/__tests__/security/headers.test.ts --runInBand
```

- [ ] **Step 3: configurar baseline compatível com Next/OpenNext**

```ts
{ key: 'Content-Security-Policy', value: csp },
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
```

CSP começa report-only se inventário identificar bloqueio; issue e data de promoção para enforce
são obrigatórios. HSTS somente produção HTTPS.

- [ ] **Step 4: build, smoke de assets e commit**

```bash
npm test -- src/__tests__/security/headers.test.ts --runInBand
npm run build
git add next.config.ts src/__tests__/security/headers.test.ts
git commit -m "fix: add browser security headers"
```

### Task 3: Neutralizar formula injection em CSV

**Files:**
- Modify: `src/app/api/reports/export/route.ts`
- Test: `src/app/api/reports/export/route.test.ts`
- Test: `src/__tests__/api/reports/export/route.test.ts`

- [ ] **Step 1: escrever RED para seis prefixos perigosos**

```ts
it.each(['=SUM(A1:A2)', '+cmd', '-1+2', '@IMPORT', '\tcmd', '\rcmd'])
  ('neutralizes %s', value => {
    expect(toCsvCell(value)).toBe(`'${value}`)
  })
```

- [ ] **Step 2: confirmar RED**

```bash
npm test -- src/app/api/reports/export/route.test.ts --runInBand
```

- [ ] **Step 3: neutralizar antes do escape CSV**

```ts
export function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}
```

Aplicar em toda célula textual; depois escapar aspas, vírgulas e newlines.

- [ ] **Step 4: testar CSV completo e commit**

```bash
npm test -- src/app/api/reports/export/route.test.ts \
  src/__tests__/api/reports/export/route.test.ts --runInBand
git add src/app/api/reports/export src/__tests__/api/reports/export
git commit -m "fix: neutralize formulas in CSV exports"
```

### Task 4: Corrigir uniqueness de consentimento por clínica

**Files:**
- Modify: `src/lib/db/schema/infra.ts`
- Modify: `src/services/contacts/consents.service.ts`
- Test: `src/services/contacts/__tests__/consents.integration.test.ts`
- Migration: `src/lib/db/migrations/0016_consent_tenant_unique.sql`
- Create: `src/lib/db/migrations/meta/0016_snapshot.json`
- Modify: `src/lib/db/migrations/meta/_journal.json`

- [ ] **Step 1: escrever RED com mesmo contactId em duas clínicas**

```ts
it('stores same contact purpose independently per clinic', async () => {
  await grantConsent(clinicA, input)
  await grantConsent(clinicB, input)
  expect(await listConsentClinics(input.contact_id)).toEqual([clinicA, clinicB])
})
```

- [ ] **Step 2: confirmar conflito atual**

```bash
npm run test:integration -- --runInBand consents.integration.test.ts
```

- [ ] **Step 3: preflight e constraint tenant-scoped**

```sql
SELECT clinic_id, contact_id, contact_type, purpose, count(*)
FROM consents
GROUP BY clinic_id, contact_id, contact_type, purpose
HAVING count(*) > 1;
```

Migration aborta se preflight retornar linha. Nova unique:
`(clinic_id, contact_id, contact_type, purpose)`. `onConflictDoUpdate` usa mesmo target.

```bash
npm run db:generate -- --name=consent_tenant_unique
```

- [ ] **Step 4: aplicar em banco descartável e commit**

```bash
npm run db:reset && npm run db:migrate
npm run test:integration -- --runInBand consents.integration.test.ts
git add src/lib/db/schema/infra.ts src/services/contacts src/lib/db/migrations
git commit -m "fix: scope consent uniqueness by clinic"
```

### Task 5: Fechar contrato e tenancy de embeddings

**Files:**
- Modify: `src/lib/embeddings/generate.ts`
- Modify: `src/lib/embeddings/search.ts`
- Modify: `src/lib/env.ts`
- Test: `src/lib/embeddings/__tests__/generate.contract.test.ts`
- Test: `src/lib/embeddings/__tests__/search.integration.test.ts`

- [ ] **Step 1: escrever RED para dimensão, timeout e ownership**

```ts
it('does not update knowledge from another clinic', async () => {
  await expect(updateEmbedding(clinicA, knowledgeFromClinicB, vector)).rejects.toThrow('not_found')
})
```

- [ ] **Step 2: confirmar RED**

```bash
npm test -- src/lib/embeddings/__tests__/generate.contract.test.ts --runInBand
npm run test:integration -- --runInBand search.integration.test.ts
```

- [ ] **Step 3: congelar provider/model/dimensão e timeout**

```ts
const EMBEDDING_DIMENSIONS = 1536
const signal = AbortSignal.timeout(10_000)
const parsed = embeddingResponseSchema.parse(await response.json())
if (parsed.data[0].embedding.length !== EMBEDDING_DIMENSIONS) {
  throw new EmbeddingError('DIMENSION_MISMATCH')
}
```

Update usa `where(and(eq(id), eq(clinicId)))`. Remover fallback com dimensão divergente e resolver
conflito pgvector/Vectorize conforme ADR-BASE-04: pgvector único v1.

- [ ] **Step 4: testar e commit**

```bash
npm test -- src/lib/embeddings --runInBand
npm run test:integration -- --runInBand search.integration.test.ts
git add src/lib/embeddings src/lib/env.ts
git commit -m "fix: enforce embedding contract and tenant scope"
```

### Task 6: Tornar architecture tests efetivos

**Files:**
- Modify: `src/__tests__/architecture/boundary-rules.test.ts`
- Create: `src/__tests__/architecture/test-file-discovery.ts`
- Test: `src/__tests__/architecture/test-file-discovery.test.ts`

- [ ] **Step 1: escrever RED para glob vazio**

```ts
it('fails when architecture scan finds no production files', () => {
  expect(() => discoverRequiredFiles('missing/**/*.ts')).toThrow('ARCH_SCAN_EMPTY')
})
```

- [ ] **Step 2: confirmar RED**

```bash
npm test -- src/__tests__/architecture --runInBand
```

- [ ] **Step 3: descobrir arquivos reais e proibir tautologias**

```ts
const files = discoverRequiredFiles('src/**/*.{ts,tsx}', {
  ignore: ['**/*.test.*', '**/__tests__/**', '**/*.d.ts'],
})
expect(files.length).toBeGreaterThan(0)
```

Rules mínimas: route sem acesso direto cross-domain proibido; Action audit usa allowlist; rotas
públicas exatas; side effects externos referenciam outbox/idempotency.

- [ ] **Step 4: remover `expect(true)` e commit**

```bash
rg "expect\(true\)" src/__tests__/architecture && exit 1 || true
npm test -- src/__tests__/architecture --runInBand
git add src/__tests__/architecture
git commit -m "test: make architecture scans fail closed"
```

### Task 7: Corrigir dependências vulneráveis sem regressão

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: full gate

- [ ] **Step 1: capturar árvore e origem de cada high**

```bash
npm audit --json > audit-before.json
npm explain brace-expansion fast-uri tmp undici
```

`audit-before.json` fica fora do commit.

- [ ] **Step 2: atualizar dependências diretas responsáveis**

Usar menor update compatível. Proibido `npm audit fix --force`, downgrade de framework ou override
sem teste de contrato do consumidor.

- [ ] **Step 3: verificar produção e toolchain**

```bash
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npm run lint && npm run typecheck && npm test -- --runInBand && npm run build
```

Meta: zero high/critical produção. High apenas de toolchain exige issue, owner e prazo; não pode ser
ocultado.

- [ ] **Step 4: commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update vulnerable development dependencies"
```

### Task 8: Gate W3

```bash
npm run test:security
npm run test:integration
npm run lint && npm run typecheck && npm test -- --runInBand && npm run build
npm audit --omit=dev --audit-level=high
```

- [ ] Catálogo PostgreSQL confirma todas as constraints.
- [ ] Nenhum scan arquitetural vazio ou tautológico.
- [ ] Gitleaks staged e full history verdes.
- [ ] Review AppSec + architecture aprovado.
