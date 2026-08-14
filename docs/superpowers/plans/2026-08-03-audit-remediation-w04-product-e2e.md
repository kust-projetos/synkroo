# Audit Remediation W4 Product and E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [x]`) syntax for tracking.

**Goal:** Corrigir rotas mortas, dados fictícios, mobile, acessibilidade e tornar E2E determinístico.

**Architecture:** UI apresenta estado real, vazio ou erro. Layout mobile usa navegação
lista→detalhe. E2E controla servidor, banco, rate limiter e storageState; setup falha cedo.

**Tech Stack:** React 19, Tailwind, Radix, TanStack Query, RTL, Playwright.

**Agent Orchestration:** Supervisor-Workers — dashboard, contatos e financeiro podem avançar em
paralelo; E2E inicia após contratos UI estabilizarem.

---

### Task 1: Remover rotas e links mortos

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/modules/ia/manifest.ts`
- Modify: `src/lib/ui/sidebar.tsx`
- Test: `src/lib/ui/__tests__/menu-actions.test.ts`
- E2E: `e2e/dashboard/sidebar-navigation.spec.ts`

- [x] **Step 1: escrever RED para todos os links internos publicados**

```ts
it.each(visibleMenuPaths)('%s resolves without accidental 404', async path => {
  const response = await authenticatedRequest(path)
  expect(response.status()).not.toBe(404)
})
```

- [x] **Step 2: confirmar 404 em `/api/docs` e `/dashboard/ia`**

```bash
npx playwright test e2e/dashboard/sidebar-navigation.spec.ts
```

- [x] **Step 3: remover links sem capability aprovada**

Landing remove `/api/docs` até documentação existir. Manifest IA aponta para rota real de
configuração ou omite item; não criar página vazia para satisfazer teste.

- [x] **Step 4: adicionar favicon/metadata somente se asset real existir**

```ts
export const metadata = {
  title: 'Synkroo',
  icons: { icon: '/favicon.ico' },
}
```

Criar asset original em `src/app/favicon.ico`; validar 200 e MIME.

- [x] **Step 5: testar e commit**

```bash
npm test -- src/lib/ui/__tests__/menu-actions.test.ts --runInBand
npx playwright test e2e/dashboard/sidebar-navigation.spec.ts
git add src/app/page.tsx src/app/favicon.ico src/modules/ia/manifest.ts src/lib/ui
git commit -m "fix: remove dead product navigation"
```

### Task 2: Tornar dashboard factual

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/lib/ui/dashboard-layout.tsx`
- Test: `src/app/dashboard/page.test.tsx`
- E2E: `e2e/dashboard/overview.spec.ts`

- [x] **Step 1: escrever RED para zero, vazio e desconectado**

```ts
it('renders zero confirmation rate without fallback', () => {
  renderDashboard({ metrics: { confirmationRate: 0 } })
  expect(screen.getByText('0%')).toBeVisible()
  expect(screen.queryByText('94%')).not.toBeInTheDocument()
})
```

- [x] **Step 2: confirmar RED em `confirmationRate || 94`**

```bash
npm test -- src/app/dashboard/page.test.tsx --runInBand
```

- [x] **Step 3: remover dados e status fabricados**

Usar `stats?.metrics.confirmationRate ?? 0`. WhatsApp/IA exibem estado da API; ausência vira
`Não configurado`. Tendências e atividades aparecem apenas com resposta real; vazio usa EmptyState.

- [x] **Step 4: corrigir contraste do CTA e status mobile**

Status no header não assume `IA Conectada`; usa badge neutro até health real. CTA respeita AA em
light/dark e possui foco visível.

- [x] **Step 5: snapshot, E2E e commit**

```bash
npm test -- src/app/dashboard/page.test.tsx --runInBand
npx playwright test e2e/dashboard/overview.spec.ts
git add src/app/dashboard/page.tsx src/lib/ui/dashboard-layout.tsx
git commit -m "fix: show truthful dashboard states"
```

### Task 3: Corrigir contatos em 360px

**Files:**
- Modify: `src/components/contacts/contact-split-view.tsx`
- Modify: `src/components/contacts/contact-list-panel.tsx`
- Modify: `src/components/contacts/contact-detail-panel.tsx`
- Test: `src/components/contacts/__tests__/contact-split-view.test.tsx`
- E2E: `e2e/crm/contacts-mobile.spec.ts`

- [x] **Step 1: escrever RED da navegação lista→detalhe**

```ts
it('shows one pane at a time on mobile', async () => {
  render(<ContactSplitView />, { viewport: { width: 360, height: 800 } })
  expect(screen.getByTestId('contact-list')).toBeVisible()
  await user.click(screen.getByText('Ana Souza'))
  expect(screen.getByTestId('contact-detail')).toBeVisible()
  expect(screen.queryByTestId('contact-list')).not.toBeVisible()
})
```

- [x] **Step 2: confirmar RED com split 35/65**

```bash
npm test -- contact-split-view.test.tsx --runInBand
```

- [x] **Step 3: implementar breakpoint sem duplicar estado**

Desktop mantém `PanelGroup`. Mobile renderiza lista ou detalhe a partir do mesmo `selectedContactId`.
Detalhe possui botão Voltar com foco restaurado ao item selecionado.

- [x] **Step 4: validar overflow, teclado e screenshot**

```bash
npx playwright test e2e/crm/contacts-mobile.spec.ts --project=authenticated
```

Asserts: `scrollWidth === clientWidth`, ação principal visível, tabs roláveis com nome acessível.

- [x] **Step 5: commit**

```bash
git add src/components/contacts e2e/crm/contacts-mobile.spec.ts
git commit -m "fix: make contacts usable on mobile"
```

### Task 4: Corrigir financeiro em 360px

**Files:**
- Modify: `src/components/financeiro/FinanceDashboard.tsx`
- Modify: `src/app/dashboard/financeiro/financeiro-client.tsx`
- Test: `src/components/financeiro/__tests__/FinanceDashboard.test.tsx`
- E2E: `e2e/finance-mobile.spec.ts`

- [x] **Step 1: escrever RED para cards/tabs responsivos**

```ts
it('renders KPI cards in one column on narrow viewports', () => {
  renderFinanceAtWidth(360)
  expect(screen.getByTestId('finance-kpis')).toHaveClass('grid-cols-1')
})
```

- [x] **Step 2: confirmar RED**

```bash
npm test -- src/components/financeiro/__tests__/FinanceDashboard.test.tsx --runInBand
```

- [x] **Step 3: aplicar reflow focado**

KPIs: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`. Tabs usam overflow horizontal intencional com
indicador e foco visível; conteúdo não recebe largura fixa.

- [x] **Step 4: executar unit/E2E e commit**

```bash
npm test -- src/components/financeiro --runInBand
npx playwright test e2e/finance-mobile.spec.ts
git add src/components/financeiro src/app/dashboard/financeiro e2e/finance-mobile.spec.ts
git commit -m "fix: reflow finance dashboard on mobile"
```

### Task 5: Corrigir header e acessibilidade crítica

**Files:**
- Modify: `src/lib/ui/dashboard-layout.tsx`
- Modify: `src/lib/ui/sidebar.tsx`
- Test: `src/lib/ui/__tests__/dashboard-layout.test.tsx`
- E2E: `e2e/accessibility-critical.spec.ts`

- [x] **Step 1: escrever RED para 360px e teclado**

```ts
it('keeps menu and current status visible at 360px', () => {
  renderDashboardLayoutAtWidth(360)
  expect(screen.getByRole('button', { name: /menu/i })).toBeVisible()
  expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth)
})
```

- [x] **Step 2: implementar truncamento e semântica**

Header usa `min-w-0`, label curta/ocultável e nenhum status falso. Sidebar Sheet recebe título,
focus trap e retorno de foco. Headings mantêm um `h1` por página.

- [x] **Step 3: validar contraste, labels e teclado**

```bash
npm test -- src/lib/ui/__tests__/dashboard-layout.test.tsx --runInBand
npx playwright test e2e/accessibility-critical.spec.ts
```

- [x] **Step 4: commit**

```bash
git add src/lib/ui e2e/accessibility-critical.spec.ts
git commit -m "fix: harden mobile header accessibility"
```

### Task 6: Tornar setup E2E fail-fast

**Files:**
- Modify: `e2e/global-setup.ts`
- Modify: `playwright.config.ts`
- Modify: `e2e/global-teardown.ts`
- Create: `e2e/auth/storage-state.spec.ts`

- [x] **Step 1: escrever RED para storageState vazio**

```ts
expect(authState.cookies.some(cookie =>
  cookie.name.endsWith('next-auth.session-token')
)).toBe(true)
```

- [x] **Step 2: remover catches que convertem falha em sucesso**

Setup chama login, exige response 200, cookie esperado e `/api/auth/session` autenticado antes de
salvar state. Qualquer falha lança erro com status, URL e body redigido.

- [x] **Step 3: impedir servidor reutilizado silenciosamente**

```ts
webServer: {
  command: 'npm run dev -- -p 3003',
  url: 'http://127.0.0.1:3003/api/health',
  reuseExistingServer: false,
}
```

Config usa `127.0.0.1` de forma consistente. Processo anterior na porta causa falha imediata.

- [x] **Step 4: separar setup de project dependency duplicada**

Escolher um mecanismo: `globalSetup` ou projeto `setup`, nunca ambos. Recomendado projeto setup com
`dependencies: ['setup']` e state versionado somente como artefato ignorado.

- [x] **Step 5: testar e commit**

```bash
npx playwright test e2e/auth/storage-state.spec.ts --workers=1
git add e2e/global-setup.ts e2e/global-teardown.ts e2e/auth/storage-state.spec.ts playwright.config.ts
git commit -m "test: fail fast when E2E auth setup breaks"
```

### Task 7: Isolar rate limiter e eliminar testes condicionais

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Modify: `playwright.config.ts`
- Modify: `e2e/calendar.spec.ts`
- Modify: `e2e/calendar/views.spec.ts`
- Modify: specs com `if (isVisible)` ou catch silencioso
- Test: `src/lib/__tests__/rate-limit.test.ts`

- [x] **Step 1: escrever RED para reset controlado em test env**

```ts
it('resets limiter only with test-only dependency', () => {
  limiter.hit('login')
  testLimiter.reset()
  expect(limiter.remaining('login')).toBe(limit)
})
```

- [x] **Step 2: injetar store de limiter; sem endpoint público de reset**

Produção usa store runtime; testes recebem store isolado por worker. Specs autenticadas reutilizam
storageState e não fazem login antes de cada teste.

- [x] **Step 3: substituir condicionais por expectativas explícitas**

```ts
const button = page.getByRole('button', { name: 'Profissionais', exact: true }).last()
await expect(button).toBeVisible()
await button.click()
```

- [x] **Step 4: executar auth/calendar duas vezes**

```bash
npx playwright test e2e/auth e2e/calendar --workers=1
npx playwright test e2e/auth e2e/calendar --workers=1
```

- [x] **Step 5: commit**

```bash
git add src/lib/rate-limit.ts src/lib/__tests__/rate-limit.test.ts e2e playwright.config.ts
git commit -m "test: isolate E2E auth and rate limiting"
```

### Task 8: Reconciliar documentação por evidência

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md`
- Modify: `docs/superpowers/audits/goal-ledger.md`
- Modify: ADRs afetados em `docs/adr/`
- Create: `docs/runbook-cloudflare-build.md`
- Create: `scripts/check-doc-links.mjs`

- [x] **Step 1: comparar claim com código/teste/artefato**

```bash
rg -n "implementado|concluído|fechado|PASS" docs/superpowers docs/adr
```

- [x] **Step 2: marcar apenas capability comprovada**

Fases futuras permanecem pendentes. ADR-BASE-05, 12 e 13 só mudam para implementado após auth,
audit e outbox verdes. Runbook registra WSL, comandos, bindings e rollback sem secrets.

- [x] **Step 3: validar links e trailing whitespace**

Criar `check-doc-links.mjs` para validar links locais Markdown; URL externa fica fora do scan.

```bash
git diff --check
node scripts/check-doc-links.mjs
```

- [x] **Step 4: commit**

```bash
git add docs scripts/check-doc-links.mjs
git commit -m "docs: reconcile remediation evidence"
```

### Task 9: Gate W4

```bash
npm run lint && npm run typecheck && npm test -- --runInBand
npm run test:integration && npm run test:security && npm run build
npm run test:e2e
npm run test:e2e
```

- [x] Zero falha, timeout, retry oculto ou storageState vazio.
- [x] Desktop 1440×900 e mobile 360×800 sem overflow nas jornadas críticas.
- [x] Nenhum link interno publicado retorna 404 acidental.
- [x] Snapshots focados revisados; sem snapshot maior que 50 linhas.
- [x] Review UX/a11y + correctness aprovado.


## Checkbox reconciliation (2026-08-14)

All planned implementation steps are marked complete because the corresponding wave was previously completed and its gates are recorded in the audit ledger. This reconciliation does not claim new execution of historical steps.

W4 product/E2E evidence is recorded in docs/superpowers/audits/2026-08-13-final-gate-results.json and the historical ledger; current candidate local gates are linked by the 2026-08-14 gate record.

Current-candidate follow-up: the fail-closed API/cron implementation migration, Stryker, OpenNext build, Wrangler dry-run, and startup check are tracked in docs/superpowers/audits/2026-08-14-final-gate-results.json.
