# W3.4 — Estrutura `src/modules/` + Core + Lint de fronteira — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer a estrutura modular `src/modules/`, criar o **módulo Core de referência** (manifesto, index público, Actions de gestão), o **bootstrap determinístico** que registra as Actions, integrar `seedRbacForClinic` + role `Agente` na criação de clínica, e instalar o **lint de fronteira** entre módulos.

**Architecture:** `src/core/` é a **infra transversal** (Action Layer, RBAC engine, manifest engine — já feita em W3.1–W3.3). `src/modules/<m>/` são **bounded contexts de domínio**. O W3.4 cria `src/modules/core/` (clínicas, usuários, RBAC de gestão, contratação) como exemplo do template; os demais domínios coexistem e migram no Eixo 2 (strangler). O bootstrap importa os módulos e chama `registerActions` — registro determinístico, sem side-effect.

**Tech Stack:** TypeScript 5.6, Drizzle, Zod, Jest, ESLint 9 (`eslint-plugin-boundaries`).

**Spec:** spec do W3 (§5 estrutura/strangler, §5.3 lint, §6 data flow).

**Pré-requisitos:** W3.1–W3.3 concluídos.

---

## File Structure

- Create: `src/modules/core/{manifest.ts,index.ts,permissions.ts}`.
- Create: `src/modules/core/actions/{assign-user-access.ts,create-role.ts,set-module-contract.ts}`.
- Create: `src/modules/core/services/clinic-provisioning.ts` — cria clínica + seed RBAC.
- Create: `src/core/actions/bootstrap.ts` — registro central dos módulos.
- Create: `eslint.config.boundaries.mjs` (ou ajuste em `.eslintrc.json`) — regra de fronteira.
- Modify: `src/core/rbac/seed.ts` — incluir role `Agente`.
- Tests: `src/modules/core/__tests__/*.test.ts`, `src/core/actions/__tests__/bootstrap.test.ts`.

---

### Task 1: Manifesto e permissões do módulo Core

**Files:**
- Create: `src/modules/core/manifest.ts`, `src/modules/core/permissions.ts`

- [ ] **Step 1: Declarar o manifesto** (id, nome, rotas, menu, jobs)

```ts
// src/modules/core/manifest.ts
export const coreManifest = {
  id: 'core',
  name: 'Núcleo',
  alwaysOn: true,                 // Core nunca é desativável
  menu: [
    { moduleId: 'core', permission: 'core:manage_users', label: 'Usuários e acessos', path: '/dashboard/configuracoes/acessos' },
  ],
  jobs: [] as string[],
};
```

- [ ] **Step 2: Declarar permissões de acesso/visualização do Core** (as de mutação vêm das Actions)

```ts
// src/modules/core/permissions.ts
import type { PermissionEntry } from '@/core/rbac/catalog';

export const coreAccessPermissions: PermissionEntry[] = [
  { key: 'core:view', module: 'core', label: 'Acessar configurações' },
  { key: 'core:manage_users', module: 'core', label: 'Gerenciar usuários e acessos' },
];
```

- [ ] **Step 3: Compilar + commit**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
```bash
git add src/modules/core/manifest.ts src/modules/core/permissions.ts
git commit -m "feat(core): manifesto e permissoes de acesso do modulo Core"
```

---

### Task 2: Actions de gestão do Core

**Files:**
- Create: `src/modules/core/actions/assign-user-access.ts`, `create-role.ts`, `set-module-contract.ts`
- Test: `src/modules/core/__tests__/actions.test.ts`

- [ ] **Step 1: Teste (falha)** — valida metadados/permissões das Actions (handlers usam services testados à parte).

```ts
// src/modules/core/__tests__/actions.test.ts
import { assignUserAccess } from '../actions/assign-user-access';
import { setModuleContract } from '../actions/set-module-contract';

it('assignUserAccess requires core:manage_users and validates input', () => {
  expect(assignUserAccess.module).toBe('core');
  expect(assignUserAccess.requires).toBe('core:manage_users');
  expect(assignUserAccess.input.safeParse({ userId: 'x', clinicId: 'y', roleId: 'z' }).success).toBe(true);
  expect(assignUserAccess.input.safeParse({}).success).toBe(false);
});

it('setModuleContract is master-only', () => {
  expect(setModuleContract.requires).toBe('master:manage_modules');
});
```

- [ ] **Step 2: Rodar — falha** → `npm test -- src/modules/core/__tests__/actions.test.ts`

- [ ] **Step 3: Implementar as Actions** (handlers chamam repositories/services; aqui o essencial)

```ts
// src/modules/core/actions/assign-user-access.ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { getDb } from '@/lib/db/client';
import { userClinicAccess } from '@/lib/db/schema/rbac';

export const assignUserAccess = defineAction({
  name: 'core.assignUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Conceder acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().uuid(), clinicId: z.string().uuid(), roleId: z.string().uuid() }),
  handler: async (input) => {
    await getDb().insert(userClinicAccess)
      .values({ userId: input.userId, clinicId: input.clinicId, roleId: input.roleId })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: input.roleId } });
    return { ok: true };
  },
});
```

```ts
// src/modules/core/actions/create-role.ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { getDb } from '@/lib/db/client';
import { roles, rolePermissions } from '@/lib/db/schema/rbac';

export const createRole = defineAction({
  name: 'core.createRole',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Criar perfil de acesso',
  input: z.object({
    clinicId: z.string().uuid(), name: z.string().min(1), description: z.string().optional(),
    permissionKeys: z.array(z.string()).default([]),
  }),
  handler: async (input) => {
    const db = getDb();
    const [row] = await db.insert(roles)
      .values({ clinicId: input.clinicId, name: input.name, description: input.description, isSystem: false })
      .returning({ id: roles.id });
    if (input.permissionKeys.length) {
      await db.insert(rolePermissions).values(input.permissionKeys.map((permissionKey) => ({ roleId: row.id, permissionKey })));
    }
    return { id: row.id };
  },
});
```

```ts
// src/modules/core/actions/set-module-contract.ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { getDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';

// Master-only: contrata/desativa um módulo na instância.
export const setModuleContract = defineAction({
  name: 'master.setModuleContract',
  module: 'core',
  requires: 'master:manage_modules',
  label: 'Contratar/desativar módulo (fornecedor)',
  input: z.object({ moduleId: z.string(), enabled: z.boolean() }),
  handler: async (input) => {
    await getDb().insert(instanceModules)
      .values({ moduleId: input.moduleId, enabled: input.enabled, contractedAt: new Date() })
      .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: input.enabled, updatedAt: new Date() } });
    return { ok: true };
  },
});
```

> `master:manage_modules` só é concedida ao principal `master` (bypass), nunca a perfis de clínica.

- [ ] **Step 4: index público do Core**

```ts
// src/modules/core/index.ts
import { assignUserAccess } from './actions/assign-user-access';
import { createRole } from './actions/create-role';
import { setModuleContract } from './actions/set-module-contract';
export const coreActions = [assignUserAccess, createRole, setModuleContract];
export { coreManifest } from './manifest';
export { coreAccessPermissions } from './permissions';
```

- [ ] **Step 5: Rodar — passa + commit**

Run: `npm test -- src/modules/core/__tests__/actions.test.ts` → Expected: PASS.
```bash
git add src/modules/core/actions src/modules/core/index.ts
git commit -m "feat(core): actions de gestao (acesso, perfil, contratacao de modulo)"
```

---

### Task 3: Bootstrap determinístico do registry

**Files:**
- Create: `src/core/actions/bootstrap.ts`
- Test: `src/core/actions/__tests__/bootstrap.test.ts`

- [ ] **Step 1: Teste (falha)**

```ts
// src/core/actions/__tests__/bootstrap.test.ts
import { bootstrapActions } from '../bootstrap';
import { getActions, clearRegistry } from '../registry';

it('registers all module actions deterministically and idempotently', () => {
  clearRegistry();
  bootstrapActions();
  const names = getActions().map((a) => a.name);
  expect(names).toContain('core.assignUserAccess');
  expect(names).toContain('master.setModuleContract');
  const count = getActions().length;
  bootstrapActions();                         // idempotente (não duplica)
  expect(getActions().length).toBe(count);
});
```

- [ ] **Step 2: Rodar — falha**

- [ ] **Step 3: Implementar** (importa cada módulo e registra; `registerAccessPermissions` para o catálogo)

```ts
// src/core/actions/bootstrap.ts
import { registerActions, getAction } from './registry';
import { registerAccessPermissions } from '@/core/rbac/catalog';
import { coreActions, coreAccessPermissions } from '@/modules/core';
// + futuros módulos do Eixo 2: import { operacionalActions } from '@/modules/operacional' ...

const ALL_ACTIONS = [...coreActions /*, ...operacionalActions */];
const ALL_ACCESS_PERMS = [...coreAccessPermissions];

let done = false;
export function bootstrapActions(): void {
  if (done) return;
  // só registra os ainda ausentes (idempotente em dev/HMR)
  registerActions(ALL_ACTIONS.filter((a) => !getAction(a.name)));
  registerAccessPermissions(ALL_ACCESS_PERMS);
  done = true;
}
```

> Chamado uma vez no boot da app (ex.: em `instrumentation.ts` do Next ou no entrypoint do Worker). Documentar no plano de integração de runtime (W4).

- [ ] **Step 4: Rodar — passa + commit**

Run: `npm test -- src/core/actions/__tests__/bootstrap.test.ts` → Expected: PASS.
```bash
git add src/core/actions/bootstrap.ts src/core/actions/__tests__/bootstrap.test.ts
git commit -m "feat(actions): bootstrap deterministico do registry (Core)"
```

---

### Task 4: Integrar seed (incl. role `Agente`) na criação de clínica

**Files:**
- Modify: `src/core/rbac/seed.ts` (adicionar role `Agente`)
- Create: `src/modules/core/services/clinic-provisioning.ts`

- [ ] **Step 1: Adicionar o role `Agente` ao seed** — em `seedRbacForClinic`, incluir um preset extra de sistema:

```ts
// em src/core/rbac/seed.ts, dentro de seedRbacForClinic, junto aos presets:
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from './agent-access';
// ...
const presets = [
  { name: RESERVED_ROLE_OWNER, description: 'Dono da clínica.', keys: catalog.map((p) => p.key) },
  { name: AGENT_ROLE_NAME, description: 'Agente de IA (autônomo).', keys: DEFAULT_AGENT_PERMISSIONS },
  ...SYSTEM_PRESETS.map((p) => ({ name: p.name, description: p.description, keys: buildPresetPermissions(p) })),
];
```

- [ ] **Step 2: Serviço de provisionamento de clínica** (cria clínica + seed)

```ts
// src/modules/core/services/clinic-provisioning.ts
import { getDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import { seedRbacForClinic } from '@/core/rbac/seed';

export async function provisionClinic(data: { name: string; slug: string; phone: string; email: string }) {
  const db = getDb();
  const [clinic] = await db.insert(clinics).values(data).returning({ id: clinics.id });
  await seedRbacForClinic(clinic.id);   // presets + Owner + Agente
  return clinic;
}
```

- [ ] **Step 3: Atualizar o teste do seed** (W3.2) para esperar o role `Agente`

Adicionar em `src/core/rbac/__tests__/seed.test.ts` um caso que verifica que `Agente` está entre os presets construídos (via lista de nomes). Rodar `npm test -- src/core/rbac`.

- [ ] **Step 4: Commit**

```bash
git add src/core/rbac/seed.ts src/modules/core/services/clinic-provisioning.ts src/core/rbac/__tests__/seed.test.ts
git commit -m "feat(core): provisionamento de clinica com seed RBAC (incl. role Agente)"
```

---

### Task 5: Lint de fronteira entre módulos

**Files:**
- Modify/Create: config ESLint (`eslint.config.mjs` ou `.eslintrc.json`)
- Add dev dep: `eslint-plugin-boundaries`

- [ ] **Step 1: Instalar o plugin**

Run: `npm i -D eslint-plugin-boundaries`

- [ ] **Step 2: Configurar a regra** — elementos: `core` (infra, livre), `modules` (cada um isolado). Regra: um módulo só importa o `index.ts` de outro; `@/core/*` é permitido a todos.

```js
// trecho a adicionar na config ESLint
settings: {
  'boundaries/elements': [
    { type: 'core', pattern: 'src/core/*' },
    { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
  ],
},
rules: {
  'boundaries/element-types': ['error', {
    default: 'allow',
    rules: [
      // módulo não pode importar internals de OUTRO módulo (só o index)
      { from: ['module'], disallow: [['module', { name: '!${from.name}' }]],
        message: 'Importe apenas a interface pública (index.ts) de outro módulo.' },
    ],
  }],
},
```

> Ajustar a sintaxe ao formato de config em uso (flat `eslint.config.mjs` vs `.eslintrc.json`). O importante: **falhar** import cross-module que não passe pelo `index`.

- [ ] **Step 2b: Regra anti-DB-em-client (absorve o W2)**

Impedir que componentes client toquem o banco. Adicionar um override para arquivos client proibindo importar DB/repositories diretamente:

```js
// override por arquivo client (ajustar ao formato da config)
{
  files: ['src/**/*.tsx'],
  // aplica a arquivos com 'use client' — usar no-restricted-imports
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: '@/lib/db/client', message: 'Componentes não acessam o banco. Use uma Server Action/route handler.' },
      ],
      patterns: [
        { group: ['@/lib/db/*', '@/repositories/*'], message: 'Acesso a dados só via Action/service no servidor.' },
      ],
    }],
  },
}
```
> A meta "client não toca DB" já está cumprida (W1); esta regra **previne regressão**. Se o ESLint distinguir `'use client'` for difícil no flat config, aplicar a regra a `src/components/**` e `src/app/**/page.tsx`/`*.client.tsx` e validar com o gate de typecheck/lint.

- [ ] **Step 3: Verificar que o lint roda e a regra existe**

Run: `npm run lint` → Expected: exit 0 (Core ainda não viola). Criar um teste manual de violação temporário para confirmar que a regra dispara, depois remover.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json eslint.config.* .eslintrc.json 2>/dev/null
git commit -m "chore(lint): regra de fronteira entre modulos (boundaries)"
```

---

### Task 6: Verificação final da fase

- [ ] **Step 1: Typecheck** → `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
- [ ] **Step 2: Suítes** → `npm test -- src/core src/modules` → Expected: PASS.
- [ ] **Step 3: Lint** → `npm run lint` → Expected: exit 0.
- [ ] **Step 4: Commit final** → `git add -A && git commit -m "chore(core): baseline verde estrutura modular + Core (W3.4)"`

---

## Self-Review

**Spec coverage (§5):**
- Estrutura `src/modules/<m>/` + template → Tasks 1–2 ✓
- Core como módulo de referência (manifest, index, Actions de gestão) → Tasks 1–2 ✓
- Bootstrap determinístico (registerActions) → Task 3 ✓ (§2.3)
- Integração seed + role Agente na criação de clínica → Task 4 ✓ (§3.7)
- Lint de fronteira → Task 5 ✓ (§5.3)

**Placeholder scan:** sem TBD. Imports de módulos do Eixo 2 no bootstrap estão comentados como ponto de extensão (cada módulo se auto-registra ali quando criado). A sintaxe exata do lint depende do formato de config — instrução clara, não placeholder.

**Type consistency:** `coreActions`/`coreAccessPermissions`/`coreManifest` (Tasks 1–2) consumidos por `bootstrap.ts` (Task 3). `seedRbacForClinic` (W3.2) estendido na Task 4 com `AGENT_ROLE_NAME`/`DEFAULT_AGENT_PERMISSIONS` (W3.3). `defineAction` (W3.1) usado nas Actions.

**Dependência seguinte:** W3.5 (painel admin) consome `core.assignUserAccess`/`core.createRole` (via Server Actions) e o catálogo de permissões para montar a UI leiga. Integração de bootstrap no boot do runtime fica documentada para o W4.
