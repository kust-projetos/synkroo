# W6 — Frontend base (shell modular + duplicações) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o frontend base coerente com a arquitetura modular: **menu/rotas dirigidos pelo manifesto + RBAC** (W3.3), **eliminar duplicações de rota** (configuração, stubs de pipeline/contatos, atividades/tarefas), e **firmar o padrão de página** sobre os componentes compartilhados que já existem. O **redesenho de domínio** (Contatos ↔ Leads ↔ Pacientes) NÃO é aqui — é o spec do módulo **E-04** (Eixo 2).

**Architecture:** O shell (`src/lib/ui/dashboard-layout.tsx` + `sidebar.tsx`) passa a montar o menu a partir dos `manifest.menu` dos módulos, filtrados por `filterMenuByAccess` (W3.3 — manifesto + permissão). Páginas duplicadas/mortas são consolidadas. Os componentes compartilhados (`data-table`, `form-page`, `detail-page`, `page-header`, `filter-bar`, etc.) **já existem** — o W6 documenta o padrão de uso; a migração de cada página para o padrão acontece quando o módulo é migrado no Eixo 2.

**Tech Stack:** Next 15 App Router, React 19, Tailwind + Radix, componentes `src/components/ui/*`.

**Spec:** roadmap-mestre §8 W6, §9.1 (CRM/Contatos é E-04).

**Pré-requisitos:** W3.3 (`filterMenuByAccess`, manifests dos módulos), W3.4 (módulo Core + manifests). Implementação do W3 desejável; a consolidação de duplicações (Task 1) pode rodar antes.

> **Escopo reduzido (achado do reconhecimento):** os componentes compartilhados já estão criados. O W6 **não os recria**. Foco: shell modular + limpeza de duplicações + guia de padrão.

---

## File Structure

- Modify: `src/lib/ui/sidebar.tsx`, `src/lib/ui/dashboard-layout.tsx` — menu por manifesto+RBAC.
- Create: `src/lib/ui/build-menu.ts` — monta o menu a partir dos manifests + `filterMenuByAccess`.
- Delete/Redirect: rotas duplicadas (decididas na Task 1).
- Create: `docs/frontend-padrao-pagina.md` — guia de padrão (lista/detalhe/form) com os componentes existentes.
- Tests: `src/lib/ui/__tests__/build-menu.test.ts`.

---

### Task 1: Consolidar duplicações de rota

**Contexto:** duplicações confirmadas — `configuracao/`(146) vs `configuracoes/`(449); `contatos/`(stub 18) + `crm/` + `pipeline/`(stub 5); `atividades/`(224) vs `tarefas/`(397).

- [ ] **Step 1: Determinar a rota viva de cada par** (a referenciada pelo menu/links; a outra é morta)

Run:
```bash
rg -n "dashboard/(configuracao|configuracoes|atividades|tarefas|contatos|pipeline|crm)" src/lib/ui src/app src/components \
  --glob '!**/graphify-out/**' -o | sort | uniq -c | sort -rn
```
Expected: contagem de referências por rota → a com referências do menu é a viva.

- [ ] **Step 2: Resolver `configuracao` vs `configuracoes`** — manter a referenciada pelo menu (provável `configuracoes`, maior/mais completa); deletar a morta. Se ambas referenciadas, redirecionar a antiga para a nova (`redirect()` em `page.tsx`).

- [ ] **Step 3: Resolver `pipeline`(stub) e `contatos`(stub)** — `pipeline/` (5 LOC) redireciona para `crm/pipeline`; `contatos/` (stub) — como o modelo Contatos é decidido no **E-04**, deixar um redirect temporário para a rota viva atual (`crm` ou `leads`) **ou** remover do menu e adiar a página; **não** redesenhar aqui.

- [ ] **Step 4: Resolver `atividades` vs `tarefas`** — investigar conteúdo; manter a viva, redirecionar/remover a outra. Registrar a decisão no commit.

- [ ] **Step 5: Verificar** que nenhum link do menu aponta para rota removida (atualizar `sidebar.tsx`); `npx tsc --noEmit` verde; navegação manual não quebra.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ui): consolida rotas duplicadas (config, stubs, atividades/tarefas)"
```

---

### Task 2: Menu/rotas dirigidos por manifesto + RBAC

**Files:**
- Create: `src/lib/ui/build-menu.ts`
- Modify: `src/lib/ui/sidebar.tsx`
- Test: `src/lib/ui/__tests__/build-menu.test.ts`

- [ ] **Step 1: Teste (falha)** — o menu vem dos manifests dos módulos, filtrado por manifesto+permissão.

```ts
// src/lib/ui/__tests__/build-menu.test.ts
import { buildMenu } from '../build-menu';

const manifests = [
  { id: 'core', menu: [{ moduleId: 'core', permission: 'core:manage_users', label: 'Acessos', path: '/x' }] },
  { id: 'financeiro', menu: [{ moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro', path: '/f' }] },
];
const manifest = { isEnabled: async (m: string) => m === 'core' };  // financeiro off

it('builds menu only from enabled modules the user can access', async () => {
  const menu = await buildMenu(manifests, manifest, (k) => k === 'core:manage_users');
  expect(menu.map((i) => i.label)).toEqual(['Acessos']);
});
```

- [ ] **Step 2: Rodar — falha** → `npm test -- src/lib/ui/__tests__/build-menu.test.ts`

- [ ] **Step 3: Implementar** (reusa `filterMenuByAccess` do W3.3)

```ts
// src/lib/ui/build-menu.ts
import { filterMenuByAccess, type MenuItem } from '@/core/modules/gates';

interface ModuleManifestLike { id: string; menu: MenuItem[]; }
interface ManifestLike { isEnabled(id: string): Promise<boolean>; }

export async function buildMenu(
  manifests: ModuleManifestLike[], manifest: ManifestLike, can: (key: string) => boolean,
): Promise<MenuItem[]> {
  const all = manifests.flatMap((m) => m.menu);
  return filterMenuByAccess(all, manifest, can);
}
```

- [ ] **Step 4: Integrar no `sidebar.tsx`** — o layout (Server Component) monta `ctx = buildUserContext()`, coleta os manifests dos módulos registrados, chama `buildMenu(...)`, e passa os itens ao `sidebar`. Itens estáticos atuais migram para os `manifest.menu` dos respectivos módulos (Core já tem; demais ganham ao migrar no Eixo 2).

- [ ] **Step 5: Rodar — passa + commit**

Run: `npm test -- src/lib/ui/__tests__/build-menu.test.ts` → Expected: PASS.
```bash
git add src/lib/ui/build-menu.ts src/lib/ui/sidebar.tsx src/lib/ui/dashboard-layout.tsx src/lib/ui/__tests__/build-menu.test.ts
git commit -m "feat(ui): menu dirigido por manifesto de modulos + RBAC"
```

---

### Task 3: Guia de padrão de página (sobre os componentes existentes)

**Files:**
- Create: `docs/frontend-padrao-pagina.md`

- [ ] **Step 1: Documentar os três padrões** usando os componentes que já existem:
  - **Lista:** `page-header` + `filter-bar`/`search-input` + `data-table` + `empty-state`/`ErrorState`/`skeleton`.
  - **Detalhe:** `detail-page` + `page-header` + `back-link` + `status-badge`.
  - **Formulário:** `form-page` + `input`/`select`/`textarea`/`switch` + Zod + Server Action chamando `runAction`.
  - **Mutações** sempre via Server Action → `runAction` (W3), nunca acesso a DB no client.

- [ ] **Step 2: Exemplo de referência** — apontar o painel de acessos (W3.5) como página-modelo (lista + form via Server Action). 

- [ ] **Step 3: Commit**

```bash
git add docs/frontend-padrao-pagina.md
git commit -m "docs(ui): guia de padrao de pagina (lista/detalhe/form) sobre componentes existentes"
```

> A **migração de cada página de domínio** para este padrão (e a remoção de duplicação de lógica) acontece **quando o módulo é migrado no Eixo 2** — não há um big-bang de reescrita aqui.

---

### Task 4: Verificação final

- [ ] **Step 1: Typecheck** → `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0`
- [ ] **Step 2: Testes** → `npm test -- src/lib/ui` → Expected: PASS.
- [ ] **Step 3: Lint** → `npm run lint` → Expected: exit 0 (incl. regra anti-DB-em-client do W3.4).
- [ ] **Step 4: Smoke** — menu mostra só módulos contratados + permitidos; rotas removidas não aparecem; navegação não quebra.
- [ ] **Step 5: Commit final** → `git add -A && git commit -m "chore(ui): baseline verde do frontend base (W6)"`

---

## Self-Review

**Spec coverage (§8 W6):**
- Unificar duplicações (config, stubs, atividades/tarefas) → Task 1 ✓
- Menu/rotas dirigidos por manifesto+RBAC → Task 2 ✓
- "Extrair DataTable/FormShell/DetailShell" → **já existem**; padrão documentado → Task 3 ✓ (escopo reduzido, registrado)
- Redesenho Contatos/Leads/Pacientes → **fora** (E-04, §9.1) ✓

**Placeholder scan:** Task 1 envolve decisões (qual rota é viva) resolvidas por investigação guiada (comando + critério), não TBD. Task 2/3 têm código + teste / conteúdo concreto.

**Type consistency:** `buildMenu` (Task 2) reusa `filterMenuByAccess`/`MenuItem` (W3.3). `manifest.menu` dos módulos segue o shape de `MenuItem` (W3.3) e do `coreManifest` (W3.4).

**Dependências:** Task 1 (limpeza) independe do W3. Task 2 depende de W3.3 (`filterMenuByAccess`) e W3.4 (manifests). A migração das páginas de domínio ao padrão fica no Eixo 2 — o W6 entrega o shell e o guia, não a reescrita de todas as telas.

**Fecha a fundação:** com W0–W6, a base modular está planejada ponta a ponta. O que resta é o **Eixo 2** — os módulos de domínio (E-01..E-08 + transversais), cada um com seu spec→plano, migrando ao template e adotando a Action Layer.
