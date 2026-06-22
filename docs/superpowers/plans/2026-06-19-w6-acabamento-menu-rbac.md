# W6 (acabamento) — Menu dirigido por RBAC real + `contatos` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Substituir o `can = () => true` hardcoded do menu (`sidebar.tsx:83`, `TODO(W7+)`) por verificação RBAC real, e resolver o item `contatos` pendente do W6 — fechando as duas pendências reais do W6.

**Architecture:** O dashboard é 100% `'use client'` (`app/dashboard/layout.tsx`, `lib/ui/dashboard-layout.tsx`, `lib/ui/sidebar.tsx`), então o `can` real (que precisa de DB via `resolveAccess` + manifesto) não pode ser resolvido no client. Abordagem de menor risco: uma **Server Action** (`getVisibleCoreMenu`) que monta `buildUserContext()` no servidor e devolve, já filtrado por `buildMenu`/`filterMenuByAccess`, só os itens do core que o usuário atual pode ver. O `sidebar.tsx` consome a action via `useEffect` e mapeia para seus `NavItem`. Sem refatorar o layout/auth client.

**Tech Stack:** Next.js Server Actions, React (client sidebar), Drizzle (via `buildUserContext`), Jest.

**Spec:** `docs/superpowers/plans/2026-06-19-revisao-fechamento-eixo1.md` (Bloco 1 item 3 + W6); auditoria W6; `docs/superpowers/plans/2026-06-17-w6-frontend-base.md` (Task 1 Step 3 `contatos`, Task 2 Step 4 menu). Componentes prontos reutilizados: `buildMenu` (`src/lib/ui/build-menu.ts`), `filterMenuByAccess` (`src/core/modules/gates.ts:23`), `buildUserContext` (`src/core/actions/context.ts:14`).

> **PRÉ-REQUISITO BLOQUEANTE:** o **Bloco 1** (`2026-06-19-fechamento-fundacao-rbac.md`) precisa estar concluído **antes** deste plano. Sem o seed de RBAC no signup, `resolveAccess` retorna `can:()=>false` para todos → o menu core sumiria até para o dono. Este plano assume que clínicas têm RBAC semeado e o dono tem acesso Owner.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/ui/menu-actions.ts` | Server Action: menu core filtrado por RBAC do usuário atual | Criar |
| `src/lib/ui/__tests__/menu-actions.test.ts` | Testa a filtragem por permissão | Criar |
| `src/lib/ui/sidebar.tsx` | Sidebar (client) | Modificar: consumir a action; remover `buildCoreNavItems`/`can=()=>true`; remover item `Contatos` |

---

## Task 1: Server Action `getVisibleCoreMenu`

**Files:**
- Create: `src/lib/ui/menu-actions.ts`
- Test: `src/lib/ui/__tests__/menu-actions.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/ui/__tests__/menu-actions.test.ts`:

```ts
import { getVisibleCoreMenu } from '../menu-actions';
import * as contextMod from '@/core/actions/context';
import * as manifestMod from '@/core/modules/manifest';
import type { ActionContext } from '@/core/actions/types';

jest.mock('@/core/actions/context');
jest.mock('@/core/modules/manifest');

function ctxWith(can: (k: string) => boolean): ActionContext {
  return {
    source: 'user', clinicId: 'c1',
    user: { id: 'u1', email: 'u@u', name: 'U' },
    can, hasModule: () => true, audit: { actor: 'u1' },
  };
}

beforeEach(() => {
  // manifesto: todos os módulos habilitados
  (manifestMod.makeManifest as jest.Mock).mockReturnValue({ isEnabled: async () => true });
  (manifestMod as { drizzleManifestRepo: unknown }).drizzleManifestRepo = {};
});

it('mostra ambos os itens do core para quem tem todas as permissões', async () => {
  (contextMod.buildUserContext as jest.Mock).mockResolvedValue(ctxWith(() => true));
  const menu = await getVisibleCoreMenu();
  const labels = menu.map((m) => m.label);
  expect(labels).toContain('Configurações');
  expect(labels).toContain('Usuários e acessos');
});

it('oculta "Usuários e acessos" para quem não tem core:manage_users', async () => {
  (contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k === 'core:view'),
  );
  const menu = await getVisibleCoreMenu();
  const labels = menu.map((m) => m.label);
  expect(labels).toContain('Configurações');
  expect(labels).not.toContain('Usuários e acessos');
});

it('retorna [] quando o usuário não está autenticado', async () => {
  (contextMod.buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'));
  const menu = await getVisibleCoreMenu();
  expect(menu).toEqual([]);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/ui/__tests__/menu-actions.test.ts 2>&1 | tail -15`
Expected: FAIL — `Cannot find module '../menu-actions'`.

- [ ] **Step 3: Implementar a Server Action**

Crie `src/lib/ui/menu-actions.ts`:

```ts
'use server';

import { buildUserContext } from '@/core/actions/context';
import { buildMenu } from '@/lib/ui/build-menu';
import { coreManifest } from '@/modules/core/manifest';
import { makeManifest, drizzleManifestRepo } from '@/core/modules/manifest';
import type { MenuItem } from '@/core/modules/gates';

/**
 * Retorna os itens de menu do módulo Core visíveis para o usuário atual,
 * já filtrados por RBAC (resolveAccess) + manifesto. Server-only: monta o
 * contexto no servidor. Em caso de não-autenticado/erro, retorna [] (o client
 * apenas não exibe os itens do core).
 */
export async function getVisibleCoreMenu(): Promise<MenuItem[]> {
  try {
    const ctx = await buildUserContext();
    return await buildMenu([coreManifest], makeManifest(drizzleManifestRepo), ctx.can);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/lib/ui/__tests__/menu-actions.test.ts 2>&1 | tail -10`
Expected: PASS (3 passed).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/menu-actions.ts src/lib/ui/__tests__/menu-actions.test.ts
git commit -m "feat(ui): server action getVisibleCoreMenu (menu core filtrado por RBAC real)"
```

---

## Task 2: Consumir a action no sidebar (remover `can=()=>true`)

**Files:**
- Modify: `src/lib/ui/sidebar.tsx`

- [ ] **Step 1: Adicionar o import da action e do hook**

Em `src/lib/ui/sidebar.tsx`, o `useState`/`useEffect` já são importados (linha 3). Adicione o import da action após os imports existentes (ex.: após a linha 9):

```ts
import { getVisibleCoreMenu } from "@/lib/ui/menu-actions"
```

- [ ] **Step 2: Remover a função `buildCoreNavItems`**

Apague o bloco inteiro `function buildCoreNavItems(...) { ... }` (linhas ~74-92, incluindo o comentário `TODO(W7+)`). Ela é substituída pelo estado populado via action.

- [ ] **Step 3: Substituir a montagem dos itens core em `SidebarContent`**

Em `SidebarContent` (linha ~182), troque:

```ts
  // Itens de menu vindos de coreManifest (W6 — menu modular).
  // Baseline: inclui todos os itens do core para usuário autenticado.
  // Futura migração: coletar manifests dos módulos registrados + filtrar por `can` via resolveAccess.
  const coreNavItems = buildCoreNavItems(profile ?? null)
```

por:

```ts
  // Itens de menu do Core, filtrados por RBAC real no servidor (W6 acabamento).
  const [coreNavItems, setCoreNavItems] = useState<NavItem[]>([])
  useEffect(() => {
    let active = true
    getVisibleCoreMenu()
      .then((items) => {
        if (!active) return
        setCoreNavItems(
          items.map((item) => ({
            name: item.label,
            href: (item.path as string) ?? `/${item.label}`,
            icon: ICON_MAP[item.icon as string] ?? Cog6ToothIcon,
            section: 'gestao' as const,
          })),
        )
      })
      .catch(() => { if (active) setCoreNavItems([]) })
    return () => { active = false }
  }, [])
```

O restante (`allNavItems`, render) permanece igual — já consome `coreNavItems`.

- [ ] **Step 4: Typecheck + unit + build**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npm test 2>&1 | tail -3` → Expected: `0 failed`
Run: `npm run build 2>&1 | tail -5` → Expected: build conclui (Server Action válida; sidebar compila).

- [ ] **Step 5: Verificação manual de comportamento (RBAC real)**

> Sem teste automatizado de render do `sidebar.tsx`: a árvore exige `ThemeProvider`/`AuthProvider`/`TooltipProvider`/`usePathname`, e a lógica de permissão já está coberta pelo teste da action (Task 1). Verificar a fiação manualmente:

```bash
npm run dev
```
- Logar como **dono (Owner)** → o menu mostra "Configurações" **e** "Usuários e acessos".
- Logar como usuário com perfil **Recepcionista** (sem `core:manage_users`) → o menu mostra "Configurações" mas **não** "Usuários e acessos".

Expected: o item "Usuários e acessos" some para quem não tem `core:manage_users`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/sidebar.tsx
git commit -m "feat(ui): sidebar consome menu core filtrado por RBAC (remove can=()=>true / TODO W7+)"
```

---

## Task 3: Resolver `contatos` (remover do menu)

**Files:**
- Modify: `src/lib/ui/sidebar.tsx:100`

**Contexto:** `Contatos` (`/dashboard/contatos`, página funcional `ContactSplitView`) ainda está linkada no menu, mas o redesenho do eixo CRM/Contatos é **deferido ao módulo E-04** (§9.1). Decisão (review): **remover do menu** (menos destrutivo que redirect; a página segue acessível por URL) até o E-04 decidir o modelo.

- [ ] **Step 1: Remover o item de menu `Contatos`**

Em `src/lib/ui/sidebar.tsx`, no array `navItems`, apague a linha:

```ts
  { name: "Contatos", href: "/dashboard/contatos", icon: UsersIcon, section: "crm" },
```

- [ ] **Step 2: Confirmar que não restou link órfão para `contatos`**

Run: `grep -rn "/dashboard/contatos" src/lib/ui src/components 2>/dev/null`
Expected: sem resultados (a página em `src/app/dashboard/contatos/` permanece, mas sem entrada de menu).

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npm run build 2>&1 | tail -3` → Expected: build conclui.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ui/sidebar.tsx
git commit -m "chore(ui): remove Contatos do menu (redesenho deferido ao E-04)"
```

---

## Self-Review

**Spec coverage (review §Bloco 1 item 3 + W6 pendências):**
- Menu com RBAC real (substituir `can=()=>true`) → Tasks 1+2 ✓
- `contatos` resolvido → Task 3 ✓
- Migração das páginas de domínio ao template / array `navItems` estático vir do manifesto → **deferido ao Eixo 2** (review §deferido), fora deste escopo.

**Placeholder scan:** sem TBD/TODO. O `TODO(W7+)` existente é **removido** na Task 2 Step 2. Código completo em cada step.

**Type consistency:** `getVisibleCoreMenu(): Promise<MenuItem[]>` (Task 1) consumida na Task 2 mapeando `item.label`/`item.path`/`item.icon` — compatível com `MenuItem` (`src/core/modules/gates.ts`: `{ moduleId; permission; label; [k]: unknown }`) e com `coreManifest.menu` (que tem `path`/`icon` string). `NavItem` (sidebar) e `ICON_MAP` reutilizados sem mudança de forma. `buildMenu([coreManifest], …)`: `coreManifest` satisfaz `ModuleWithMenu` (`{ id; menu }`).

**Dependências/risco:**
- **Bloqueante:** Bloco 1 concluído (RBAC semeado) — senão o menu core fica vazio para todos. Declarado no cabeçalho.
- Modo dev-mock (`NEXT_PUBLIC_USE_MOCKS=true`, sem sessão real): `buildUserContext()` lança → `getVisibleCoreMenu` retorna `[]` → itens do core não aparecem. Comportamento aceitável (modo mock é para UI sem DB); documentado aqui.
- `SidebarContent` renderiza em duas instâncias (desktop + mobile) → a action é chamada 2×. Custo desprezível; se virar problema, hoistar o fetch para um provider. YAGNI por ora.
