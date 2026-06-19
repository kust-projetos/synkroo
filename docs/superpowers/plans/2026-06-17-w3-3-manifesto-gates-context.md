# W3.3 — Manifesto de módulos + Gates + Construtores de contexto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a contratação de módulos por instância (`instance_modules` + `moduleManifest.isEnabled`), os 4 gates do manifesto, e os três construtores de `ActionContext` (`buildUserContext`/`buildDelegatedContext`/`buildSystemContext`) que combinam RBAC (W3.2) e manifesto — fechando o `ActionContext` completo consumido por `runAction`.

**Architecture:** O manifesto usa um *provider injetável* (como o RBAC), tornando `isEnabled` testável sem Drizzle. Os construtores de contexto recebem `deps` injetáveis (carregador de perfil, `RbacRepo`, manifesto) com defaults reais. Os gates 1–2 e 4 (rota, menu, jobs) usam `isEnabled`; o gate 3 (tools) já existe em `agentToolsFor` (W3.1) e só passa a receber `hasModule` real.

**Tech Stack:** TypeScript 5.6, Drizzle ORM, Jest + ts-jest, NextAuth (`getUserProfile`).

**Spec:** spec do W3 (§2.2 construtores, §2.5/§4 gates, §3.7 principal `system`).

**Pré-requisitos:** W3.1 (Action Layer), W3.2 (`resolveAccess`, `drizzleRbacRepo`, seed) concluídos.

---

## File Structure

- Create: `src/lib/db/schema/modules.ts` — `instanceModules`.
- Modify: `src/lib/db/schema/index.ts`.
- Create: `src/core/modules/manifest.ts` — `ModuleManifestRepo` + `moduleManifest.isEnabled`.
- Create: `src/core/actions/context.ts` — `buildUserContext`/`buildDelegatedContext`/`buildSystemContext`.
- Create: `src/core/rbac/agent-access.ts` — role de sistema `Agente` (permissões do principal `system`).
- Create: `src/core/modules/gates.ts` — `withModuleRoute`, `filterMenuByAccess`, `assertModuleForJob`.
- Tests: `src/core/modules/__tests__/{manifest,gates}.test.ts`, `src/core/actions/__tests__/context.test.ts`.

---

### Task 1: Schema `instance_modules`

**Files:**
- Create: `src/lib/db/schema/modules.ts`
- Modify: `src/lib/db/schema/index.ts`

- [ ] **Step 1: Definir a tabela**

```ts
// src/lib/db/schema/modules.ts
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

// Contratação no nível instância (DB dedicado por cliente). moduleId PK = singleton por instância (§4.1).
export const instanceModules = pgTable('instance_modules', {
  moduleId: text('module_id').primaryKey(),
  enabled: boolean('enabled').default(false).notNull(),
  contractedAt: timestamp('contracted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Exportar + gerar migração**

`src/lib/db/schema/index.ts`: `export * from './modules';`
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npm run db:generate` → Expected: migração criando `instance_modules`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema/modules.ts src/lib/db/schema/index.ts src/lib/db/migrations/
git commit -m "feat(db): tabela instance_modules (contratacao por instancia)"
```

---

### Task 2: `moduleManifest.isEnabled` (provider injetável)

**Files:**
- Create: `src/core/modules/manifest.ts`
- Test: `src/core/modules/__tests__/manifest.test.ts`

- [ ] **Step 1: Teste (falha)**

```ts
// src/core/modules/__tests__/manifest.test.ts
import { makeManifest } from '../manifest';

it('reports enabled modules and defaults missing to disabled', async () => {
  const m = makeManifest({ getEnabledModuleIds: async () => ['operacional'] });
  expect(await m.isEnabled('operacional')).toBe(true);
  expect(await m.isEnabled('financeiro')).toBe(false);
});

it('always-on modules (core) are enabled regardless of contract', async () => {
  const m = makeManifest({ getEnabledModuleIds: async () => [] });
  expect(await m.isEnabled('core')).toBe(true);
});

it('caches the lookup within an instance', async () => {
  let calls = 0;
  const m = makeManifest({ getEnabledModuleIds: async () => { calls++; return ['core']; } });
  await m.isEnabled('core'); await m.isEnabled('operacional');
  expect(calls).toBe(1);
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npm test -- src/core/modules/__tests__/manifest.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/core/modules/manifest.ts
import { getDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';
import { eq } from 'drizzle-orm';

export interface ModuleManifestRepo { getEnabledModuleIds(): Promise<string[]>; }

export interface ModuleManifest {
  isEnabled(moduleId: string): Promise<boolean>;
  enabledModules(): Promise<Set<string>>;   // contratados ∪ always-on
}

// Módulos sempre ativos (não desativáveis), independentes da contratação no banco.
export const ALWAYS_ON_MODULES = new Set<string>(['core']);

export function makeManifest(repo: ModuleManifestRepo): ModuleManifest {
  let cache: Set<string> | null = null;
  async function load(): Promise<Set<string>> {
    if (!cache) cache = new Set([...ALWAYS_ON_MODULES, ...(await repo.getEnabledModuleIds())]);
    return cache;
  }
  return {
    async isEnabled(moduleId) { return (await load()).has(moduleId); },
    async enabledModules() { return new Set(await load()); },
  };
}

export const drizzleManifestRepo: ModuleManifestRepo = {
  async getEnabledModuleIds() {
    const rows = await getDb().select({ id: instanceModules.moduleId })
      .from(instanceModules).where(eq(instanceModules.enabled, true));
    return rows.map((r) => r.id);
  },
};

// Instância padrão (uma por request; criar nova quando precisar invalidar cache).
export const moduleManifest = makeManifest(drizzleManifestRepo);
```

- [ ] **Step 4: Rodar — passa + commit**

Run: `npm test -- src/core/modules/__tests__/manifest.test.ts` → Expected: PASS.
```bash
git add src/core/modules/manifest.ts src/core/modules/__tests__/manifest.test.ts
git commit -m "feat(modules): moduleManifest.isEnabled com provider injetavel e cache"
```

---

### Task 3: Permissões do agente (`system`) — role `Agente`

**Files:**
- Create: `src/core/rbac/agent-access.ts`

- [ ] **Step 1: Implementar resolver das permissões do agente** (role de sistema `Agente`, conservador por default; configurável na Gestão do Agente de IA — Eixo 2)

```ts
// src/core/rbac/agent-access.ts
import { getDb } from '@/lib/db/client';
import { and, eq } from 'drizzle-orm';
import { roles, rolePermissions } from '@/lib/db/schema/rbac';

export const AGENT_ROLE_NAME = 'Agente';

// Permissões default do agente autônomo. Conservador: agendar/confirmar/responder;
// NÃO cancelar tratamento nem alterar financeiro sem humano (§3.7).
export const DEFAULT_AGENT_PERMISSIONS = [
  'operacional:create', 'operacional:confirm', 'operacional:view',
  'comercial:view', 'atendimento:reply',
];

export interface AgentAccessRepo {
  getAgentPermissions(clinicId: string): Promise<string[]>;
}

export const drizzleAgentAccessRepo: AgentAccessRepo = {
  async getAgentPermissions(clinicId) {
    const r = await getDb()
      .select({ key: rolePermissions.permissionKey })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(roles.clinicId, clinicId), eq(roles.name, AGENT_ROLE_NAME), eq(roles.isSystem, true)));
    return r.length ? r.map((x) => x.key) : DEFAULT_AGENT_PERMISSIONS;
  },
};
```

- [ ] **Step 2: Compilar + commit**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
```bash
git add src/core/rbac/agent-access.ts
git commit -m "feat(rbac): permissoes do principal system (role Agente, default conservador)"
```

> Nota: o seed do role `Agente` por clínica é adicionado a `seedRbacForClinic` (W3.2) na integração do Core (W3.4); enquanto não existir, `getAgentPermissions` retorna o default.

---

### Task 4: Construtores de `ActionContext`

**Files:**
- Create: `src/core/actions/context.ts`
- Test: `src/core/actions/__tests__/context.test.ts`

- [ ] **Step 1: Teste (falha)** — usa deps injetadas.

```ts
// src/core/actions/__tests__/context.test.ts
import { buildUserContext, buildDelegatedContext, buildSystemContext } from '../context';

const rbac = {
  isMaster: async () => false,
  getAccess: async () => ({ roleId: 'r', roleName: 'Recepcionista', isSystem: true }),
  getRolePermissions: async () => ['operacional:create'],
  getOverrides: async () => [],
};
const manifest = { enabledModules: async () => new Set(['operacional']) };

it('buildUserContext: user principal with can/hasModule and audit', async () => {
  const ctx = await buildUserContext('clinic-1', {
    loadProfile: async () => ({ id: 'u1', email: 'a@b.c', name: 'A', clinic_id: 'clinic-1' } as any),
    rbac, manifest,
  });
  expect(ctx.source).toBe('user');
  expect(ctx.clinicId).toBe('clinic-1');
  expect(ctx.can('operacional:create')).toBe(true);
  expect(ctx.hasModule('operacional')).toBe(true);  // hasModule é síncrono (Set pré-resolvido)
  expect(ctx.audit.actor).toBe('u1');
});

it('buildDelegatedContext: agent on behalf of staff, uses delegate permissions', async () => {
  const ctx = await buildDelegatedContext('u1', 'clinic-1', { rbac, manifest });
  expect(ctx.source).toBe('agent_delegated');
  expect(ctx.audit).toEqual({ actor: 'agente', onBehalfOf: 'u1' });
  expect(ctx.can('operacional:create')).toBe(true);
});

it('buildSystemContext: no user, agent permission set', async () => {
  const ctx = await buildSystemContext('clinic-1', {
    manifest, agentAccess: { getAgentPermissions: async () => ['operacional:create'] },
  });
  expect(ctx.source).toBe('system');
  expect(ctx.user).toBeUndefined();
  expect(ctx.can('operacional:create')).toBe(true);
  expect(ctx.can('financeiro:delete')).toBe(false);
  expect(ctx.audit.actor).toBe('agente (sistema)');
});
```

> `ActionContext.hasModule` é **síncrono**: os construtores pré-resolvem `manifest.enabledModules()` num `Set` e fecham sobre ele. Independe do registry de Actions, então um módulo habilitado sem Actions de mutação ainda resolve `true`.

- [ ] **Step 2: Rodar — falha**

Run: `npm test -- src/core/actions/__tests__/context.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/core/actions/context.ts
import type { ActionContext } from './types';
import { resolveAccess } from '@/core/rbac/resolve';
import { drizzleRbacRepo, type RbacRepo } from '@/core/rbac/repository';
import { drizzleAgentAccessRepo, type AgentAccessRepo } from '@/core/rbac/agent-access';
import { drizzleManifestRepo, makeManifest } from '@/core/modules/manifest';
import { getUserProfile } from '@/lib/auth/session';

// hasModule é síncrono: pré-resolvemos o conjunto de módulos habilitados uma vez
// (contratados ∪ always-on) direto do manifesto — independe do registry de Actions.
interface ManifestLike { enabledModules(): Promise<Set<string>>; }

interface UserDeps { loadProfile?: () => Promise<any>; rbac?: RbacRepo; manifest?: ManifestLike; }

export async function buildUserContext(activeClinicId?: string, deps: UserDeps = {}): Promise<ActionContext> {
  const loadProfile = deps.loadProfile ?? getUserProfile;
  const rbac = deps.rbac ?? drizzleRbacRepo;
  const manifest = deps.manifest ?? makeManifest(drizzleManifestRepo);

  const profile = await loadProfile();
  if (!profile) throw new Error('unauthenticated');
  const clinicId = activeClinicId ?? profile.clinic_id;
  const access = await resolveAccess(profile.id, clinicId, rbac);
  const mods = await manifest.enabledModules();

  return {
    source: 'user', clinicId,
    user: { id: profile.id, email: profile.email, name: profile.name },
    role: access.role ?? undefined,
    can: access.can,
    hasModule: (id) => mods.has(id),
    audit: { actor: profile.id },
  };
}

interface DelegatedDeps { rbac?: RbacRepo; manifest?: ManifestLike; }

export async function buildDelegatedContext(userId: string, clinicId: string, deps: DelegatedDeps = {}): Promise<ActionContext> {
  const rbac = deps.rbac ?? drizzleRbacRepo;
  const manifest = deps.manifest ?? makeManifest(drizzleManifestRepo);
  const access = await resolveAccess(userId, clinicId, rbac);
  const mods = await manifest.enabledModules();
  return {
    source: 'agent_delegated', clinicId,
    user: { id: userId, email: '', name: '' },
    role: access.role ?? undefined,
    can: access.can,
    hasModule: (id) => mods.has(id),
    audit: { actor: 'agente', onBehalfOf: userId },
  };
}

interface SystemDeps { manifest?: ManifestLike; agentAccess?: AgentAccessRepo; }

export async function buildSystemContext(clinicId: string, deps: SystemDeps = {}): Promise<ActionContext> {
  const manifest = deps.manifest ?? makeManifest(drizzleManifestRepo);
  const agentAccess = deps.agentAccess ?? drizzleAgentAccessRepo;
  const perms = new Set(await agentAccess.getAgentPermissions(clinicId));
  const mods = await manifest.enabledModules();
  return {
    source: 'system', clinicId,
    can: (key) => perms.has(key),
    hasModule: (id) => mods.has(id),
    audit: { actor: 'agente (sistema)' },
  };
}
```

- [ ] **Step 4: Rodar — passa** (ajustar a asserção de `hasModule` para síncrona, conforme a nota)

Run: `npm test -- src/core/actions/__tests__/context.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/actions/context.ts src/core/actions/__tests__/context.test.ts
git commit -m "feat(actions): construtores de contexto (user/delegated/system) unindo RBAC + manifesto"
```

---

### Task 5: Os 4 gates

**Files:**
- Create: `src/core/modules/gates.ts`
- Test: `src/core/modules/__tests__/gates.test.ts`

- [ ] **Step 1: Teste (falha)**

```ts
// src/core/modules/__tests__/gates.test.ts
import { filterMenuByAccess, assertModuleForJob, ModuleDisabledError } from '../gates';

const manifest = { isEnabled: async (m: string) => m === 'operacional' };
const ctxCan = (k: string) => k === 'operacional:view';

it('filterMenuByAccess keeps only enabled + permitted items', async () => {
  const menu = [
    { moduleId: 'operacional', permission: 'operacional:view', label: 'Agenda' },
    { moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro' },   // módulo off
    { moduleId: 'operacional', permission: 'operacional:admin', label: 'Config' },     // sem permissão
  ];
  const out = await filterMenuByAccess(menu, manifest, ctxCan);
  expect(out.map((i) => i.label)).toEqual(['Agenda']);
});

it('assertModuleForJob throws for disabled module', async () => {
  await expect(assertModuleForJob('financeiro', manifest)).rejects.toBeInstanceOf(ModuleDisabledError);
  await expect(assertModuleForJob('operacional', manifest)).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npm test -- src/core/modules/__tests__/gates.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/core/modules/gates.ts
import { NextResponse } from 'next/server';

interface ManifestLike { isEnabled(id: string): Promise<boolean>; }

export class ModuleDisabledError extends Error {
  constructor(public moduleId: string) { super(`module disabled: ${moduleId}`); }
}

// Gate 1 — rotas/API: embrulha um route handler; 404 quando o módulo está desativado.
export function withModuleRoute(moduleId: string, manifest: ManifestLike) {
  return function <H extends (...args: any[]) => Promise<Response>>(handler: H): H {
    return (async (...args: Parameters<H>) => {
      if (!(await manifest.isEnabled(moduleId))) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return handler(...args);
    }) as H;
  };
}

// Gate 2 — menu: mantém itens cujo módulo está ativo E o usuário tem a permissão.
export interface MenuItem { moduleId: string; permission: string; label: string; [k: string]: unknown; }
export async function filterMenuByAccess(
  items: MenuItem[], manifest: ManifestLike, can: (key: string) => boolean,
): Promise<MenuItem[]> {
  const out: MenuItem[] = [];
  for (const item of items) {
    if (can(item.permission) && (await manifest.isEnabled(item.moduleId))) out.push(item);
  }
  return out;
}

// Gate 4 — jobs em background: lança antes de agendar/executar um job de módulo desativado.
export async function assertModuleForJob(moduleId: string, manifest: ManifestLike): Promise<void> {
  if (!(await manifest.isEnabled(moduleId))) throw new ModuleDisabledError(moduleId);
}

// Gate 3 (tools do agente) já vive em `agentToolsFor` (W3.1), que filtra por ctx.hasModule.
```

- [ ] **Step 4: Rodar — passa + commit**

Run: `npm test -- src/core/modules/__tests__/gates.test.ts` → Expected: PASS.
```bash
git add src/core/modules/gates.ts src/core/modules/__tests__/gates.test.ts
git commit -m "feat(modules): gates de rota, menu e jobs (gate de tools ja em agentToolsFor)"
```

---

### Task 6: Verificação final da fase

- [ ] **Step 1: Typecheck** → Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
- [ ] **Step 2: Suítes** → Run: `npm test -- src/core` → Expected: PASS (actions, rbac, modules).
- [ ] **Step 3: Lint** → Run: `npm run lint` → Expected: exit 0.
- [ ] **Step 4: Commit final (se houve ajuste)** → `git add -A && git commit -m "chore(modules): baseline verde do manifesto+gates+contexto (W3.3)"`

---

## Self-Review

**Spec coverage:**
- `instance_modules` + `isEnabled` (§4.1/§4.2) → Tasks 1–2 ✓
- Construtores `buildUserContext`/`buildDelegatedContext`/`buildSystemContext` (§2.2) → Task 4 ✓; `system` sem user + permissões do agente (§3.7) → Tasks 3–4 ✓
- 4 gates (§2.5/§4.3): rota+menu+jobs → Task 5 ✓; tools → já em W3.1 (referenciado) ✓

**Placeholder scan:** sem TBD. Seed do role `Agente` é integrado no W3.4 (Core); até lá `getAgentPermissions` usa default conservador — ponto de extensão explícito.

**Type consistency:** `ActionContext` (W3.1) preenchido por todos os construtores com `hasModule` **síncrono** (Set pré-resolvido). `RbacRepo`/`resolveAccess` (W3.2) consumidos em `context.ts`. `ModuleManifestRepo`/`makeManifest` (Task 2) usados pelos construtores e gates. `AgentAccessRepo` (Task 3) usado por `buildSystemContext`.

**Dependência seguinte:** W3.4 migra o Core para `src/modules/core/`, chama `registerActions` no bootstrap, integra `seedRbacForClinic` (+ role `Agente`) na criação de clínica, e aplica `withModuleRoute`/`filterMenuByAccess` nas superfícies reais. W3.5 constrói o painel admin sobre RBAC + catálogo.
