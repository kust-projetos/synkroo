# Supabase → PostgreSQL Cutover Design

**Status:** approved for planning  
**Scope:** development cutover first; production data migration from the current Supabase project is a follow-up track, not part of this first execution plan.

## Goal

Remove Supabase completely from Synkroo and replace it with:

- `pgvector/pgvector` in Docker Compose for local development
- Drizzle for schema, migrations, and typed SQL access
- Auth.js with Credentials provider for login/session
- application-level authorization in services/repositories
- a repository/service-based data access layer in place of `supabase.from()` and Supabase RPCs

## Non-Goals

- no product redesign
- no broad UX rewrite
- no unrelated refactors
- no production data migration from Supabase in this first slice
- no parallel long-lived auth systems; auth cutover is a cohesive early slice

## Locked Stack

- **Database image:** `pgvector/pgvector` (or equivalent PostgreSQL image with `vector` extension available)
- **Database access:** Drizzle
- **Auth:** Auth.js with Credentials provider
- **Session:** Auth.js-managed cookie/JWT session
- **Password storage:** separate `user_credentials` table with password hash
- **Domain profile table:** keep `users` as the profile/domain table (`clinic_id`, `role`, `is_active`, etc.)

## Current Hotspots

### Auth / session

- `src/middleware.ts`
- `src/lib/auth/context.tsx`
- `src/app/api/auth/*`
- `src/lib/supabase/server.ts`

### Data access

- `src/lib/supabase.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/typed.ts`
- `src/lib/supabase/admin.ts`
- all imports of `@/lib/supabase*`

### Infra / schema / environment

- `package.json:14-21`
- `.env.example`
- `src/lib/env.ts`
- `scripts/setup-db.js`
- `scripts/seed-database.ts`
- `supabase/migrations/*.sql`

### Tests impacted

- `src/__tests__/api/auth/*`
- `src/__tests__/whatsapp*`
- `src/__tests__/agent.service.test.ts`

## Target Architecture

```txt
src/
  lib/
    auth/
      auth.ts
      session.ts
      permissions.ts
      password.ts
    db/
      client.ts
      schema/
      migrations/
      queries/
  repositories/
    users/
    clinics/
    conversations/
    patients/
    appointments/
    leads/
    campaigns/
  services/
    auth/
    conversations/
    scheduling/
    leads/
    patients/
```

## Architecture Rules

1. routes do not call Drizzle directly unless they are tiny auth wrappers
2. repositories own SQL/data access
3. services own business rules and authorization checks
4. authorization for `clinic_id`, `role`, and `is_active` moves out of RLS and into application code
5. keep Postgres-native features like `pgvector`
6. remove only Supabase-specific parts: Auth, RLS policies, Supabase CLI, service-role semantics, Supabase client APIs

## Auth Target Design

### Current state

Frontend auth state depends on these API routes:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/session`
- `/api/auth/signup`

`src/lib/auth/context.tsx` expects that contract and also listens to Supabase auth state today.

### Target state

- Auth.js Credentials provider handles sign-in
- Auth.js owns cookie/JWT session lifecycle
- `src/middleware.ts` becomes Auth.js session enforcement
- `src/lib/auth/context.tsx` stops using `supabase.auth.onAuthStateChange`
- `/api/auth/login|logout|session|signup` remain temporarily as thin wrappers over Auth.js + Drizzle to avoid a full frontend rewrite during the cutover

### Data model

- `users`
  - remains the profile/domain table
  - stores `id`, `clinic_id`, `email`, `name`, `role`, `is_active`, etc.
- `user_credentials`
  - stores `user_id`, `password_hash`, auth metadata
  - avoids mixing credential concerns into the domain profile table

## Data Access Target Design

### Current state

The app uses multiple Supabase entry points:

- browser client
- SSR client
- admin/service-role client
- typed helper wrapper
- RPC-backed helper functions

### Target state

- a single shared Drizzle client layer under `src/lib/db`
- repositories grouped by domain
- services calling repositories instead of `supabase.from()` or `.rpc()`
- test seams move from mocking Supabase chains to mocking repositories/auth helpers

## Supabase-Specific SQL / RPC To Re-Home

From `src/lib/supabase/admin.ts`, the following behaviors must be preserved explicitly:

- `getOrCreateConversation()`
- `getConversationContext()`
- `getPatientInsights()`
- `getAvailableSlots()`

These become:

- dedicated SQL queries or transactional repository methods
- service methods with the same business contract
- characterization tests to preserve behavior

## Schema / Migration Strategy

1. inventory `supabase/migrations/*.sql`
2. classify each migration as:
   - keep
   - adapt
   - remove
   - reimplement
3. preserve:
   - tables
   - indexes
   - constraints
   - triggers/functions that are pure PostgreSQL and still needed
   - `pgvector`
4. remove/adapt:
   - RLS policies
   - Supabase auth assumptions
   - service-role specific behavior
   - Supabase CLI-only constructs

## Authorization Strategy

Because RLS is going away, the app must enforce access explicitly.

### Required checks

- authenticated user exists
- user is active
- user belongs to the requested `clinic_id`
- user role is sufficient for the action

### Expected helpers

- `requireAuth()`
- `requireRole()`
- `requireClinicAccess()`
- `hasRequiredRole()` or equivalent permission helper

## Migration Phases

1. preparation and freeze new Supabase usage
2. dev DB infra with `pgvector/pgvector` + Drizzle
3. schema port from `supabase/migrations/*.sql`
4. Auth.js Credentials cutover
5. application-level authorization helpers
6. domain-by-domain data access migration
7. re-home RPC-backed behaviors
8. update seed/tests/docs
9. remove Supabase dependencies and dead code

## Risks

### Highest risk

- auth/session cutover
- authorization bugs after RLS removal
- hidden business logic inside current SQL/RPC helpers
- test failures caused by changed seams, not changed behavior

### Mitigations

- auth cutover early as a cohesive slice
- keep frontend auth API contract temporarily stable
- write characterization tests for RPC-backed behaviors
- validate `clinic_id`/role scoping in service-level tests
- migrate domain by domain, not file by file at random

## Acceptance Criteria

The cutover is complete when:

- `@supabase/*` is absent from runtime code and package dependencies
- Supabase env vars are removed from `.env.example` and `src/lib/env.ts`
- local development DB runs via Docker Compose with `vector` available
- Drizzle migrations and seed run without Supabase CLI
- Auth.js Credentials login/session works for SSR-protected routes
- `/api/auth/login|logout|session|signup` still satisfy frontend callers during the compatibility phase
- `clinic_id`, `role`, and `is_active` checks are enforced in application code
- the four Supabase RPC-backed behaviors are reimplemented and tested
- critical Jest suites and build pass on the new stack

## Rollback Notes

- before removing Supabase code, each migrated slice should be verified independently
- keep old Supabase code only until its replacement is validated; then remove it to avoid dual-path drift
- production data migration is out of scope for this first plan and must get a separate cutover/rollback design later
