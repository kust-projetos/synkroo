# W0 + W1 — Estabilização e Morte do Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o repositório com baseline limpo (`tsc` e testes verdes, docs fiéis, sem lixo versionado) e remover por completo todo resíduo do Supabase, com Drizzle como única fonte de verdade.

**Architecture:** Duas fases sequenciais. **W0** é higiene de baixo risco (untrack de cache, fix de tipos de teste, limpeza de raiz, docs). **W1** remove o bridge Supabase depreciado — que o reconhecimento provou ser **quase todo código morto**: o único consumidor runtime (`complete-profile`) é uma rota órfã, e os demais consumidores são apenas imports type-only que migram para tipos inferidos do schema Drizzle.

**Tech Stack:** Next.js 15, TypeScript 5.6, Drizzle ORM, `pg`, NextAuth, Jest + ts-jest, `@testing-library/jest-dom` 6.9.1.

**Pré-requisito de contexto (fatos do reconhecimento, validados em 2026-06-17):**
- 339 arquivos `graphify-out/` estão versionados apesar de `.gitignore` (commitados antes da regra).
- `tsconfig.json` inclui `**/*.ts`/`**/*.tsx`; `src/types/jest-dom.d.ts` entra no typecheck sem ajuste de `include`.
- `tsc --noEmit`: 0 erros em produção, **63 erros só em testes** (`toBeInTheDocument`), causados por augmentação de tipos do jest-dom não-global.
- Único import runtime do bridge: `src/app/complete-profile/page.tsx` → `import { supabase } from '@/lib/supabase/client'` (usa `supabase.auth.getUser()`, que retorna user vazio — quebrado). Rota sem referência runtime; existem só docs/planos antigos citando `/complete-profile`.
- 7 consumidores type-only de `@/lib/supabase/database.types`: importam `AppointmentStatus`, `Patient` e/ou `Appointment`.
- Testes ainda mockam `@/lib/supabase`/`@/lib/supabase/typed` (`agent.service.test.ts`, `incomplete-treatment.service.test.ts`, `multi-agent.integration.test.ts`, `instagram/webhook/route.test.ts`, bridge test). Eles viram cleanup obrigatório, não prova de uso runtime.
- `package.json`/`package-lock.json` não têm `@supabase/*`, mas scripts legados ainda usam Supabase/REST (`seed-database.ts`, `seed-appointments.js`, `seed-scale-data.js`, `seed-e2e-data.js`, `seed-e2e-clinic.js`, `test-supabase.ts`, `setup-env.sh`, `split-auth-imports.py`).
- Docs/CI ativos ainda citam Supabase: `README.md`, `.env.example`, `docs/ENV-CHECKLIST.md`, `docs/DATABASE_SETUP.md`, `docs/GUIA-CONFIGURACAO.md`, `.github/workflows/ci.yml`.
- Ninguém importa `@/lib/supabase/server`, `@/lib/supabase/admin`, `supabaseAdmin`, nem o index `@/lib/supabase` fora do próprio diretório em runtime.
- Enum Drizzle: `appointmentStatus = pgEnum('appointment_status', ['scheduled','confirmed','in_progress','completed','cancelled','no_show'])` em `src/lib/db/schema/enums.ts`.
- Schema Drizzle exporta as tabelas via `src/lib/db/schema/index.ts` (`export * from './core'` etc.). `appointments` usa `scheduledAt` + `durationMinutes`, não `startsAt`/`endsAt`.

**IMPORTANTE — esta etapa é só implementação guiada; sem alterações de produto/UX além das listadas. Não refatorar componentes de calendar/pacientes além do necessário para compilar (isso é W2/W6).**

---

## File Structure

| Fase | Create | Modify | Delete |
|---|---|---|---|
| W0 | `src/types/jest-dom.d.ts` | `.gitignore`, `CLAUDE.md`, `AGENTS.md`, docs/env/CI ativos | arquivos soltos untracked |
| W1 | `src/lib/db/types.ts` | 7 imports type-only, mocks de testes, env/health/layout, scripts de seed/setup | `complete-profile`, bridge `src/lib/supabase*`, `supabase/`, docs/scripts Supabase mortos |

Gate W1: nenhum `@/lib/supabase`, `@supabase/*`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `supabase.from`, `.rpc(` em superfícies ativas.

---

# FASE W0 — Estabilização

### Task 1: Remover `graphify-out/` do versionamento

**Files:**
- Modify: git index (untrack), `.gitignore` (já contém a regra — confirmar)

- [ ] **Step 1: Confirmar que a regra já existe no `.gitignore`**

Run: `grep -n "graphify-out" .gitignore`
Expected: imprime `graphify-out/` e `/.claude/graphify-out/` (já presentes).

- [ ] **Step 2: Untrack todos os arquivos `graphify-out/` mantendo-os em disco**

Run:
```bash
git ls-files -z '*graphify-out*' | xargs -0 -r git rm --cached --quiet --
```
Fallback sem `xargs -r`:
```bash
files=$(git ls-files '*graphify-out*')
[ -z "$files" ] || git rm --cached --quiet -- $files
```

- [ ] **Step 3: Verificar que nada de `graphify-out` continua trackeado**

Run: `git ls-files | grep -c graphify-out`
Expected: `0`

- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: untrack graphify-out cache (ja no gitignore)"`

---

### Task 2: Corrigir augmentação de tipos do jest-dom (63 erros `tsc`)

**Causa-raiz:** `jest.setup.ts` faz `import '@testing-library/jest-dom'`, mas como é um módulo, sua augmentação `declare global` só alcança quem o importa. Os arquivos de teste não importam o setup (ele é `setupFilesAfterEnv`, runtime-only), então o `tsc` não vê os matchers. A correção é um arquivo `.d.ts` **ambient** (sem imports no topo, só triple-slash reference), que o `tsc` aplica globalmente.

**Files:**
- Create: `src/types/jest-dom.d.ts`

- [ ] **Step 1: Confirmar o estado atual (teste que falha)**

Run: `npx tsc --noEmit 2>&1 | grep -c "toBeInTheDocument"`
Expected: número > 0 (≈ 63) — confirma o problema antes do fix.

- [ ] **Step 2: Criar o arquivo de declaração ambient**

Create `src/types/jest-dom.d.ts`:
```ts
/// <reference types="@testing-library/jest-dom" />
```

Confirmar que `tsconfig.json` inclui esse arquivo:
```bash
node -e "const t=require('./tsconfig.json'); console.log(t.include.join('\n'))" | grep -E '\*\*/\*\.ts|src/types'
```
Expected: `**/*.ts` aparece (estado atual) ou `src/types/**/*.d.ts` aparece se o include mudar no futuro.

- [ ] **Step 3: Verificar que os erros sumiram**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Confirmar que a suíte continua passando**

Run: `npm test -- --silent 2>&1 | tail -5`
Expected: suíte conclui sem novas falhas (mesmo estado de antes ou melhor).

- [ ] **Step 5: Commit** — `git add src/types/jest-dom.d.ts && git commit -m "fix: augmentacao global de tipos jest-dom (tsc verde nos testes)"`

---

### Task 3: Limpar arquivos soltos da raiz

**Files:**
- Delete (untracked): `nul`, `weekprof.txt`, `dayprof_after.txt`, `%TEMP%weekprof.txt`, `.dev-server.log`, `.pi-dev-server.log`, `build.log`
- Modify: `.gitignore`

- [ ] **Step 1: Remover os arquivos soltos**

Run:
```bash
rm -f nul weekprof.txt dayprof_after.txt '%TEMP%weekprof.txt' .dev-server.log .pi-dev-server.log build.log
```

- [ ] **Step 2: Adicionar padrões ao `.gitignore` para evitar reincidência**

Append ao final de `.gitignore`:
```
# Scratch / logs locais
*.log
nul
*weekprof.txt
dayprof_after.txt
```

- [ ] **Step 3: Verificar `git status` limpo desses itens**

Run: `git status --short | grep -E "weekprof|dayprof|nul|\.log" | wc -l`
Expected: `0`

- [ ] **Step 4: Commit** — `git add .gitignore && git commit -m "chore: limpa arquivos soltos da raiz e reforca gitignore"`

---

### Task 4: Atualizar `CLAUDE.md` e `AGENTS.md` com a stack real

**Contexto:** Ambos descrevem "Supabase (PostgreSQL + RLS + pgvector + Auth SSR)", o que está **errado**. A stack real é Drizzle + `pg` + NextAuth, indo para Cloudflare. Estes arquivos são idênticos (mesmo tamanho/conteúdo).

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`, `README.md`, `.env.example`, `docs/ENV-CHECKLIST.md`, `docs/DATABASE_SETUP.md`, `docs/GUIA-CONFIGURACAO.md`, `.github/workflows/ci.yml`

- [ ] **Step 1: Corrigir a tabela de Stack em `CLAUDE.md`**

Na seção `## Stack`, substituir a linha de DB/Auth:
```
| DB/Auth | Supabase (PostgreSQL + RLS + pgvector + Auth SSR) |
```
por:
```
| DB | PostgreSQL via Drizzle ORM + `pg` (Supabase removido — ver roadmap-mestre) |
| Auth | NextAuth/Auth.js (JWT, edge middleware) |
| Runtime alvo | Cloudflare Workers (OpenNext) + Hyperdrive + Vectorize — em migração |
```

- [ ] **Step 2: Corrigir a seção "Supabase CLI" e env vars**

Remover/atualizar qualquer menção a `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`, RLS e à seção "Supabase CLI". Adicionar nota apontando para `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` como fonte de verdade da direção.

- [ ] **Step 3: Replicar as mesmas mudanças em `AGENTS.md`**

Aplicar exatamente as mesmas edições dos Steps 1–2 em `AGENTS.md` (mantê-los idênticos).

- [ ] **Step 4: Corrigir docs/env/CI ativos**

- `README.md`: trocar estrutura `lib/supabase` por `lib/db`, stack Supabase Auth por NextAuth, comandos `supabase:*` por `db:*` reais.
- `.env.example`: remover bloco Supabase comentado.
- `docs/ENV-CHECKLIST.md`, `docs/DATABASE_SETUP.md`, `docs/GUIA-CONFIGURACAO.md`: reescrever para Postgres/Drizzle ou deletar se duplicarem README.
- `.github/workflows/ci.yml`: remover envs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` do build.

- [ ] **Step 5: Verificar que não restou menção enganosa a Supabase como stack ativa**

Run:
```bash
rg -n "Supabase Auth|Supabase \(PostgreSQL|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|supabase:start|db:types|lib/supabase" \
  CLAUDE.md AGENTS.md README.md .env.example .github docs \
  --glob '!docs/archive/**' --glob '!docs/superpowers/**' --glob '!docs/architecture/**'
```
Expected: nenhuma saída em docs/CI ativos. Docs deletadas não quebram o check.

- [ ] **Step 6: Commit** — `git add CLAUDE.md AGENTS.md README.md .env.example docs/ENV-CHECKLIST.md docs/DATABASE_SETUP.md docs/GUIA-CONFIGURACAO.md .github/workflows/ci.yml && git commit -m "docs: corrige stack ativa para Drizzle e NextAuth"`

---

# FASE W1 — Morte do Supabase

### Task 5: Deletar a rota órfã `complete-profile`

**Contexto:** Único consumidor runtime do bridge. Comprovadamente órfã: sem referências, `auth.getUser()` já quebrado, criação de user coberta por `createUserWithClinic` no fluxo de signup.

**Files:**
- Delete: `src/app/complete-profile/`

- [ ] **Step 1: Reconfirmar que é órfã**

Run:
```bash
rg -n "complete-profile" src README.md .github next.config.ts e2e playwright.config.ts \
  --glob '!src/app/complete-profile/**' \
  --glob '!**/graphify-out/**'
```
Expected: nenhuma saída em superfície ativa/runtime. Menções em docs históricas não bloqueiam deleção.

- [ ] **Step 2: Deletar o diretório**

Run: `rm -rf src/app/complete-profile`

- [ ] **Step 3: Verificar que o build de tipos não quebrou**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: remove rota orfa complete-profile (ultimo uso runtime do bridge)"`

---

### Task 6: Criar tipos de domínio inferidos do Drizzle

**Contexto:** Substituem os tipos que `database.types.ts` exportava. Drizzle infere o tipo da linha via `InferSelectModel`; o enum vira union via `.enumValues`.

**Files:**
- Create: `src/lib/db/types.ts`

- [ ] **Step 1: Criar o módulo de tipos**

Create `src/lib/db/types.ts`:
```ts
import type { InferSelectModel } from 'drizzle-orm'
import { appointments } from './schema/appointments'
import { patients } from './schema/core'
import { appointmentStatus } from './schema/enums'

export type Patient = InferSelectModel<typeof patients>
export type Appointment = InferSelectModel<typeof appointments>
export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number]
```

> YAGNI: exportar só tipos usados agora. Adicionar `Clinic`, `User`, etc. apenas quando aparecer 2º consumidor real.

- [ ] **Step 2: Verificar que o módulo compila**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Commit** — `git add src/lib/db/types.ts && git commit -m "feat: tipos de dominio inferidos do schema Drizzle"`

---

### Task 7: Migrar os 7 imports type-only para os tipos Drizzle

**Contexto:** Os consumidores importam `AppointmentStatus`, `Patient` e/ou `Appointment` de `@/lib/supabase/database.types`. Trocar a origem para `@/lib/db/types`. **Atenção ao snake_case → camelCase:** o tipo antigo (Supabase) era snake_case (`clinic_id`, `birth_date`), o tipo Drizzle é camelCase (`clinicId`, `birthDate`). Onde o componente acessar propriedades snake_case de `Patient`/`Appointment`, o `tsc` apontará — ajustar para camelCase guiado pela tabela abaixo.

**Tabela de mapeamento (colunas comuns):**
`clinic_id→clinicId`, `birth_date→birthDate`, `last_visit_at→lastVisitAt`, `risk_score→riskScore`, `created_at→createdAt`, `updated_at→updatedAt`, `deleted_at→deletedAt`, `avatar_url→avatarUrl`, `is_active→isActive`, `patient_id→patientId`, `dentist_id→dentistId`, `procedure_id→procedureId`, `scheduled_at→scheduledAt`, `duration_minutes→durationMinutes`, `total_value→totalValue`.

> Não usar `startsAt`/`endsAt` para `appointments`: schema atual usa `scheduledAt` + `durationMinutes`.

**Files (todos Modify):**
- `src/app/dashboard/agendamentos/list-view.tsx:9`
- `src/app/dashboard/pacientes/page.tsx:8`
- `src/app/dashboard/pacientes/[id]/page.tsx:15`
- `src/components/calendar/AppointmentDialog.tsx:19`
- `src/components/calendar/events/EventCard.tsx:12`
- `src/components/calendar/events/EventTooltip.tsx:12`
- `src/components/calendar/utils/types.ts:3`

- [ ] **Step 1: Trocar a origem do import nos 4 arquivos que usam só `AppointmentStatus`**

Nesses 4 arquivos (`AppointmentDialog.tsx`, `EventCard.tsx`, `EventTooltip.tsx`, `utils/types.ts`), substituir:
```ts
import type { AppointmentStatus } from '@/lib/supabase/database.types'
```
por:
```ts
import type { AppointmentStatus } from '@/lib/db/types'
```

- [ ] **Step 2: Trocar a origem do import nos 3 arquivos que usam `Patient`/`Appointment`**

- `agendamentos/list-view.tsx`: `import type { Appointment } from '@/lib/db/types'`
- `pacientes/page.tsx`: `import type { Patient } from '@/lib/db/types'`
- `pacientes/[id]/page.tsx`: `import type { Patient, Appointment } from '@/lib/db/types'`

- [ ] **Step 3: Rodar tsc e listar mismatches snake→camel**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -E "list-view|pacientes"`
Expected: zero ou alguns erros de "Property 'x_y' does not exist".

- [ ] **Step 4: Para cada erro, ajustar o acesso de propriedade para camelCase** (tabela acima). Repetir Step 3 até zerar.

- [ ] **Step 5: Verificação global de tipos**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 6: Commit** — `git add -A && git commit -m "refactor: tipos de dominio vem do Drizzle, nao do bridge Supabase"`

---

### Task 8: Remover env vars do Supabase do código runtime

**Files (todos Modify):**
- `src/lib/env.ts`, `jest.setup.ts`, `src/app/dashboard/layout.tsx`, `src/app/api/health/route.ts`

- [ ] **Step 1: `src/lib/env.ts` — remover as 3 entradas SUPABASE**

Remover do schema e dos blocos de leitura/fallback as três chaves: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, e o comentário "Supabase (CUTOVER COMPLETE …)".

- [ ] **Step 2: `jest.setup.ts` — remover as 3 linhas de mock**

Remover:
```ts
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
```

- [ ] **Step 3: `src/app/dashboard/layout.tsx` — trocar a condição `isDevBypass`**

Substituir:
```ts
const isDevBypass = process.env.NODE_ENV === 'development' &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
   process.env.NEXT_PUBLIC_USE_MOCKS === 'true')
```
por:
```ts
const isDevBypass = process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
```

- [ ] **Step 4: `src/app/api/health/route.ts` — trocar health env para stack real**

Remover as 3 vars Supabase. Reportar `DATABASE_URL` como DB crítico e manter LLM/WhatsApp como opcionais/feature flags. Health não deve ficar `unhealthy` por ausência de Supabase.

- [ ] **Step 5: Verificar ausência no runtime**

Run:
```bash
rg -n "NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|Supabase \(CUTOVER" src jest.setup.ts
```
Expected: nenhuma saída.

- [ ] **Step 6: Verificar tsc**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 7: Commit** — `git add -A && git commit -m "chore: remove env vars do Supabase do runtime"`

---

### Task 9: Deletar bridge, scripts e migrations legadas

**Files (Delete/Modify):**
- Delete: `src/lib/supabase/`, `src/lib/supabase.ts`, `supabase/`
- Delete: `docs/MCP_SUPABASE_SETUP.md`, `docs/supabase-setup.md`
- Delete: `scripts/test-supabase.ts`, `scripts/seed-appointments.js`, `scripts/seed-scale-data.js`, `scripts/seed-e2e-data.js`, `scripts/seed-e2e-clinic.js`, `scripts/split-auth-imports.py`
- Modify/Rewrite: `scripts/seed-database.ts`, `scripts/setup-env.sh`, `src/lib/db/schema/index.ts`, Supabase-mock tests
- Verify: `package.json`, `package-lock.json` sem `@supabase/*`

- [ ] **Step 1: Reconfirmar que nada runtime importa o bridge**

Run:
```bash
rg -n "@/lib/supabase|@/lib/supabase/typed|createTypedClient|createAdminClient|createServerClient|supabase\.from|\.rpc\(" src \
  --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!**/__tests__/**' --glob '!**/graphify-out/**' \
  --glob '!src/lib/supabase/**' --glob '!src/lib/supabase.ts'
```
Expected: nenhuma saída após Tasks 5–7.

- [ ] **Step 2: Limpar testes com mocks Supabase**

Run:
```bash
rg -n "@/lib/supabase|@/lib/supabase/typed|createTypedClient|createAdminClient|createServerClient" src --glob '**/*.test.ts' --glob '**/*.test.tsx'
```
Ações:
- `src/lib/__tests__/supabase-bridge.test.ts`: deletar.
- Testes com mock stale e alvo já em Drizzle: remover mock/require Supabase.
- Testes cujo alvo ainda depende do bridge: migrar alvo para Drizzle/repositório antes de deletar bridge.
- `src/__tests__/api/auth/README.md`: remover envs Supabase ou deletar README se desatualizado.

- [ ] **Step 3: Portar/deletar scripts Supabase**

- Deletar scripts sem contrato npm ativo: `test-supabase.ts`, `seed-appointments.js`, `seed-scale-data.js`, `seed-e2e-data.js`, `seed-e2e-clinic.js`, `split-auth-imports.py`.
- Reescrever `scripts/seed-database.ts` para usar Drizzle (`getDb()` + tabelas em `src/lib/db/schema/*`) e `DATABASE_URL`/`POSTGRES_*`. Remover `@ts-nocheck`, snake_case payloads e prompts `NEXT_PUBLIC_SUPABASE_*`.
- Atualizar `scripts/setup-env.sh` para Postgres/Drizzle/NextAuth; zero prompt de Supabase.
- Manter `npm run db:seed`/`npm run seed` apontando para script válido.

- [ ] **Step 4: Verificar dependências**

Run:
```bash
rg -n "@supabase" package.json package-lock.json
```
Expected: nenhuma saída. Se aparecer: `npm uninstall @supabase/supabase-js @supabase/ssr` e commitar lockfile.

- [ ] **Step 5: Deletar bridge, migrations e docs mortas**

Run:
```bash
rm -rf src/lib/supabase src/lib/supabase.ts supabase
rm -f docs/MCP_SUPABASE_SETUP.md docs/supabase-setup.md
```
Também trocar comentário em `src/lib/db/schema/index.ts` de `Ported from supabase/migrations/*.sql` para `Ported from legacy SQL migrations`.

- [ ] **Step 6: Verificação ativa anti-resíduo**

Run:
```bash
rg -n "@supabase|@/lib/supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|supabase\.from|\.rpc\(|supabase/migrations" \
  src scripts package.json package-lock.json .env.example README.md CLAUDE.md AGENTS.md .github docs \
  --glob '!docs/archive/**' --glob '!docs/superpowers/**' --glob '!docs/architecture/**'
```
Expected: nenhuma saída em superfícies ativas. Docs deletadas não quebram o check.

- [ ] **Step 7: Verificação de tipos e testes focados**

Run:
```bash
npx tsc --noEmit
npm test -- --runInBand \
  src/__tests__/agent.service.test.ts \
  src/services/appointments/__tests__/incomplete-treatment.service.test.ts \
  src/services/agents/__tests__/multi-agent.integration.test.ts \
  src/app/api/instagram/webhook/__tests__/route.test.ts
```
Expected: `tsc` exit 0; suítes afetadas por mocks Supabase passam ou são removidas quando testavam só o bridge.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "chore: remove bridge Supabase e scripts legados"`

---

### Task 10: Verificação final do baseline

- [ ] **Step 1: Anti-resíduo em superfícies ativas**

Run:
```bash
rg -n "@supabase|@/lib/supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|Supabase Auth|Supabase \(PostgreSQL|supabase\.from|\.rpc\(|supabase/migrations|complete-profile" \
  src scripts package.json package-lock.json .env.example README.md CLAUDE.md AGENTS.md .github docs \
  --glob '!docs/archive/**' --glob '!docs/superpowers/**' --glob '!docs/architecture/**'
```
Expected: nenhuma saída. Menções históricas em arquivos excluídos ficam fora do gate.
- [ ] **Step 2: Typecheck verde**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint verde**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 4: Suíte de testes**

Run: `npm test -- --runInBand`
Expected: todas as suítes restantes passam. Nenhuma falha nova por mocks Supabase removidos.

- [ ] **Step 5: Build de produção**

Run: `npm run build`
Expected: build conclui sem erro de tipo/lint/env relacionado a Supabase ou tipos migrados.

- [ ] **Step 6: Package/scripts sanity**

Run:
```bash
npm run db:health
npm run db:seed -- --dry-run
```
Expected: `db:health` exit 0 com DB local ativo; se `db:seed` não suportar `--dry-run`, adicionar dry-run ou documentar comando real seguro antes do commit final.

- [ ] **Step 7: Commit final (se houve ajuste)** — `git add -A && git commit -m "chore: baseline verde apos remocao do Supabase"`

---

## Self-Review

**Spec coverage (vs. roadmap-mestre §8 W0/W1):**
- W0 graphify-out → Task 1 ✓ | jest-dom/tsc → Task 2 ✓ | arquivos soltos → Task 3 ✓ | docs/env/CI stack ativa → Task 4 ✓
- W1 consumidores do bridge → Tasks 5 (runtime órfão) + 7 (type-only) + 9 (tests) ✓ | `database.types` → Tasks 6+7 ✓ | env vars → Task 8 ✓ | bridge/migrations/scripts/docs/deps → Task 9 ✓

**Placeholder scan:** sem "TBD/TODO". Pontos guiados por compilador têm comando + regra de decisão.

**Type consistency:** `AppointmentStatus`, `Patient`, `Appointment` definidos na Task 6 (`src/lib/db/types.ts`) e consumidos na Task 7. `appointmentStatus.enumValues` corresponde ao enum confirmado em `enums.ts`.

**Risk notes:**
- `scripts/seed-database.ts` é o maior delta de W1; sem port dele, `npm run db:seed` continua legado.
- `complete-profile` tem referências em docs históricas; gate final exclui docs antigas e valida só superfícies ativas.
- `rg` em Windows quebra com arquivo `nul`; Task 3 precisa rodar antes dos gates repo-wide.
