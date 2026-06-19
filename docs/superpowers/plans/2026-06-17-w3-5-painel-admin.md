# W3.5 — Painel de acessos (admin leigo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o painel onde o dono/admin (leigo) gerencia **usuários, acessos por clínica e perfis**, em **linguagem de negócio (zero jargão)**, consumindo as Core Actions (W3.4) via Server Actions e o catálogo de permissões agrupado por módulo.

**Architecture:** As mutações vão por **Server Actions** que chamam `runAction(coreAction, input, buildUserContext())` (W3.1/W3.3) — RBAC e auditoria automáticos. A tela de permissões se monta sozinha a partir do **catálogo agrupado por módulo** (rótulos `label` pt-BR). Componentes React focados e testáveis; páginas Next fazem só a montagem.

**Tech Stack:** Next 15 App Router (Server Actions), React 19, Tailwind + Radix, Zod, Jest + @testing-library/react.

**Spec:** spec do W3 (§3.6 painel leigo, §3.2 catálogo, §3.9 acesso por clínica).

**Pré-requisitos:** W3.1–W3.4 concluídos.

---

## File Structure

- Create: `src/core/rbac/grouped-catalog.ts` — agrupa permissões por módulo (para UI).
- Create: `src/modules/core/ui/actions.ts` — Server Actions (`'use server'`) do painel.
- Create: `src/modules/core/ui/PermissionMatrix.tsx` — módulos → funções (toggles).
- Create: `src/modules/core/ui/RoleForm.tsx`, `UserAccessForm.tsx` — formulários.
- Create: `src/app/dashboard/configuracoes/acessos/{page.tsx,perfis/page.tsx}` — páginas (gated).
- Tests: `src/core/rbac/__tests__/grouped-catalog.test.ts`, `src/modules/core/ui/__tests__/PermissionMatrix.test.tsx`.

---

### Task 1: Catálogo agrupado por módulo (para a UI)

**Files:**
- Create: `src/core/rbac/grouped-catalog.ts`
- Test: `src/core/rbac/__tests__/grouped-catalog.test.ts`

- [ ] **Step 1: Teste (falha)**

```ts
// src/core/rbac/__tests__/grouped-catalog.test.ts
import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { getGroupedCatalog } from '../grouped-catalog';

beforeEach(() => clearRegistry());

it('groups permissions by module with friendly labels', () => {
  registerActions([
    defineAction({ name: 'op.create', module: 'operacional', requires: 'operacional:create', label: 'Criar agendamento', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.cancel', module: 'operacional', requires: 'operacional:cancel', label: 'Cancelar agendamento', input: z.object({}), handler: async () => null }),
  ]);
  const groups = getGroupedCatalog();
  const op = groups.find((g) => g.module === 'operacional')!;
  expect(op.permissions.map((p) => p.label)).toEqual(['Criar agendamento', 'Cancelar agendamento']);
});
```

- [ ] **Step 2: Rodar — falha** → `npm test -- src/core/rbac/__tests__/grouped-catalog.test.ts`

- [ ] **Step 3: Implementar**

```ts
// src/core/rbac/grouped-catalog.ts
import { getPermissionCatalog, type PermissionEntry } from './catalog';

// Rótulo amigável por módulo (pt-BR). Default: capitaliza o id.
const MODULE_LABELS: Record<string, string> = {
  core: 'Configurações', operacional: 'Atendimento e agenda', comercial: 'Vendas',
  financeiro: 'Financeiro', campanhas: 'Campanhas', analytics: 'Relatórios',
};

export interface PermissionGroup { module: string; moduleLabel: string; permissions: PermissionEntry[]; }

export function getGroupedCatalog(): PermissionGroup[] {
  const byModule = new Map<string, PermissionEntry[]>();
  for (const p of getPermissionCatalog()) {
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module)!.push(p);
  }
  return [...byModule.entries()].map(([module, permissions]) => ({
    module, moduleLabel: MODULE_LABELS[module] ?? module, permissions,
  }));
}
```

- [ ] **Step 4: Rodar — passa + commit**

Run: `npm test -- src/core/rbac/__tests__/grouped-catalog.test.ts` → Expected: PASS.
```bash
git add src/core/rbac/grouped-catalog.ts src/core/rbac/__tests__/grouped-catalog.test.ts
git commit -m "feat(rbac): catalogo agrupado por modulo com rotulos pt-BR (UI)"
```

---

### Task 2: Server Actions do painel

**Files:**
- Create: `src/modules/core/ui/actions.ts`

- [ ] **Step 1: Implementar os wrappers** (`'use server'`, principal `user`)

```ts
// src/modules/core/ui/actions.ts
'use server';
import { runAction, buildUserContext } from '@/core/actions';
import { assignUserAccess } from '../actions/assign-user-access';
import { createRole } from '../actions/create-role';

export async function assignUserAccessAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(assignUserAccess, input, ctx);
}

export async function createRoleAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(createRole, input, ctx);
}
```

- [ ] **Step 2: Compilar + commit**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
```bash
git add src/modules/core/ui/actions.ts
git commit -m "feat(core): server actions do painel (assignUserAccess, createRole)"
```

---

### Task 3: Componente `PermissionMatrix` (módulos → funções)

**Files:**
- Create: `src/modules/core/ui/PermissionMatrix.tsx`
- Test: `src/modules/core/ui/__tests__/PermissionMatrix.test.tsx`

- [ ] **Step 1: Teste (falha)** — toggle de função e "ligar módulo inteiro".

```tsx
// src/modules/core/ui/__tests__/PermissionMatrix.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionMatrix } from '../PermissionMatrix';

const groups = [{
  module: 'operacional', moduleLabel: 'Atendimento e agenda',
  permissions: [
    { key: 'operacional:create', module: 'operacional', label: 'Criar agendamento' },
    { key: 'operacional:cancel', module: 'operacional', label: 'Cancelar agendamento' },
  ],
}];

it('toggles a single function and reflects selection', () => {
  const onChange = jest.fn();
  render(<PermissionMatrix groups={groups} selected={new Set()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Criar agendamento'));
  expect(onChange).toHaveBeenCalledWith(expect.any(Set));
  const arg = onChange.mock.calls[0][0] as Set<string>;
  expect(arg.has('operacional:create')).toBe(true);
});

it('module toggle selects all functions of the module', () => {
  const onChange = jest.fn();
  render(<PermissionMatrix groups={groups} selected={new Set()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Atendimento e agenda'));   // toggle do módulo
  const arg = onChange.mock.calls[0][0] as Set<string>;
  expect(arg.has('operacional:create')).toBe(true);
  expect(arg.has('operacional:cancel')).toBe(true);
});
```

- [ ] **Step 2: Rodar — falha** → `npm test -- src/modules/core/ui/__tests__/PermissionMatrix.test.tsx`

- [ ] **Step 3: Implementar**

```tsx
// src/modules/core/ui/PermissionMatrix.tsx
'use client';
import type { PermissionGroup } from '@/core/rbac/grouped-catalog';

interface Props {
  groups: PermissionGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function PermissionMatrix({ groups, selected, onChange }: Props) {
  const toggle = (key: string) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };
  const toggleModule = (g: PermissionGroup) => {
    const next = new Set(selected);
    const allOn = g.permissions.every((p) => next.has(p.key));
    g.permissions.forEach((p) => (allOn ? next.delete(p.key) : next.add(p.key)));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g.module} className="rounded-lg border p-3">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              aria-label={g.moduleLabel}
              checked={g.permissions.every((p) => selected.has(p.key))}
              onChange={() => toggleModule(g)}
            />
            {g.moduleLabel}
          </label>
          <div className="mt-2 grid gap-1 pl-6">
            {g.permissions.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={p.label}
                  checked={selected.has(p.key)}
                  onChange={() => toggle(p.key)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rodar — passa + commit**

Run: `npm test -- src/modules/core/ui/__tests__/PermissionMatrix.test.tsx` → Expected: PASS.
```bash
git add src/modules/core/ui/PermissionMatrix.tsx src/modules/core/ui/__tests__/PermissionMatrix.test.tsx
git commit -m "feat(core): PermissionMatrix (modulos->funcoes, toggle de modulo) — UI leiga"
```

---

### Task 4: Formulários e páginas do painel

**Files:**
- Create: `src/modules/core/ui/RoleForm.tsx`, `UserAccessForm.tsx`
- Create: `src/app/dashboard/configuracoes/acessos/page.tsx` (usuários), `.../acessos/perfis/page.tsx` (perfis)

- [ ] **Step 1: `RoleForm`** — nome + descrição + `PermissionMatrix`; ao salvar, chama `createRoleAction(clinicId, { name, description, permissionKeys: [...selected] })`. Mostra `ActionResult` (toast). Linguagem leiga.

- [ ] **Step 2: `UserAccessForm`** — seleciona usuário + (clínica, se houver >1) + perfil; chama `assignUserAccessAction`. Com 1 clínica, o seletor de clínica não aparece (§3.9).

- [ ] **Step 3: Páginas** — Server Components que:
  - Verificam acesso: `buildUserContext()` + `ctx.can('core:manage_users')`; sem permissão → redirect/403.
  - Carregam dados (usuários, perfis) via repositories e `getGroupedCatalog()`.
  - Renderizam os formulários. Rota protegida pelo gate de menu/rota do Core (`core` é `alwaysOn`).

- [ ] **Step 4: Verificar build das páginas**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add src/modules/core/ui/RoleForm.tsx src/modules/core/ui/UserAccessForm.tsx src/app/dashboard/configuracoes/acessos
git commit -m "feat(core): paginas do painel de acessos (usuarios e perfis)"
```

---

### Task 5: Verificação final da fase

- [ ] **Step 1: Typecheck** → `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
- [ ] **Step 2: Suítes** → `npm test -- src/core src/modules` → Expected: PASS.
- [ ] **Step 3: Lint** → `npm run lint` → Expected: exit 0.
- [ ] **Step 4: Smoke manual** (documentar): com `core` ativo e usuário `owner`, abrir `/dashboard/configuracoes/acessos`, criar um perfil "Recepção" ligando o módulo "Atendimento e agenda", atribuir a um usuário; confirmar via `action_logs` que as ações foram auditadas.
- [ ] **Step 5: Commit final** → `git add -A && git commit -m "chore(core): baseline verde do painel de acessos (W3.5) — fecha W3"`

---

## Self-Review

**Spec coverage (§3.6, §3.2, §3.9):**
- Catálogo agrupado por módulo com rótulos pt-BR → Task 1 ✓
- Mutações por Server Actions sobre as Core Actions (RBAC + auditoria automáticos) → Task 2 ✓
- UI de permissões módulos→funções + "ligar módulo inteiro" → Task 3 ✓
- Acesso por clínica (seletor some com 1 clínica) → Task 4 ✓ (§3.9)
- Zero jargão (rótulos `label`/`moduleLabel`, nada de `module:action` na tela) → Tasks 1/3/4 ✓

**Placeholder scan:** Tasks 4 descrevem formulários/páginas com contrato claro (quais Actions chamam, quais dados carregam, gate de acesso) em vez de código React extenso — apropriado para UI de montagem; os pontos com lógica (matriz, agrupamento, server actions) têm código + teste. Sem TBD.

**Type consistency:** `PermissionGroup`/`getGroupedCatalog` (Task 1) consumidos por `PermissionMatrix` (Task 3) e páginas (Task 4). `assignUserAccessAction`/`createRoleAction` (Task 2) consumidos por `UserAccessForm`/`RoleForm` (Task 4). Reusa `assignUserAccess`/`createRole` (W3.4), `buildUserContext`/`runAction` (W3.1/W3.3).

**Fecha o W3:** com W3.1–W3.5, a fundação modular está planejada ponta a ponta — Action Layer, RBAC multi-clínica, manifesto+gates, estrutura de módulos com Core, e o painel leigo. Próximo no roadmap: **W4 (runtime Cloudflare)** e o **Eixo 2** (módulos de domínio, cada um seguindo o template e a Action Layer).
