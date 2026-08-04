# Audit Remediation W5 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar OpenNext/Cloudflare, staging, migration, observabilidade e rollback para Go/No-Go.

**Architecture:** Build reproduzível em WSL; Hyperdrive conecta PostgreSQL; staging usa ambiente e
secrets próprios; deploy produção exige gate humano. Rollback de Worker permanece compatível com
schema expandido.

**Tech Stack:** OpenNext 1.19, Wrangler 4.x, Cloudflare Workers, Hyperdrive, Durable Objects,
PostgreSQL 17.

**Agent Orchestration:** Supervisor-Workers — um worker valida config/build, outro prepara smoke e
runbook; supervisor executa staging e decisão final.

---

### Task 1: Atualizar referências e validar config Cloudflare

**Files:**
- Modify: `wrangler.toml`
- Modify: `wrangler.ia-bridge.jsonc`
- Modify: `src/workers/ia-agent/wrangler.jsonc`
- Modify: generated Worker types somente via `wrangler types`
- Test: `src/__tests__/cloudflare/`

- [ ] **Step 1: consultar documentação atual**

```bash
curl -L https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ \
  -o "$TEMP/cloudflare-workers-best-practices.html"
npx wrangler --version
node -e "JSON.parse(require('fs').readFileSync('node_modules/wrangler/config-schema.json'))"
```

- [ ] **Step 2: escrever teste RED de bindings/config**

```ts
expect(config).toMatchObject({
  compatibility_flags: expect.arrayContaining(['nodejs_compat']),
})
expect(bindingNames).toEqual(expect.arrayContaining(['HYPERDRIVE', 'NEXT_CACHE_DO_QUEUE']))
```

- [ ] **Step 3: reconciliar código, bindings e migrations DO**

Atualizar `compatibility_date` para data validada em staging, não apenas data atual. Preservar TOML
do OpenNext nesta remediação; migração para JSONC exige ADR separado. Secrets permanecem fora de
config. Observability usa sampling explícito e logs estruturados sem PII.

- [ ] **Step 4: regenerar types e executar testes**

```bash
npx wrangler types --config wrangler.ia-bridge.jsonc \
  src/workers/ia-bridge/worker-configuration.d.ts
npx wrangler types --config src/workers/ia-agent/wrangler.jsonc \
  src/workers/ia-agent/worker-configuration.d.ts
npm test -- src/__tests__/cloudflare --runInBand
npm run typecheck:ia-bridge && npm run typecheck:ia-agent
```

- [ ] **Step 5: commit**

```bash
git add wrangler.toml wrangler.ia-bridge.jsonc src/workers/ia-agent \
  src/workers/ia-bridge src/__tests__/cloudflare
git commit -m "chore: validate Cloudflare bindings and types"
```

### Task 2: Produzir build e dry-run reproduzíveis

**Files:**
- Modify: `docs/runbook-cloudflare-build.md`
- Test: generated `.open-next/worker.js` sem commit

- [ ] **Step 1: limpar artefatos sem tocar source**

```bash
rm -rf .next .open-next
```

- [ ] **Step 2: executar build em WSL**

```bash
wsl bash -lc 'rm -rf /tmp/synkroo-cf && mkdir /tmp/synkroo-cf && \
  cd /mnt/d/projetos/synkroo && git archive HEAD | tar -x -C /tmp/synkroo-cf && \
  cd /tmp/synkroo-cf && npm ci && npm run build:cf'
```

Expected: exit 0; Worker gerado; sem warning de queue direct.

- [ ] **Step 3: validar dry-run e startup**

```bash
wsl bash -lc 'cd /tmp/synkroo-cf && \
  npx wrangler deploy --dry-run --config wrangler.toml'
wsl bash -lc 'cd /tmp/synkroo-cf && \
  npx wrangler check startup --worker .open-next/worker.js'
```

Registrar tamanho, bindings listados, warning conhecido e versão das ferramentas no runbook.
Warning novo bloqueia gate até classificação com evidência.

- [ ] **Step 4: commit somente runbook**

```bash
git add docs/runbook-cloudflare-build.md
git commit -m "docs: record reproducible Cloudflare build"
```

### Task 3: Preparar staging isolado

**Files:**
- Modify: `wrangler.toml`
- Modify: `wrangler.ia-bridge.jsonc`
- Modify: `src/workers/ia-agent/wrangler.jsonc`
- Create: `docs/runbooks/staging-environment.md`

- [ ] **Step 1: definir environment sem IDs ou secrets fictícios**

Staging usa nomes próprios, Hyperdrive próprio, banco descartável e Queue/DO separados. IDs reais
entram por configuração aprovada; secrets entram somente por `wrangler secret put --env staging`.

- [ ] **Step 2: validar autenticação e secrets por nome**

```bash
npx wrangler whoami
npx wrangler secret list --env staging --config wrangler.toml
```

Nunca imprimir valores. Lista deve conter `AUTH_SECRET`, credenciais provider necessárias e nenhum
secret de produção reutilizado.

- [ ] **Step 3: dry-run do environment**

```bash
npx wrangler deploy --dry-run --env staging --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc
npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc
```

- [ ] **Step 4: commit**

```bash
git add wrangler.toml wrangler.ia-bridge.jsonc src/workers/ia-agent/wrangler.jsonc \
  docs/runbooks/staging-environment.md
git commit -m "chore: define isolated staging environment"
```

### Task 4: Ensaiar migration e rollback de schema

**Files:**
- Create: `scripts/verify-remediation-schema.mjs`
- Create: `docs/runbooks/remediation-migration-rollback.md`
- Test: `src/lib/db/__tests__/remediation-schema.integration.test.ts`

- [ ] **Step 1: escrever RED do catálogo PostgreSQL**

```ts
expect(await uniqueColumns('outbox_jobs')).toContainEqual([
  'clinic_id', 'operation', 'business_key',
])
expect(await uniqueColumns('consents')).toContainEqual([
  'clinic_id', 'contact_id', 'contact_type', 'purpose',
])
```

- [ ] **Step 2: restaurar backup anonimizado em banco de staging**

Executar preflights, migration e verificação. Dados reais sem anonimização são proibidos.

```bash
TEST_DATABASE_URL="$STAGING_TEST_DATABASE_URL" npm run db:migrate
TEST_DATABASE_URL="$STAGING_TEST_DATABASE_URL" node scripts/verify-remediation-schema.mjs
```

- [ ] **Step 3: ensaiar rollback de Worker**

Schema segue expand/contract; versão anterior do Worker deve iniciar e ler schema expandido. Não
reverter migration destrutivamente durante incidente.

- [ ] **Step 4: testar e commit**

```bash
npm run test:integration -- --runInBand remediation-schema.integration.test.ts
git add scripts/verify-remediation-schema.mjs docs/runbooks/remediation-migration-rollback.md \
  src/lib/db/__tests__/remediation-schema.integration.test.ts
git commit -m "test: verify remediation schema rollout"
```

### Task 5: Criar smoke staging sem PII

**Files:**
- Create: `scripts/smoke-staging.mjs`
- Test: `scripts/__tests__/smoke-staging.test.ts`
- Modify: `docs/runbooks/staging-environment.md`

- [ ] **Step 1: escrever teste RED do runner**

```ts
expect(redactSmokeOutput({ token: 'secret', email: 'patient@example.com' }))
  .toEqual({ token: '[REDACTED]', email: '[REDACTED]' })
```

- [ ] **Step 2: implementar checks com timeout**

Checks: liveness, auth inválida, auth válida sintética, sessão, switch-clinic, route protection,
agenda tenant-scoped, webhook inválido, readiness protegida e assets. Cada fetch usa AbortSignal de
10 segundos e saída JSON sem payload clínico.

- [ ] **Step 3: executar contra staging**

```bash
STAGING_BASE_URL="$STAGING_BASE_URL" node scripts/smoke-staging.mjs
```

Expected: uma linha JSON por check; todos `status=pass`; zero secret/PII.

- [ ] **Step 4: commit**

```bash
git add scripts/smoke-staging.mjs scripts/__tests__/smoke-staging.test.ts \
  docs/runbooks/staging-environment.md
git commit -m "test: add privacy-safe staging smoke"
```

### Task 6: Executar deploy staging e rollback real

**Files:**
- Modify: `docs/superpowers/audits/goal-ledger.md`
- Modify: `docs/runbooks/remediation-migration-rollback.md`

- [ ] **Step 1: obter aprovação explícita do owner antes de mutação remota**

Sem aprovação: parar no dry-run. Com aprovação: registrar janela e versão anterior sem expor IDs
sensíveis em logs públicos.

- [ ] **Step 2: deploy staging**

```bash
npx wrangler deploy --env staging --config wrangler.toml
npx wrangler deploy --env staging --config wrangler.ia-bridge.jsonc
npx wrangler deploy --env staging --config src/workers/ia-agent/wrangler.jsonc
```

- [ ] **Step 3: smoke e observabilidade**

```bash
STAGING_BASE_URL="$STAGING_BASE_URL" node scripts/smoke-staging.mjs
npx wrangler tail --env staging --config wrangler.toml --status error
```

Tail usa janela limitada; revisar logs por PII e encerrar processo.

- [ ] **Step 4: rollback e novo smoke**

```bash
npx wrangler versions list --env staging --config wrangler.toml
npx wrangler rollback --env staging --config wrangler.toml
STAGING_BASE_URL="$STAGING_BASE_URL" node scripts/smoke-staging.mjs
```

Após comprovar rollback, redeploy da versão candidata exige nova aprovação.

- [ ] **Step 5: registrar evidência e commit**

```bash
git add docs/superpowers/audits/goal-ledger.md docs/runbooks/remediation-migration-rollback.md
git commit -m "docs: record staging rollback evidence"
```

### Task 7: Reauditoria e Go/No-Go

**Files:**
- Create: `docs/superpowers/audits/2026-08-03-remediation-go-no-go.md`
- Modify: `docs/superpowers/audits/goal-ledger.md`
- Modify: `docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md`

- [ ] **Step 1: executar gates finais frescos**

```bash
npm ci
npm run lint && npm run typecheck && npm test -- --runInBand
npm run test:integration && npm run test:security && npm run build
npm run test:e2e && npm run test:e2e
npm audit --omit=dev --audit-level=high
gitleaks detect --source . --no-banner --redact --log-opts='--all'
```

- [ ] **Step 2: executar quatro reviews independentes**

Correctness, domain/architecture, AppSec e UX/quality. Cada finding recebe reprodução ou descarte
com evidência. Reviewer não pode alterar código durante classificação.

- [ ] **Step 3: decidir**

`GO`: zero P0/P1, gates verdes, staging/rollback verdes. `NO-GO`: qualquer bypass tenant/auth,
PII, duplicação financeira, E2E vermelho, migration ou rollback não demonstrado.

- [ ] **Step 4: registrar decisão, evidências e commit**

```bash
git add docs/superpowers/audits docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md
git commit -m "docs: record remediation go-no-go"
```

Produção permanece fora deste plano. Após `GO`, usar workflow `ship` e depois `land-and-deploy` com
aprovação do owner.
