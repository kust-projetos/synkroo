# Supabase to PostgreSQL Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remover o Supabase do fluxo de desenvolvimento do Synkroo e substituir por `pgvector/pgvector` + Drizzle + Auth.js Credentials, preservando o contrato atual de autenticação do frontend durante o cutover.

**Architecture:** executar por fatias coesas. Primeiro infraestrutura local e schema; depois auth/session; depois autorização e acesso a dados por domínio; por fim reimplementar comportamentos SQL críticos e remover o legado Supabase.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, PostgreSQL with pgvector, Drizzle, Auth.js, Jest, Playwright.

**Agent Orchestration:** Supervisor-Workers — planner define ordem e contratos, worker1 implementa por tarefa/fase, reviewer valida cada fatia antes do próximo corte.

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

---

## Scope / Non-Goals

- Este plano cobre **cutover de desenvolvimento**.
- Migração de dados de produção do projeto Supabase atual fica para um plano separado.
- Não fazer redesign de produto.
- Não manter auth Supabase em paralelo por longo período.
- Não introduzir novos usos de `@supabase/*`.

## File Structure / Workstream Map

### Workstream 1 — Infra local
- Create: `docker-compose.yml`
- Create: `drizzle.config.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/schema/`
- Create: `src/lib/db/migrations/`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/lib/env.ts`
- Modify or replace: `scripts/setup-db.js`
- Modify or replace: `scripts/seed-database.ts`

### Workstream 2 — Auth/session
- Create: `src/lib/auth/auth.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/permissions.ts`
- Create: `src/lib/db/schema/user-credentials.ts` or equivalent consolidated schema file
- Modify: `src/middleware.ts`
- Modify: `src/lib/auth/context.tsx`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/session/route.ts`
- Modify: `src/app/api/auth/signup/route.ts`
- Retire: `src/lib/supabase/server.ts`

### Workstream 3 — Authorization helpers
- Create: `src/services/auth/`
- Modify callers currently using `getUserProfile`, `validateApiAuth`, `validateClinicAccess`, `requireRole`

### Workstream 4 — Data access replacement
- Create: `src/repositories/users/`
- Create: `src/repositories/clinics/`
- Create: `src/repositories/appointments/`
- Create: `src/repositories/patients/`
- Create: `src/repositories/conversations/`
- Create: `src/repositories/leads/`
- Create: `src/repositories/campaigns/`
- Retire and replace:
  - `src/lib/supabase.ts`
  - `src/lib/supabase/client.ts`
  - `src/lib/supabase/typed.ts`
  - `src/lib/supabase/admin.ts`

### Workstream 5 — Tests / cleanup
- Modify: `src/__tests__/api/auth/*`
- Modify: `src/__tests__/whatsapp*`
- Modify: `src/__tests__/agent.service.test.ts`
- Remove Supabase deps/scripts/env/docs after replacement is verified

---

### Task 1: Freeze new Supabase usage and capture baseline

**Files:**
- Modify: none

- [ ] **Step 1: Capture current Supabase dependency baseline**

Run: `rg -n "@supabase|supabase\.auth|supabase\.from|\.rpc\(" src package.json .env.example scripts supabase`
Expected: a durable list of hotspots exists for migration tracking.

- [ ] **Step 2: Capture current validation baseline**

Run: `npm test -- --runInBand`
Run: `npm run build`
Expected: current failures or passes are known before cutover starts.

- [ ] **Step 3: Add a migration rule to the execution notes**

Implementation rule:
- no new runtime import of `@supabase/*`
- no new call to `supabase.from()` or `.rpc()`
- any touched file must move toward repository/auth helper usage

Verification: `rg -n "@supabase|supabase\.from|\.rpc\(" src`
Expected: count does not increase during implementation.

---

### Task 2: Build dev database infra with pgvector and Drizzle

**Files:**
- Create: `docker-compose.yml`
- Create: `drizzle.config.ts`
- Create: `src/lib/db/client.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/lib/env.ts`
- Modify: `scripts/setup-db.js`

- [ ] **Step 1: Create Docker Compose for local PostgreSQL with vector**

Implementation target:
- one DB service using `pgvector/pgvector`
- persistent volume
- exposed port
- healthcheck
- env-driven database name/user/password

Verification:
Run: `docker compose up -d`
Run: `docker compose ps`
Expected: DB service is healthy.

- [ ] **Step 2: Add Drizzle configuration and runtime DB client**

Implementation target:
- `drizzle.config.ts` points to the project schema/migrations directory
- `src/lib/db/client.ts` exports a shared DB handle for server-side use
- no Supabase client dependency remains in the DB bootstrap path

Verification:
Run: `npx drizzle-kit generate`
Expected: Drizzle config resolves without missing env/schema errors.

- [ ] **Step 3: Replace Supabase-centric env and package scripts**

Implementation target:
- remove `db:types`, `db:push`, `db:pull`, `db:reset`, `db:seed`, `supabase:start`, `supabase:stop`
- add scripts such as `db:up`, `db:down`, `db:migrate`, `db:reset`, `db:seed`, `db:health`
- replace Supabase env vars in `.env.example` and `src/lib/env.ts` with Postgres/Auth.js equivalents

Verification:
Run: `npm run db:health`
Expected: local DB connectivity passes without Supabase CLI.

---

### Task 3: Port schema and preserve Postgres-native features

**Files:**
- Create: `src/lib/db/schema/*`
- Create: `src/lib/db/migrations/*`
- Inspect/port: `supabase/migrations/*.sql`

- [ ] **Step 1: Inventory and classify existing Supabase migrations**

Implementation target:
- classify each SQL file as keep/adapt/remove/reimplement
- preserve tables, indexes, constraints, triggers, and `pgvector`
- flag RLS policies, auth-specific SQL, and service-role assumptions for removal/rewrite

Verification:
Run: `find supabase/migrations -maxdepth 1 -type f | wc -l`
Expected: every migration file is accounted for in the classification notes.

- [ ] **Step 2: Recreate schema in Drizzle/portable SQL**

Implementation target:
- define core domain tables in Drizzle schema
- keep `users` as profile/domain table
- add `user_credentials` table for password hashes
- ensure `vector` columns/extensions used by current features remain available

Verification:
Run: `npm run db:migrate`
Expected: local DB creates schema successfully.

- [ ] **Step 3: Rebuild seed flow for the new stack**

Implementation target:
- `scripts/seed-database.ts` uses the new DB layer, not Supabase admin APIs
- seed creates clinic, users, credentials, dentists, procedures, patients, schedule blocks, and appointments

Verification:
Run: `npm run db:seed`
Expected: seed completes against the local Postgres container.

---

### Task 4: Cut over auth to Auth.js Credentials

**Files:**
- Create: `src/lib/auth/auth.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/permissions.ts`
- Modify: `src/middleware.ts`
- Retire/replace: `src/lib/supabase/server.ts`

- [ ] **Step 1: Implement password hashing and credential lookup**

Implementation target:
- `password.ts` encapsulates hash/verify
- credentials lookup reads `user_credentials` joined to `users`
- disabled users (`is_active = false`) cannot authenticate

Verification:
Run: `npm test -- --runInBand src/__tests__/api/auth`
Expected: auth tests can be adapted to credential-based login semantics.

- [ ] **Step 2: Configure Auth.js Credentials provider**

Implementation target:
- Auth.js validates email/password against `user_credentials`
- successful login resolves a session payload that includes user id, clinic id, role, and active status as needed by server helpers
- no Supabase auth calls remain in the auth path

Verification:
Run: `npm run build`
Expected: Auth.js configuration compiles cleanly.

- [ ] **Step 3: Replace middleware enforcement**

Implementation target:
- `src/middleware.ts` checks Auth.js session instead of Supabase cookie state
- public route allowlist remains explicit
- protected route redirect behavior is preserved

Verification:
Run: `npm run build`
Expected: middleware compiles and protected routes still enforce login.

---

### Task 5: Preserve the frontend auth contract with thin wrappers

**Files:**
- Modify: `src/lib/auth/context.tsx`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/session/route.ts`
- Modify: `src/app/api/auth/signup/route.ts`

- [ ] **Step 1: Keep `/api/auth/login|logout|session|signup` stable**

Implementation target:
- existing route shapes remain callable by `src/lib/auth/context.tsx`
- internals delegate to Auth.js + repositories/services
- remove any direct use of `supabase.auth.*` or Supabase profile fetches

Verification:
Run: `npm test -- --runInBand src/__tests__/api/auth`
Expected: route tests pass with the same client-facing contract.

- [ ] **Step 2: Remove Supabase auth listener from the React context**

Implementation target:
- `src/lib/auth/context.tsx` no longer imports `@supabase/supabase-js` or `@/lib/supabase`
- auth state refresh is driven by session endpoints/router refresh, not `onAuthStateChange`

Verification:
Run: `rg -n "onAuthStateChange|@supabase/supabase-js|@/lib/supabase" src/lib/auth/context.tsx`
Expected: no matches.

---

### Task 6: Build application-level authorization helpers

**Files:**
- Create/modify: `src/lib/auth/permissions.ts`
- Create/modify: `src/lib/auth/session.ts`
- Modify callers currently depending on Supabase auth helper behavior

- [ ] **Step 1: Implement explicit auth helpers**

Implementation target:
- `requireAuth()`
- `requireRole()`
- `requireClinicAccess()`
- role check helper used consistently in routes/services

Verification:
Run: `rg -n "validateApiAuth|validateClinicAccess|getUserProfile|requireRole" src`
Expected: legacy helper usage is being replaced by the new auth layer.

- [ ] **Step 2: Apply authorization to the hot paths first**

Implementation target:
- auth routes, dashboard-protected routes, and any service touching clinic-scoped data validate user/clinic/role explicitly

Verification:
Run: `npm run build`
Expected: no route remains coupled to Supabase auth helpers.

---

### Task 7: Migrate data access by domain

**Files:**
- Create: repositories under `src/repositories/*`
- Modify domain services/routes to consume repositories
- Retire: `src/lib/supabase.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/typed.ts`

- [ ] **Step 1: Migrate auth/users/clinics first**

Implementation target:
- repositories for user profile lookup, clinic lookup, signup persistence
- auth wrappers use repositories only

Verification:
Run: `npm test -- --runInBand src/__tests__/api/auth`
Expected: auth/profile flows no longer need Supabase mocks.

- [ ] **Step 2: Migrate appointments/dentists/procedures**

Implementation target:
- scheduling-related services use Drizzle repositories
- no `supabase.from()` remains in those domains

Verification:
Run: `rg -n "supabase\.from|@/lib/supabase" src/app src/services src/components | head -n 200`
Expected: appointment domain references are gone.

- [ ] **Step 3: Migrate patients**

Implementation target:
- patient CRUD and clinic scoping move to repositories/services

Verification:
Run: `npm test -- --runInBand`
Expected: patient-related tests remain green.

- [ ] **Step 4: Migrate conversations/messages**

Implementation target:
- conversation and message flows stop depending on Supabase admin/service-role patterns
- repositories own transactions and joins

Verification:
Run: `npm test -- --runInBand src/__tests__/whatsapp*`
Expected: messaging tests pass with new seams.

- [ ] **Step 5: Migrate leads/campaigns and remaining domains**

Implementation target:
- remaining CRUD/reporting modules use repositories/services

Verification:
Run: `npm run build`
Expected: runtime code no longer depends on general-purpose Supabase clients.

---

### Task 8: Reimplement the RPC-backed behaviors explicitly

**Files:**
- Replace logic from: `src/lib/supabase/admin.ts`
- Create or modify: `src/repositories/conversations/*`
- Create or modify: `src/services/conversations/*`
- Create or modify: `src/services/scheduling/*`

- [ ] **Step 1: Reimplement `getOrCreateConversation()`**

Implementation target:
- transactional lookup/create semantics preserved
- unique conversation identity by clinic/channel/external id stays intact

Verification:
Run: `npm test -- --runInBand`
Expected: conversation creation behavior remains stable.

- [ ] **Step 2: Reimplement `getConversationContext()` and `getPatientInsights()`**

Implementation target:
- SQL/query behavior is preserved through repository methods
- service contracts remain stable for AI/messaging layers

Verification:
Run: `npm test -- --runInBand src/__tests__/agent.service.test.ts`
Expected: agent-service expectations still pass or are updated to the new seam.

- [ ] **Step 3: Reimplement `getAvailableSlots()`**

Implementation target:
- scheduling query reproduces availability logic faithfully
- no dependency on Supabase RPC remains

Verification:
Run: `npm test -- --runInBand`
Expected: scheduling-related tests stay green.

---

### Task 9: Remove Supabase runtime dependencies and docs/scripts

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Remove/replace: `src/lib/supabase.ts`
- Remove/replace: `src/lib/supabase/`
- Remove/replace: `supabase/` if fully obsolete after migration
- Update docs under `docs/`

- [ ] **Step 1: Remove package dependencies and dead code**

Implementation target:
- uninstall `@supabase/ssr` and `@supabase/supabase-js`
- remove dead helpers, scripts, and obsolete setup docs

Verification:
Run: `npm install`
Run: `rg -n "@supabase|supabase" src package.json docs scripts .env.example`
Expected: only intentional historical docs, if any, still mention Supabase.

- [ ] **Step 2: Run final validation**

Run: `npm test -- --runInBand`
Run: `npm run build`
Run: `rg -n "@supabase|supabase\.from|\.rpc\(" src package.json .env.example scripts`
Expected: tests pass, build passes, runtime code is Supabase-free.

---

## Self-Review

- Spec coverage: infra, schema, auth, authorization, repositories, RPC replacements, tests, cleanup all mapped to tasks.
- Placeholder scan: no Prisma branch, no parallel auth plan, no TODO/TBD markers.
- Type consistency: `users` remains the profile table, `user_credentials` stores password hash, and `pgvector` stays in the target stack.
