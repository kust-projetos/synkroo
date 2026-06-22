# Eixo 2 Core Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materializar o módulo Core como referência canônica do Eixo 2, fechando lacunas reais de RBAC/admin/menu/gates/schema sem migrar módulos futuros antes da hora.

**Architecture:** Implementar fluxo `action → service → repository → Drizzle` no Core. Manter Action Layer como entrada única para UI/agente, com invariantes no service e queries no repository. Registrar explicitamente refinamentos do sequenciamento para gates/menu, deixando rollout real aos módulos donos.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Jest unit/integration, ESLint boundaries.

**Agent Orchestration:** Single-Agent Looped — tarefas sequenciais e acopladas; cada tarefa fecha teste→implementação→verificação antes da próxima.

---

## File Structure

| Path | Role |
|---|---|
| `src/modules/core/repositories/users-repository.ts` | Listar/desativar usuários da clínica |
| `src/modules/core/repositories/roles-repository.ts` | Listar/criar roles e permissões |
| `src/modules/core/repositories/access-repository.ts` | Ler/escrever/remover `userClinicAccess` |
| `src/modules/core/repositories/modules-repository.ts` | Upsert de contrato de módulo |
| `src/modules/core/services/access-service.ts` | `assign/remove/deactivate/list` + `assertOwnerInvariant` |
| `src/modules/core/services/roles-service.ts` | `createRole/listClinicRoles` |
| `src/modules/core/services/modules-service.ts` | `setModuleContract` |
| `src/modules/core/actions/*.ts` | Delegar para services, sem `getDb()` |
| `src/modules/core/actions/list-clinic-users.ts` | Read-action admin de usuários |
| `src/modules/core/actions/list-clinic-roles.ts` | Read-action admin de perfis |
| `src/modules/core/actions/remove-user-access.ts` | Remoção com anti-lockout |
| `src/modules/core/actions/deactivate-user.ts` | Desativação com anti-lockout |
| `src/modules/core/ui/UserAccessForm.tsx` | Selects reais para concessão de acesso |
| `src/modules/core/ui/ClinicUsersTable.tsx` | Lista usuários, perfil atual, status e ações remover/desativar |
| `src/modules/core/ui/actions.ts` | Server actions wrappers para novas Actions |
| `src/app/dashboard/configuracoes/acessos/page.tsx` | Carregar listas reais e passar para UI |
| `src/app/dashboard/configuracoes/acessos/perfis/page.tsx` | Exibir perfis reais após criação |
| `src/app/dashboard/contatos/page.tsx` | Bloquear acesso direto com `notFound()` |
| `src/modules/core/schema/rbac.ts` | Novo ownership físico do schema RBAC |
| `src/modules/core/schema/index.ts` | Seam público de schema Core |
| `src/lib/db/schema/index.ts` | Re-exportar RBAC novo para Drizzle |
| `src/core/rbac/*`, `scripts/migrate-userrole-to-rbac.ts` | Atualizar imports RBAC |
| `src/core/modules/__tests__/gates.test.ts` | Expandir cobertura de gates |
| `docs/superpowers/plans/2026-06-21-eixo2-core-modulo-refinements.md` | Registrar refinamento gates/menu vs sequenciamento |
| `.eslintrc.json` | `boundaries/dependencies`: `warn` → `error` |

---

## Task 1 — A1: Core repositories/services + action delegation

**Files:**
- Create: `src/modules/core/repositories/users-repository.ts`
- Create: `src/modules/core/repositories/roles-repository.ts`
- Create: `src/modules/core/repositories/access-repository.ts`
- Create: `src/modules/core/repositories/modules-repository.ts`
- Create: `src/modules/core/services/roles-service.ts`
- Create: `src/modules/core/services/modules-service.ts`
- Modify: `src/modules/core/actions/create-role.ts`
- Modify: `src/modules/core/actions/set-module-contract.ts`
- Test: `src/modules/core/actions/__tests__/integration.test.ts`

- [ ] **Step 1: Add failing integration coverage for service delegation side effects**

Append to `src/modules/core/actions/__tests__/integration.test.ts`:

```ts
import { createRole } from '../create-role';
import { setModuleContract } from '../set-module-contract';
import { rolePermissions } from '@/lib/db/schema/rbac';
import { instanceModules } from '@/lib/db/schema/modules';

// inside describeOrSkip file scope

describeOrSkip('Core actions — service/repository flow (DB real)', () => {
  it('createRole creates role and permissions via action layer', async () => {
    const name = `Plano Teste ${Date.now()}`;
    const result = await runAction(createRole, {
      clinicId: CLINIC,
      name,
      description: 'Perfil criado pelo teste',
      permissionKeys: ['core:manage_users'],
    }, adminCtx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [role] = await getDb().select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.id, result.data.id))
      .limit(1);
    expect(role.name).toBe(name);

    const perms = await getDb().select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, result.data.id));
    expect(perms.map((p) => p.key)).toEqual(['core:manage_users']);
  });

  it('setModuleContract upserts module contract via action layer', async () => {
    const moduleId = `test-module-${Date.now()}`;
    const result = await runAction(setModuleContract, { moduleId, enabled: true }, adminCtx);

    expect(result.ok).toBe(true);

    const [row] = await getDb().select({ moduleId: instanceModules.moduleId, enabled: instanceModules.enabled })
      .from(instanceModules)
      .where(eq(instanceModules.moduleId, moduleId))
      .limit(1);
    expect(row).toEqual({ moduleId, enabled: true });
  });
});
```

- [ ] **Step 2: Run tests; verify failure or compile errors from missing imports/service split**

Run:

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
```

Expected: existing tests may pass before refactor; new tests must pass functionally. If command filters poorly, run full `npm run test:integration`.

- [ ] **Step 3: Create repositories**

Create `src/modules/core/repositories/roles-repository.ts`:

```ts
import { getDb } from '@/lib/db/client';
import { roles, rolePermissions } from '@/lib/db/schema/rbac';
import { eq, and } from 'drizzle-orm';

export interface ClinicRoleOption {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export async function createClinicRole(input: {
  clinicId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  const db = getDb();
  const [row] = await db.insert(roles)
    .values({ clinicId: input.clinicId, name: input.name, description: input.description, isSystem: false })
    .returning({ id: roles.id });

  if (input.permissionKeys.length) {
    await db.insert(rolePermissions).values(
      input.permissionKeys.map((permissionKey) => ({ roleId: row.id, permissionKey })),
    );
  }

  return { id: row.id };
}

export async function listClinicRoles(clinicId: string): Promise<ClinicRoleOption[]> {
  return getDb().select({
    id: roles.id,
    name: roles.name,
    description: roles.description,
    isSystem: roles.isSystem,
  }).from(roles).where(eq(roles.clinicId, clinicId));
}

export async function getOwnerRole(clinicId: string, ownerName: string) {
  const [row] = await getDb().select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, clinicId), eq(roles.name, ownerName), eq(roles.isSystem, true)))
    .limit(1);
  return row ?? null;
}
```

Create `src/modules/core/repositories/access-repository.ts`:

```ts
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { userClinicAccess } from '@/lib/db/schema/rbac';
import { and, eq } from 'drizzle-orm';

export async function getUserClinicAccess(userId: string, clinicId: string) {
  const [row] = await getDb().select({ roleId: userClinicAccess.roleId })
    .from(userClinicAccess)
    .where(and(eq(userClinicAccess.userId, userId), eq(userClinicAccess.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}

export async function countActiveUsersWithRole(clinicId: string, roleId: string): Promise<number> {
  const rows = await getDb().select({ userId: userClinicAccess.userId })
    .from(userClinicAccess)
    .innerJoin(users, eq(users.id, userClinicAccess.userId))
    .where(and(
      eq(userClinicAccess.clinicId, clinicId),
      eq(userClinicAccess.roleId, roleId),
      eq(users.isActive, true),
    ));
  return rows.length;
}

export async function upsertUserAccess(input: { userId: string; clinicId: string; roleId: string }) {
  await getDb().insert(userClinicAccess)
    .values(input)
    .onConflictDoUpdate({
      target: [userClinicAccess.userId, userClinicAccess.clinicId],
      set: { roleId: input.roleId },
    });
}

export async function removeUserAccess(userId: string, clinicId: string) {
  await getDb().delete(userClinicAccess)
    .where(and(eq(userClinicAccess.userId, userId), eq(userClinicAccess.clinicId, clinicId)));
}
```

Create `src/modules/core/repositories/users-repository.ts`:

```ts
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { roles, userClinicAccess } from '@/lib/db/schema/rbac';
import { and, eq } from 'drizzle-orm';

export interface ClinicUserOption {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
}

export async function listClinicUsers(clinicId: string): Promise<ClinicUserOption[]> {
  return getDb().select({
    id: users.id,
    name: users.name,
    email: users.email,
    isActive: users.isActive,
    roleId: userClinicAccess.roleId,
    roleName: roles.name,
  })
    .from(users)
    .leftJoin(userClinicAccess, and(eq(userClinicAccess.userId, users.id), eq(userClinicAccess.clinicId, clinicId)))
    .leftJoin(roles, eq(roles.id, userClinicAccess.roleId))
    .where(eq(users.clinicId, clinicId));
}

export async function deactivateUser(userId: string, clinicId: string) {
  await getDb().update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.clinicId, clinicId)));
}
```

Create `src/modules/core/repositories/modules-repository.ts`:

```ts
import { getDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';

export async function setModuleContract(input: { moduleId: string; enabled: boolean }) {
  await getDb().insert(instanceModules)
    .values({ moduleId: input.moduleId, enabled: input.enabled, contractedAt: new Date() })
    .onConflictDoUpdate({
      target: instanceModules.moduleId,
      set: { enabled: input.enabled, updatedAt: new Date() },
    });
}
```

- [ ] **Step 4: Create services**

Create `src/modules/core/services/roles-service.ts`:

```ts
import * as rolesRepo from '../repositories/roles-repository';

export async function createRole(input: {
  clinicId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  return rolesRepo.createClinicRole(input);
}

export async function listClinicRoles(clinicId: string) {
  return rolesRepo.listClinicRoles(clinicId);
}
```

Create `src/modules/core/services/modules-service.ts`:

```ts
import * as modulesRepo from '../repositories/modules-repository';

export async function setModuleContract(input: { moduleId: string; enabled: boolean }) {
  await modulesRepo.setModuleContract(input);
  return { ok: true };
}
```

- [ ] **Step 5: Refactor actions to delegate**

Replace handler in `src/modules/core/actions/create-role.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as rolesService from '../services/roles-service';

export const createRole = defineAction({
  name: 'core.createRole',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Criar perfil de acesso',
  input: z.object({
    clinicId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()).default([]),
  }),
  handler: async (input) => rolesService.createRole(input),
});
```

Replace handler in `src/modules/core/actions/set-module-contract.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as modulesService from '../services/modules-service';

export const setModuleContract = defineAction({
  name: 'master.setModuleContract',
  module: 'core',
  requires: 'master:manage_modules',
  label: 'Contratar/desativar módulo (fornecedor)',
  input: z.object({ moduleId: z.string(), enabled: z.boolean() }),
  handler: async (input) => modulesService.setModuleContract(input),
});
```

- [ ] **Step 6: Verify no direct DB in refactored actions**

Run:

```bash
rg -n "getDb\(|@/lib/db/schema" src/modules/core/actions
```

Expected: only tests may import schema; action files should not show direct `getDb()` or schema imports.

- [ ] **Step 7: Run integration tests**

Run:

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/core/repositories src/modules/core/services src/modules/core/actions src/modules/core/actions/__tests__/integration.test.ts
git commit -m "refactor(core): add services and repositories"
```

---

## Task 2 — A2: Admin read-actions + selects instead of UUIDs

**Files:**
- Create: `src/modules/core/actions/list-clinic-users.ts`
- Create: `src/modules/core/actions/list-clinic-roles.ts`
- Modify: `src/modules/core/ui/actions.ts`
- Modify: `src/modules/core/ui/UserAccessForm.tsx`
- Modify: `src/app/dashboard/configuracoes/acessos/page.tsx`
- Modify: `src/app/dashboard/configuracoes/acessos/perfis/page.tsx`
- Test: `src/modules/core/actions/__tests__/integration.test.ts`

- [ ] **Step 1: Add failing tests for read-actions auth/RBAC and clinic scope**

Append imports:

```ts
import { listClinicUsers } from '../list-clinic-users';
import { listClinicRoles } from '../list-clinic-roles';
```

Append tests:

```ts
describeOrSkip('Core read-actions — admin lists (DB real)', () => {
  it('listClinicUsers returns users scoped to ctx.clinicId', async () => {
    const result = await runAction(listClinicUsers, {}, adminCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((u) => u.id === ownerUserId)).toBe(true);
    expect(result.data.every((u) => typeof u.email === 'string')).toBe(true);
  });

  it('listClinicRoles returns roles scoped to ctx.clinicId', async () => {
    const result = await runAction(listClinicRoles, {}, adminCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((r) => r.name === RESERVED_ROLE_OWNER)).toBe(true);
  });

  it('admin read-actions return forbidden without core:manage_users', async () => {
    const noPermCtx: ActionContext = { ...adminCtx, can: () => false };
    const usersResult = await runAction(listClinicUsers, {}, noPermCtx);
    const rolesResult = await runAction(listClinicRoles, {}, noPermCtx);
    expect(usersResult.ok).toBe(false);
    expect(rolesResult.ok).toBe(false);
    if (!usersResult.ok) expect(usersResult.error.code).toBe('forbidden');
    if (!rolesResult.ok) expect(rolesResult.error.code).toBe('forbidden');
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
```

Expected: FAIL with missing modules `../list-clinic-users` / `../list-clinic-roles`.

- [ ] **Step 3: Create read-actions**

Create `src/modules/core/actions/list-clinic-users.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const listClinicUsers = defineAction({
  name: 'core.listClinicUsers',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Listar usuários da clínica',
  input: z.object({}),
  handler: async (_input, ctx) => accessService.listClinicUsers(ctx.clinicId),
});
```

Create `src/modules/core/actions/list-clinic-roles.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as rolesService from '../services/roles-service';

export const listClinicRoles = defineAction({
  name: 'core.listClinicRoles',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Listar perfis da clínica',
  input: z.object({}),
  handler: async (_input, ctx) => rolesService.listClinicRoles(ctx.clinicId),
});
```

Add to `src/modules/core/services/access-service.ts`:

```ts
import * as usersRepo from '../repositories/users-repository';

export async function listClinicUsers(clinicId: string) {
  return usersRepo.listClinicUsers(clinicId);
}
```

If file does not exist yet from Task 3, create it now with only this function; Task 3 will extend it.

- [ ] **Step 4: Add server action wrappers**

Modify `src/modules/core/ui/actions.ts`:

```ts
'use server';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { assignUserAccess } from '../actions/assign-user-access';
import { createRole } from '../actions/create-role';
import { listClinicUsers } from '../actions/list-clinic-users';
import { listClinicRoles } from '../actions/list-clinic-roles';

export async function assignUserAccessAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(assignUserAccess, input, ctx);
}

export async function createRoleAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(createRole, input, ctx);
}

export async function listClinicUsersAction(activeClinicId: string) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(listClinicUsers, {}, ctx);
}

export async function listClinicRolesAction(activeClinicId: string) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(listClinicRoles, {}, ctx);
}
```

- [ ] **Step 5: Replace UUID inputs with selects**

Replace `src/modules/core/ui/UserAccessForm.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { assignUserAccessAction } from './actions';

interface UserOption { id: string; name: string | null; email: string; isActive: boolean; roleId: string | null; roleName: string | null; }
interface RoleOption { id: string; name: string; description: string | null; isSystem: boolean; }

interface Props {
  clinicId: string;
  users: UserOption[];
  roles: RoleOption[];
}

export function UserAccessForm({ clinicId, users, roles }: Props) {
  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const res = await assignUserAccessAction(clinicId, { userId, clinicId, roleId });
    if (res.ok) {
      setResult('Acesso concedido com sucesso.');
      setUserId('');
      setRoleId('');
    } else {
      setError(res.error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">Usuário</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" required>
          <option value="">Selecione um usuário</option>
          {users.map((user) => (
            <option key={user.id} value={user.id} disabled={!user.isActive}>
              {user.name || user.email} ({user.email}){user.isActive ? '' : ' — inativo'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Perfil</label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" required>
          <option value="">Selecione um perfil</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && <p className="text-green-600 text-sm">{result}</p>}
      <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700" disabled={!userId || !roleId}>
        Conceder acesso
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Load lists in pages**

Modify `src/app/dashboard/configuracoes/acessos/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions/context';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { UserAccessForm } from '@/modules/core/ui/UserAccessForm';
import { listClinicRolesAction, listClinicUsersAction } from '@/modules/core/ui/actions';

export const dynamic = 'force-dynamic';

export default async function AcessosPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();
  const [usersResult, rolesResult] = await Promise.all([
    listClinicUsersAction(ctx.clinicId),
    listClinicRolesAction(ctx.clinicId),
  ]);

  if (!usersResult.ok || !rolesResult.ok) redirect('/dashboard');

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Usuários e acessos</h1>
      <p className="text-gray-600 text-sm">Gerencie quem acessa sua clínica e quais permissões cada pessoa tem.</p>

      <section>
        <h2 className="text-lg font-semibold mb-3">Conceder acesso a um usuário</h2>
        <UserAccessForm clinicId={ctx.clinicId} users={usersResult.data} roles={rolesResult.data} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Perfis disponíveis</h2>
        <ul className="text-sm text-gray-600 list-disc pl-5">
          {rolesResult.data.map((role) => <li key={role.id}>{role.name}</li>)}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Permissões do sistema</h2>
        <p className="text-gray-500 text-sm mb-2">Abaixo estão as permissões que podem ser atribuídas a cada perfil, organizadas por módulo.</p>
        <div className="text-sm space-y-2">
          {groups.map((g) => (
            <div key={g.module} className="border rounded p-3">
              <p className="font-medium">{g.moduleLabel}</p>
              <ul className="list-disc pl-5 text-gray-600">
                {g.permissions.map((p) => <li key={p.key}>{p.label}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
```

Modify `src/app/dashboard/configuracoes/acessos/perfis/page.tsx` to remove TODO and list roles:

```tsx
import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions/context';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { RoleForm } from '@/modules/core/ui/RoleForm';
import { listClinicRolesAction } from '@/modules/core/ui/actions';

export const dynamic = 'force-dynamic';

export default async function PerfisPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();
  const rolesResult = await listClinicRolesAction(ctx.clinicId);
  if (!rolesResult.ok) redirect('/dashboard');

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Perfis de acesso</h1>
      <p className="text-gray-600 text-sm">Crie perfis com conjuntos de permissões e atribua a usuários da sua clínica.</p>

      <section>
        <h2 className="text-lg font-semibold mb-3">Criar novo perfil</h2>
        <RoleForm clinicId={ctx.clinicId} groups={groups} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Perfis existentes</h2>
        <ul className="text-sm text-gray-600 list-disc pl-5">
          {rolesResult.data.map((role) => <li key={role.id}>{role.name}</li>)}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Verify tests and typecheck**

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
npm run typecheck
```

Expected: PASS; `typecheck` 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/core/actions src/modules/core/services src/modules/core/ui src/app/dashboard/configuracoes/acessos
git commit -m "feat(core): replace access UUID inputs with selects"
```

---

## Task 3 — A3: Anti-lockout invariant across downgrade/remove/deactivate

**Files:**
- Modify: `src/modules/core/services/access-service.ts`
- Create: `src/modules/core/actions/remove-user-access.ts`
- Create: `src/modules/core/actions/deactivate-user.ts`
- Modify: `src/modules/core/actions/assign-user-access.ts`
- Modify: `src/modules/core/ui/actions.ts`
- Create: `src/modules/core/ui/ClinicUsersTable.tsx`
- Modify: `src/app/dashboard/configuracoes/acessos/page.tsx`
- Modify: `src/core/rbac/repository.ts`
- Create: `src/modules/core/services/__tests__/access-service.test.ts`
- Create: `src/core/rbac/__tests__/resolve-access.integration.test.ts`
- Test: `src/modules/core/actions/__tests__/integration.test.ts`

- [ ] **Step 1: Add unit tests for `assertOwnerInvariant`**

Create `src/modules/core/services/__tests__/access-service.test.ts` with mocked repositories:

```ts
jest.mock('../../repositories/roles-repository', () => ({ getOwnerRole: jest.fn() }));
jest.mock('../../repositories/access-repository', () => ({
  getUserClinicAccess: jest.fn(),
  countActiveUsersWithRole: jest.fn(),
}));
jest.mock('../../repositories/users-repository', () => ({}));

import { ActionError } from '@/core/actions/types';
import { assertOwnerInvariant } from '../access-service';
import * as rolesRepo from '../../repositories/roles-repository';
import * as accessRepo from '../../repositories/access-repository';

const mockedRoles = jest.mocked(rolesRepo);
const mockedAccess = jest.mocked(accessRepo);

beforeEach(() => {
  jest.resetAllMocks();
  mockedRoles.getOwnerRole.mockResolvedValue({ id: 'owner-role-id' });
  mockedAccess.getUserClinicAccess.mockResolvedValue({ roleId: 'owner-role-id' });
});

it('allows changing owner when another active owner remains', async () => {
  mockedAccess.countActiveUsersWithRole.mockResolvedValue(2);

  await expect(assertOwnerInvariant({
    clinicId: 'clinic-1', userId: 'user-1', nextRoleId: null, operation: 'remove',
  })).resolves.toBeUndefined();
});

it('fails when removing last active owner', async () => {
  mockedAccess.countActiveUsersWithRole.mockResolvedValue(1);

  await expect(assertOwnerInvariant({
    clinicId: 'clinic-1', userId: 'user-1', nextRoleId: null, operation: 'remove',
  })).rejects.toBeInstanceOf(ActionError);
});

it('fails when second owner exists but is inactive because active count is one', async () => {
  mockedAccess.countActiveUsersWithRole.mockResolvedValue(1);

  await expect(assertOwnerInvariant({
    clinicId: 'clinic-1', userId: 'user-1', nextIsActive: false, operation: 'deactivate',
  })).rejects.toBeInstanceOf(ActionError);
});
```

Run:

```bash
npm test -- src/modules/core/services/__tests__/access-service.test.ts
```

Expected: FAIL until `assertOwnerInvariant` and `countActiveUsersWithRole` exist.

- [ ] **Step 2: Add failing integration tests for remove/deactivate and active-owner edge case**

Append imports:

```ts
import { removeUserAccess } from '../remove-user-access';
import { deactivateUser } from '../deactivate-user';
```

Append tests inside `assignUserAccess — anti-lockout` describe:

```ts
  it('bloqueia remover acesso do último Owner ativo', async () => {
    const r = await runAction(removeUserAccess, { userId: ownerUserId, clinicId: CLINIC }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');

    const [acc] = await getDb().select({ roleId: userClinicAccess.roleId }).from(userClinicAccess)
      .where(eq(userClinicAccess.userId, ownerUserId)).limit(1);
    expect(acc.roleId).toBe(ownerRoleId);
  });

  it('bloqueia desativar o último Owner ativo', async () => {
    const r = await runAction(deactivateUser, { userId: ownerUserId, clinicId: CLINIC }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');

    const [user] = await getDb().select({ isActive: users.isActive }).from(users)
      .where(eq(users.id, ownerUserId)).limit(1);
    expect(user.isActive).toBe(true);
  });

  it('bloqueia remover owner ativo quando o único outro Owner está inativo', async () => {
    const inactiveOwnerId = `00000000-0000-0000-0000-0000000b${String(Date.now()).slice(-4)}`;
    await getDb().insert(users).values({
      id: inactiveOwnerId, clinicId: CLINIC, email: `inactive-owner+${Date.now()}@t.local`, name: 'Inactive Owner', role: 'owner', isActive: false,
    }).onConflictDoNothing();
    await getDb().insert(userClinicAccess).values({ userId: inactiveOwnerId, clinicId: CLINIC, roleId: ownerRoleId })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: ownerRoleId } });

    const r = await runAction(removeUserAccess, { userId: ownerUserId, clinicId: CLINIC }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');

    await getDb().delete(userClinicAccess).where(eq(userClinicAccess.userId, inactiveOwnerId));
    await getDb().delete(users).where(eq(users.id, inactiveOwnerId));
  });
```

- [ ] **Step 3: Run tests to verify RED**

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
```

Expected: FAIL missing `remove-user-access` and `deactivate-user`.

- [ ] **Step 4: Implement invariant service**

Replace/create `src/modules/core/services/access-service.ts`:

```ts
import { ActionError } from '@/core/actions/types';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import * as accessRepo from '../repositories/access-repository';
import * as rolesRepo from '../repositories/roles-repository';
import * as usersRepo from '../repositories/users-repository';

export async function listClinicUsers(clinicId: string) {
  return usersRepo.listClinicUsers(clinicId);
}

export async function assertOwnerInvariant(input: {
  clinicId: string;
  userId: string;
  nextRoleId?: string | null;
  nextIsActive?: boolean;
  operation: 'downgrade' | 'remove' | 'deactivate';
}) {
  const ownerRole = await rolesRepo.getOwnerRole(input.clinicId, RESERVED_ROLE_OWNER);
  if (!ownerRole) return;

  const current = await accessRepo.getUserClinicAccess(input.userId, input.clinicId);
  const isCurrentlyOwner = current?.roleId === ownerRole.id;
  if (!isCurrentlyOwner) return;

  const keepsOwnerRole = input.nextRoleId === ownerRole.id;
  const keepsActive = input.nextIsActive !== false;
  if (keepsOwnerRole && keepsActive) return;

  const activeOwnerCount = await accessRepo.countActiveUsersWithRole(input.clinicId, ownerRole.id);
  if (activeOwnerCount <= 1) {
    const verb = input.operation === 'remove' ? 'remover' : input.operation === 'deactivate' ? 'desativar' : 'rebaixar';
    throw new ActionError('conflict', `Não é possível ${verb} o último Owner ativo da clínica.`);
  }
}

export async function assignUserAccess(input: { userId: string; clinicId: string; roleId: string }) {
  await assertOwnerInvariant({
    clinicId: input.clinicId,
    userId: input.userId,
    nextRoleId: input.roleId,
    operation: 'downgrade',
  });
  await accessRepo.upsertUserAccess(input);
  return { ok: true };
}

export async function removeUserAccess(input: { userId: string; clinicId: string }) {
  await assertOwnerInvariant({
    clinicId: input.clinicId,
    userId: input.userId,
    nextRoleId: null,
    operation: 'remove',
  });
  await accessRepo.removeUserAccess(input.userId, input.clinicId);
  return { ok: true };
}

export async function deactivateUser(input: { userId: string; clinicId: string }) {
  await assertOwnerInvariant({
    clinicId: input.clinicId,
    userId: input.userId,
    nextIsActive: false,
    operation: 'deactivate',
  });
  await usersRepo.deactivateUser(input.userId, input.clinicId);
  return { ok: true };
}
```

- [ ] **Step 5: Make RBAC resolution ignore inactive users**

Modify `src/core/rbac/repository.ts` so `getAccess()` joins `users` and filters active users:

```ts
import { users } from '@/lib/db/schema/core';
// keep existing imports

async getAccess(userId, clinicId) {
  const r = await getDb()
    .select({ roleId: roles.id, roleName: roles.name, isSystem: roles.isSystem })
    .from(userClinicAccess)
    .innerJoin(users, eq(users.id, userClinicAccess.userId))
    .innerJoin(roles, eq(roles.id, userClinicAccess.roleId))
    .where(and(
      eq(userClinicAccess.userId, userId),
      eq(userClinicAccess.clinicId, clinicId),
      eq(users.isActive, true),
    ))
    .limit(1);
  return r[0] ?? null;
}
```

Create `src/core/rbac/__tests__/resolve-access.integration.test.ts`:

```ts
/** @jest-environment node */

jest.unmock('@/lib/db/client');
process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/lib/db/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { resolveAccess } from '../resolve';
import { drizzleRbacRepo } from '../repository';
import { and, eq } from 'drizzle-orm';

const CLINIC = '00000000-0000-0000-0000-000000000001';
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeOrSkip('resolveAccess — inactive users', () => {
  it('returns no role and no permissions for inactive user with access row', async () => {
    const db = getDb();
    const userId = `00000000-0000-0000-0000-0000000c${String(Date.now()).slice(-4)}`;
    await db.insert(clinics).values({ id: CLINIC, name: 'Test Clinic', slug: 'test-clinic', phone: '', email: 't@t.local' }).onConflictDoNothing();
    await seedRbacForClinic(CLINIC);
    const [ownerRole] = await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
    await db.insert(users).values({ id: userId, clinicId: CLINIC, email: `inactive+${Date.now()}@t.local`, name: 'Inactive', role: 'owner', isActive: false }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({ userId, clinicId: CLINIC, roleId: ownerRole.id })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: ownerRole.id } });

    const access = await resolveAccess(userId, CLINIC, drizzleRbacRepo);

    expect(access.role).toBeNull();
    expect(access.can('core:manage_users')).toBe(false);

    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });
});
```

Run:

```bash
npm run test:integration -- src/core/rbac/__tests__/resolve-access.integration.test.ts
```

Expected: FAIL before repository fix; PASS after fix.

- [ ] **Step 6: Refactor assign action and add new actions**

Replace `src/modules/core/actions/assign-user-access.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const assignUserAccess = defineAction({
  name: 'core.assignUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Conceder acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1), roleId: z.string().min(1) }),
  handler: async (input) => accessService.assignUserAccess(input),
});
```

Create `src/modules/core/actions/remove-user-access.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const removeUserAccess = defineAction({
  name: 'core.removeUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Remover acesso de usuário da clínica',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1) }),
  handler: async (input) => accessService.removeUserAccess(input),
});
```

Create `src/modules/core/actions/deactivate-user.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const deactivateUser = defineAction({
  name: 'core.deactivateUser',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Desativar usuário',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1) }),
  handler: async (input) => accessService.deactivateUser(input),
});
```

- [ ] **Step 7: Add server wrappers**

Append to `src/modules/core/ui/actions.ts`:

```ts
import { removeUserAccess } from '../actions/remove-user-access';
import { deactivateUser } from '../actions/deactivate-user';

export async function removeUserAccessAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(removeUserAccess, input, ctx);
}

export async function deactivateUserAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(deactivateUser, input, ctx);
}
```

- [ ] **Step 8: Wire remove/deactivate UI call sites**

Create `src/modules/core/ui/ClinicUsersTable.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { deactivateUserAction, removeUserAccessAction } from './actions';

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
}

export function ClinicUsersTable({ clinicId, users }: { clinicId: string; users: UserRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'remove' | 'deactivate', userId: string) {
    setMessage(null);
    setError(null);
    const result = action === 'remove'
      ? await removeUserAccessAction(clinicId, { userId, clinicId })
      : await deactivateUserAction(clinicId, { userId, clinicId });
    if (result.ok) setMessage(action === 'remove' ? 'Acesso removido.' : 'Usuário desativado.');
    else setError(result.error.message);
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {message && <p className="text-green-600 text-sm">{message}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Usuário</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Status</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-2">{user.name || user.email}<br /><span className="text-xs text-gray-500">{user.email}</span></td>
                <td className="p-2">{user.roleName || 'Sem acesso'}</td>
                <td className="p-2">{user.isActive ? 'Ativo' : 'Inativo'}</td>
                <td className="p-2 space-x-2">
                  <button type="button" className="text-red-600 underline disabled:text-gray-400" disabled={!user.roleId} onClick={() => run('remove', user.id)}>Remover acesso</button>
                  <button type="button" className="text-amber-700 underline disabled:text-gray-400" disabled={!user.isActive} onClick={() => run('deactivate', user.id)}>Desativar usuário</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Modify `src/app/dashboard/configuracoes/acessos/page.tsx` to import the table:

```tsx
import { ClinicUsersTable } from '@/modules/core/ui/ClinicUsersTable';
```

Add this section after `UserAccessForm`:

```tsx
<section>
  <h2 className="text-lg font-semibold mb-3">Usuários da clínica</h2>
  <ClinicUsersTable clinicId={ctx.clinicId} users={usersResult.data} />
</section>
```

Run:

```bash
npm run typecheck
```

Expected: 0 errors; `removeUserAccessAction` and `deactivateUserAction` resolve from `src/modules/core/ui/actions.ts`.

- [ ] **Step 9: Run anti-lockout tests**

```bash
npm test -- src/modules/core/services/__tests__/access-service.test.ts
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
npm run test:integration -- src/core/rbac/__tests__/resolve-access.integration.test.ts
```

Expected: PASS; conflict for downgrade/remove/deactivate last active Owner; inactive users resolve to no access.

- [ ] **Step 10: Verify actions remain DB-free**

```bash
rg -n "getDb\(|@/lib/db/schema" src/modules/core/actions --glob '!**/__tests__/**'
```

Expected: no matches.

- [ ] **Step 11: Commit**

```bash
git add src/modules/core/actions src/modules/core/services src/modules/core/repositories src/modules/core/ui src/app/dashboard/configuracoes/acessos/page.tsx
git commit -m "feat(core): enforce owner anti-lockout invariant"
```

---

## Task 4 — A4: Block direct `/dashboard/contatos` until E-04

**Files:**
- Modify: `src/app/dashboard/contatos/page.tsx`
- Test: `src/app/dashboard/contatos/page.tsx` via static check/typecheck

- [ ] **Step 1: Replace page with explicit notFound guard**

Replace `src/app/dashboard/contatos/page.tsx`:

```tsx
import { notFound } from 'next/navigation';

export default function ContatosPage() {
  // Eixo 2 Core: Contatos é a lente unificada do CRM (E-04).
  // Até o spec E-04 assumir rota/modelo, acesso direto fica indisponível.
  notFound();
}
```

- [ ] **Step 2: Verify no menu entry exists for contatos**

```bash
rg -n "/dashboard/contatos|Contatos" src/lib/ui src/app/dashboard
```

Expected: match only in `src/app/dashboard/contatos/page.tsx` and comments/docs; no `navItems` entry.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/contatos/page.tsx
git commit -m "fix(core): guard contatos until crm module"
```

---

## Task 5 — B1: Move RBAC schema ownership into Core module

**Files:**
- Create: `src/modules/core/schema/rbac.ts`
- Create: `src/modules/core/schema/index.ts`
- Modify: `src/lib/db/schema/index.ts`
- Modify imports in: `src/modules/core/actions/__tests__/integration.test.ts`, `src/core/rbac/seed.ts`, `src/core/rbac/repository.ts`, `src/core/rbac/agent-access.ts`, `src/core/rbac/__tests__/resolve-access.integration.test.ts`, `scripts/migrate-userrole-to-rbac.ts`, `src/repositories/auth/index.ts`, `src/repositories/auth/__tests__/integration.test.ts`
- Delete: `src/lib/db/schema/rbac.ts`

- [ ] **Step 1: Move file**

```bash
mkdir -p src/modules/core/schema
git mv src/lib/db/schema/rbac.ts src/modules/core/schema/rbac.ts
```

- [ ] **Step 2: Fix relative import in moved RBAC schema**

In `src/modules/core/schema/rbac.ts`, replace:

```ts
import { clinics, users } from './core';
```

with:

```ts
import { clinics, users } from '../../../lib/db/schema/core';
```

- [ ] **Step 3: Create public schema seam**

Create `src/modules/core/schema/index.ts`:

```ts
export * from './rbac';
export { clinics, users, userCredentials } from '@/lib/db/schema/core';
export { actionLogs } from '@/lib/db/schema/audit';
export { instanceModules } from '@/lib/db/schema/modules';
```

- [ ] **Step 4: Preserve Drizzle aggregate exports**

Modify `src/lib/db/schema/index.ts`, replacing:

```ts
export * from './rbac';
```

with:

```ts
export * from '../../../modules/core/schema/rbac';
```

- [ ] **Step 5: Update imports**

Run:

```bash
rg -l "@/lib/db/schema/rbac" src scripts | xargs -r perl -0pi -e "s#@/lib/db/schema/rbac#@/modules/core/schema/rbac#g"
```

Then verify:

```bash
rg -n "@/lib/db/schema/rbac|from './rbac'" src scripts
```

Expected: no matches for old path; `src/lib/db/schema/index.ts` imports new path.

- [ ] **Step 6: Run typecheck and db generate**

```bash
npm run typecheck
npm run db:generate
```

Expected: typecheck 0 errors. `db:generate` reports no unintended table drops; if it creates a migration, inspect and delete if only path move caused false diff.

- [ ] **Step 7: Run integration tests**

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/core/schema src/lib/db/schema/index.ts src scripts
git add -u src/lib/db/schema/rbac.ts
git commit -m "refactor(core): own rbac schema seam"
```

---

## Task 6 — B2+B4: Gate/menu pattern tests and sequencing refinement docs

**Files:**
- Modify: `src/core/modules/__tests__/gates.test.ts`
- Create: `docs/superpowers/plans/2026-06-21-eixo2-core-modulo-refinements.md`
- No app behavior change for static navItems except documented deferral

- [ ] **Step 1: Expand gate tests**

Modify `src/core/modules/__tests__/gates.test.ts`:

```ts
import { filterMenuByAccess, assertModuleForJob, ModuleDisabledError, withModuleRoute } from '../gates';

const manifest = { isEnabled: async (m: string) => m === 'operacional' };
const ctxCan = (k: string) => k === 'operacional:view';

it('filterMenuByAccess keeps only enabled + permitted items', async () => {
  const menu = [
    { moduleId: 'operacional', permission: 'operacional:view', label: 'Agenda' },
    { moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro' },
    { moduleId: 'operacional', permission: 'operacional:admin', label: 'Config' },
  ];
  const out = await filterMenuByAccess(menu, manifest, ctxCan);
  expect(out.map((i) => i.label)).toEqual(['Agenda']);
});

it('assertModuleForJob throws for disabled module', async () => {
  await expect(assertModuleForJob('financeiro', manifest)).rejects.toBeInstanceOf(ModuleDisabledError);
  await expect(assertModuleForJob('operacional', manifest)).resolves.toBeUndefined();
});

it('withModuleRoute returns 404 for disabled module', async () => {
  const handler = jest.fn(async () => new Response('ok', { status: 200 }));
  const gated = withModuleRoute('financeiro', manifest)(handler);

  const response = await gated();

  expect(response.status).toBe(404);
  expect(handler).not.toHaveBeenCalled();
});

it('withModuleRoute calls handler for enabled module', async () => {
  const handler = jest.fn(async () => new Response('ok', { status: 200 }));
  const gated = withModuleRoute('operacional', manifest)(handler);

  const response = await gated();

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('ok');
  expect(handler).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run unit tests**

```bash
npm test -- src/core/modules/__tests__/gates.test.ts
npm test -- src/modules/core/services/__tests__/access-service.test.ts
```

Expected: PASS.

- [ ] **Step 3: Create refinement doc**

Create `docs/superpowers/plans/2026-06-21-eixo2-core-modulo-refinements.md`:

```md
# Eixo 2 Core — Refinements to Sequencing DoD

> Companion note for `docs/superpowers/specs/2026-06-21-eixo2-core-modulo-design.md`.

## Gates

Sequencing DoD said: gate `/api/*` module routes and crons in Onda 0.
Core refinement: Onda 0 closes gate mechanism, tests, documentation, and first genuine application when Core has a real target. Contractable module route/cron rollout happens in the owner module specs because no migrated contractable module exists yet.

## Menu

Sequencing DoD said: menu/routes through manifest + RBAC.
Core refinement: Core menu is manifest+RBAC now. Static items for CRM/Pipeline/Leads/Campaigns remain documented debt because their owner modules are not migrated. Each owner module spec must move its items into its manifest and remove static `navItems` entries.

## Contatos

`/dashboard/contatos` stays unavailable by direct URL until E-04 owns route/model. No redirect to `/crm` because CRM may not be contracted.
```

- [ ] **Step 4: Verify static navItems debt remains explicit**

```bash
rg -n "navItems|Refino do sequenciamento|Core refinement|/dashboard/contatos" docs/superpowers/specs/2026-06-21-eixo2-core-modulo-design.md docs/superpowers/plans/2026-06-21-eixo2-core-modulo-refinements.md src/lib/ui/sidebar.tsx
```

Expected: spec and companion doc mention refinement/debt; `sidebar.tsx` still has static non-Core items.

- [ ] **Step 5: Commit**

```bash
git add src/core/modules/__tests__/gates.test.ts docs/superpowers/plans/2026-06-21-eixo2-core-modulo-refinements.md
git commit -m "test(core): document gate and menu rollout pattern"
```

---

## Task 7 — B3 + final verification: boundaries error and full gates

**Files:**
- Modify: `.eslintrc.json`
- Modify any files reported by lint boundary violations

- [ ] **Step 1: Run lint before flip**

```bash
npm run lint
```

Expected: no boundary warnings, or only fixable pre-existing violations. If boundary warnings appear, fix imports by using module public seams or moving code to correct layer.

- [ ] **Step 2: Flip boundaries to error**

In `.eslintrc.json`, replace:

```json
"boundaries/dependencies": ["warn", {
```

with:

```json
"boundaries/dependencies": ["error", {
```

- [ ] **Step 3: Run lint again**

```bash
npm run lint
```

Expected: PASS, zero boundary errors.

- [ ] **Step 4: Run final typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Run unit tests**

```bash
npm test -- src/core/modules/__tests__/gates.test.ts
npm test -- src/modules/core/services/__tests__/access-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run integration tests**

```bash
npm run test:integration -- src/modules/core/actions/__tests__/integration.test.ts
npm run test:integration -- src/core/rbac/__tests__/resolve-access.integration.test.ts
```

Expected: PASS. Anti-lockout counts only active Owners; downgrade/remove/deactivate last active Owner fail; inactive users resolve to no access; read-actions enforce `forbidden` when missing permission.

- [ ] **Step 7: Verify schema generation**

```bash
npm run db:generate
```

Expected: no unintended schema diff from moving RBAC file. If Drizzle creates migration, inspect it; do not keep migration that drops/recreates unchanged RBAC tables only due to import path move.

- [ ] **Step 8: Run full final gate**

```bash
npm test -- src/modules/core/services/__tests__/access-service.test.ts
npm run test:integration -- src/core/rbac/__tests__/resolve-access.integration.test.ts
npm run typecheck && npm test && npm run test:integration && npm run db:generate && npm run lint
```

Expected: all commands exit 0; `db:generate` has no unexpected diff.

- [ ] **Step 9: Commit**

```bash
git add .eslintrc.json
git add src docs/superpowers/plans/2026-06-21-eixo2-core-modulo-refinements.md
git commit -m "chore(core): enforce module boundary lint"
```

---

## Self-Review Checklist

- Spec A1 covered by Tasks 1/3: actions delegate to services; repositories own Drizzle.
- Spec A2 covered by Task 2: read-actions + selects + users table with remove/deactivate call sites; admin errors remain `forbidden`/`unauthenticated` via `runAction`.
- Spec A3 covered by Task 3: downgrade/remove/deactivate, all in scope; invariant counts only active Owners; `resolveAccess` ignores inactive users.
- Spec A4 covered by Task 4: `/dashboard/contatos` direct access blocked, no redirect/delete.
- Spec B1 covered by Task 5: RBAC schema moved, public seam, Drizzle aggregate preserved.
- Spec B2+B4 covered by Task 6: mechanism/tests/docs + refinement note; rollout by module owner.
- Spec B3 covered by Task 7: boundary lint `error`.
- Final gates cover typecheck, unit, integration, db generate, lint.
