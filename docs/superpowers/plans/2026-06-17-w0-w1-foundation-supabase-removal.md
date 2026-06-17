# W0 + W1 — Estabilização e Morte do Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o repositório com baseline limpo (`tsc` e testes verdes, docs fiéis, sem lixo versionado) e remover por completo todo resíduo do Supabase, com Drizzle como única fonte de verdade.

**Architecture:** Duas fases sequenciais. **W0** é higiene de baixo risco (untrack de cache, fix de tipos de teste, limpeza de raiz, docs). **W1** remove o bridge Supabase depreciado — que o reconhecimento provou ser **quase todo código morto**: o único consumidor runtime (`complete-profile`) é uma rota órfã, e os demais consumidores são apenas imports type-only que migram para tipos inferidos do schema Drizzle.

**Tech Stack:** Next.js 15, TypeScript 5.6, Drizzle ORM, `pg`, NextAuth, Jest + ts-jest, `@testing-library/jest-dom` 6.9.1.

**Pré-requisito de contexto (fatos do reconhecimento):**
- 322 arquivos `graphify-out/` estão versionados apesar de `.gitignore` (commitados antes da regra).
- `tsc --noEmit`: 0 erros em produção, **63 erros só em testes** (`toBeInTheDocument`), causados por augmentação de tipos do jest-dom não-global.
- Único import runtime do bridge: `src/app/complete-profile/page.tsx` → `import { supabase } from '@/lib/supabase/client'` (usa `supabase.auth.getUser()`, que retorna user vazio — quebrado). Rota **órfã** (nenhuma referência no código; signup redireciona a `/dashboard`).
- 7 consumidores type-only de `@/lib/supabase/database.types`: importam `AppointmentStatus`, `Patient` e/ou `Appointment`.
- Ninguém importa `@/lib/supabase/server`, `@/lib/supabase/admin`, `supabaseAdmin`, nem o index `@/lib/supabase` fora do próprio diretório.
- Enum Drizzle: `appointmentStatus = pgEnum('appointment_status', ['scheduled','confirmed','in_progress','completed','cancelled','no_show'])` em `src/lib/db/schema/enums.ts`.
- Schema Drizzle exporta as tabelas via `src/lib/db/schema/index.ts` (`export * from './core'` etc.).

**IMPORTANTE — esta etapa é só implementação guiada; sem alterações de produto/UX além das listadas. Não refatorar componentes de calendar/pacientes além do necessário para compilar (isso é W2/W6).**

---

## File Structure

**W0:**
- Modify: `.gitignore` (garantir ignore de arquivos soltos)
- Create: `src/types/jest-dom.d.ts` (augmentação global ambient dos matchers)
- Rewrite: `CLAUDE.md`, `AGENTS.md` (stack real)
- Delete (untracked): arquivos soltos da raiz

**W1:**
- Delete: `src/app/complete-profile/` (rota órfã), `src/lib/supabase/` (bridge), `src/lib/supabase.ts` (bridge), `supabase/` (migrations legadas), `docs/MCP_SUPABASE_SETUP.md`/`docs/supabase-setup.md` (docs mortas)
- Create: `src/lib/db/types.ts` (tipos de domínio inferidos do Drizzle)
- Modify: 7 consumidores type-only (trocar import), `src/lib/env.ts`, `jest.setup.ts`, `src/app/dashboard/layout.tsx`, `src/app/api/health/route.ts`

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
git rm -r --cached --quiet $(git ls-files 'src/**/graphify-out/**' 'graphify-out/**')
```
(Se o glob falhar no shell, usar: `git ls-files | grep graphify-out | xargs git rm --cached --quiet`)

- [ ] **Step 3: Verificar que nada de `graphify-out` continua trackeado**

Run: `git ls-files | grep -c graphify-out`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: untrack graphify-out cache (ja no gitignore)"
```

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

- [ ] **Step 3: Verificar que os erros sumiram**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Confirmar que a suíte continua passando**

Run: `npm test -- --silent 2>&1 | tail -5`
Expected: suíte conclui sem novas falhas (mesmo estado de antes ou melhor).

- [ ] **Step 5: Commit**

```bash
git add src/types/jest-dom.d.ts
git commit -m "fix: augmentacao global de tipos jest-dom (tsc verde nos testes)"
```

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

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: limpa arquivos soltos da raiz e reforca gitignore"
```

---

### Task 4: Atualizar `CLAUDE.md` e `AGENTS.md` com a stack real

**Contexto:** Ambos descrevem "Supabase (PostgreSQL + RLS + pgvector + Auth SSR)", o que está **errado**. A stack real é Drizzle + `pg` + NextAuth, indo para Cloudflare. Estes arquivos são idênticos (mesmo tamanho/conteúdo).

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`

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

- [ ] **Step 4: Verificar que não restou menção enganosa a Supabase como stack ativa**

Run: `grep -niE "supabase (auth|rls|ssr)|DB/Auth" CLAUDE.md AGENTS.md`
Expected: nenhuma linha descrevendo Supabase como stack atual.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: corrige stack em CLAUDE.md/AGENTS.md (Drizzle+NextAuth, nao Supabase)"
```

---

# FASE W1 — Morte do Supabase

### Task 5: Deletar a rota órfã `complete-profile`

**Contexto:** Único consumidor runtime do bridge. Comprovadamente órfã: sem referências, `auth.getUser()` já quebrado, criação de user coberta por `createUserWithClinic` no fluxo de signup.

**Files:**
- Delete: `src/app/complete-profile/`

- [ ] **Step 1: Reconfirmar que é órfã**

Run: `grep -rn "complete-profile" src --include="*.ts" --include="*.tsx" | grep -v graphify | grep -v "app/complete-profile/"`
Expected: nenhuma saída (zero referências).

- [ ] **Step 2: Deletar o diretório**

Run: `rm -rf src/app/complete-profile`

- [ ] **Step 3: Verificar que o build de tipos não quebrou**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove rota orfa complete-profile (ultimo uso runtime do bridge)"
```

---

### Task 6: Criar tipos de domínio inferidos do Drizzle

**Contexto:** Substituem os tipos que `database.types.ts` exportava. Drizzle infere o tipo da linha via `InferSelectModel`; o enum vira union via `.enumValues`.

**Files:**
- Create: `src/lib/db/types.ts`

- [ ] **Step 1: Criar o módulo de tipos**

Create `src/lib/db/types.ts`:
```ts
import type { InferSelectModel } from 'drizzle-orm';
import {
  clinics, users, dentists, procedures, patients,
} from './schema/core';
import { appointments } from './schema/appointments';
import { conversations, messages } from './schema/conversations';
import { appointmentStatus } from './schema/enums';

// Tipos de linha (camelCase — fonte de verdade do schema Drizzle)
export type Clinic = InferSelectModel<typeof clinics>;
export type User = InferSelectModel<typeof users>;
export type Dentist = InferSelectModel<typeof dentists>;
export type Procedure = InferSelectModel<typeof procedures>;
export type Patient = InferSelectModel<typeof patients>;
export type Appointment = InferSelectModel<typeof appointments>;
export type Conversation = InferSelectModel<typeof conversations>;
export type Message = InferSelectModel<typeof messages>;

// Enums como union de strings
export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number];
```

> Nota para o implementador: confirmar os caminhos de import de cada tabela em `src/lib/db/schema/` (os nomes de arquivo são `core.ts`, `appointments.ts`, `conversations.ts`, `enums.ts`). Se alguma tabela estiver em outro arquivo, ajustar o `from`.

- [ ] **Step 2: Verificar que o módulo compila**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/types.ts
git commit -m "feat: tipos de dominio inferidos do schema Drizzle"
```

---

### Task 7: Migrar os 7 imports type-only para os tipos Drizzle

**Contexto:** Os consumidores importam `AppointmentStatus`, `Patient` e/ou `Appointment` de `@/lib/supabase/database.types`. Trocar a origem para `@/lib/db/types`. **Atenção ao snake_case → camelCase:** o tipo antigo (Supabase) era snake_case (`clinic_id`, `birth_date`), o tipo Drizzle é camelCase (`clinicId`, `birthDate`). Onde o componente acessar propriedades snake_case de `Patient`/`Appointment`, o `tsc` apontará — ajustar para camelCase guiado pela tabela abaixo.

**Tabela de mapeamento (colunas comuns):**
`clinic_id→clinicId`, `birth_date→birthDate`, `last_visit_at→lastVisitAt`, `risk_score→riskScore`, `created_at→createdAt`, `updated_at→updatedAt`, `deleted_at→deletedAt`, `avatar_url→avatarUrl`, `is_active→isActive`, `starts_at→startsAt`, `ends_at→endsAt`, `patient_id→patientId`, `dentist_id→dentistId`, `procedure_id→procedureId`.

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

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: tipos de dominio vem do Drizzle, nao do bridge Supabase"
```

---

### Task 8: Remover env vars do Supabase

**Files (todos Modify):**
- `src/lib/env.ts`, `jest.setup.ts`, `src/app/dashboard/layout.tsx`, `src/app/api/health/route.ts`

- [ ] **Step 1: `src/lib/env.ts` — remover as 3 entradas SUPABASE**

Remover do schema (linhas ~21–23) e dos blocos de leitura (linhas ~81–83 e ~131–133) as três chaves: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, e o comentário "Supabase (CUTOVER COMPLETE …)".

- [ ] **Step 2: `jest.setup.ts` — remover as 3 linhas de mock**

Remover:
```ts
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
```

- [ ] **Step 3: `src/app/dashboard/layout.tsx` — trocar a condição `isDevBypass`**

Substituir (linhas 9–11):
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

- [ ] **Step 4: `src/app/api/health/route.ts` — remover o report das 3 vars SUPABASE** (linhas ~27–29).

- [ ] **Step 5: Verificar tsc**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove env vars do Supabase do codigo"
```

---

### Task 9: Deletar o bridge e as migrations legadas

**Files (Delete):**
- `src/lib/supabase/` (diretório inteiro: `client.ts`, `server.ts`, `admin.ts`, `typed.ts`, `index.ts`, `database.types.ts`, `graphify-out/`)
- `src/lib/supabase.ts`
- `supabase/` (raiz: `config.toml`, `config.toml.bak`, 24 migrations legadas)
- `docs/MCP_SUPABASE_SETUP.md`, `docs/supabase-setup.md`

- [ ] **Step 1: Reconfirmar que nada importa mais o bridge**

Run: `grep -rn "lib/supabase" src --include="*.ts" --include="*.tsx" | grep -v graphify | grep -v "src/lib/supabase/"`
Expected: nenhuma saída (após Tasks 5–7, não deve restar import externo).
> Se houver saída: é um consumidor de teste (ex.: `supabase-bridge.test.ts`, `multi-agent.integration.test.ts`). Esses testes testam o próprio bridge — deletá-los junto, pois o bridge deixa de existir.

- [ ] **Step 2: Deletar bridge, migrations legadas e docs mortas**

Run:
```bash
rm -rf src/lib/supabase src/lib/supabase.ts supabase
rm -f docs/MCP_SUPABASE_SETUP.md docs/supabase-setup.md
rm -f src/lib/__tests__/supabase-bridge.test.ts
```

- [ ] **Step 3: Remover testes que dependiam exclusivamente do bridge (se houver)**

Run: `grep -rln "lib/supabase" src --include="*.test.ts" --include="*.test.tsx" | grep -v graphify`
Para cada arquivo retornado, avaliar: se o teste existe só para o bridge, deletar; senão, migrar o import para `@/lib/db/types` ou repos. Registrar a decisão no commit.

- [ ] **Step 4: Verificação de tipos completa**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: deleta bridge Supabase, migrations legadas e docs mortas"
```

---

### Task 10: Verificação final do baseline

- [ ] **Step 1: Zero referências a Supabase no código-fonte**

Run: `grep -rniE "supabase" src --include="*.ts" --include="*.tsx" | grep -v graphify | wc -l`
Expected: `0` (ou apenas comentários históricos intencionais — revisar caso a caso).

- [ ] **Step 2: Typecheck verde**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Suíte de testes**

Run: `npm test 2>&1 | tail -15`
Expected: todas as suítes passam (descontando as deletadas na Task 9). Nenhuma falha nova.

- [ ] **Step 4: Build de produção**

Run: `npm run build 2>&1 | tail -20`
Expected: build conclui sem erro de tipo/lint relacionado a Supabase ou tipos migrados.

- [ ] **Step 5: Commit final (se houve ajuste)**

```bash
git add -A
git commit -m "chore: baseline verde apos remocao do Supabase (W0+W1)"
```

---

## Self-Review

**Spec coverage (vs. roadmap-mestre §8 W0/W1):**
- W0 graphify-out → Task 1 ✓ | jest-dom/tsc → Task 2 ✓ | arquivos soltos → Task 3 ✓ | docs CLAUDE/AGENTS → Task 4 ✓
- W1 9 consumidores do bridge → Tasks 5 (runtime órfão) + 7 (type-only) ✓ | `database.types` → Tasks 6+7 ✓ | deletar `src/lib/supabase/`+`supabase.ts`+`supabase/` → Task 9 ✓ | env vars → Task 8 ✓

**Placeholder scan:** sem "TBD/TODO". Os dois pontos guiados-por-compilador (Task 7 snake→camel; Task 9 Step 3 testes do bridge) têm regra determinística + comando de verificação, não placeholder.

**Type consistency:** `AppointmentStatus`, `Patient`, `Appointment` definidos na Task 6 (`src/lib/db/types.ts`) e consumidos com o mesmo nome na Task 7. `appointmentStatus.enumValues` corresponde ao enum confirmado em `enums.ts`.

**Nota de risco:** se a Task 6 revelar que alguma tabela (`messages`/`conversations`) está em arquivo de schema diferente do assumido, ajustar os imports — o Step 2 da Task 6 valida via `tsc`.
