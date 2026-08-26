# ADR: Dashboard Guard — Client + Server (F4.07 DEFERRED)

> Decisão: `src/app/dashboard/layout.tsx` permanece `'use client'` com `useAuth` + `router.push('/login')` + `isDevBypass`, complementado por `src/lib/ui/dashboard-layout.tsx` + `ClinicSelector` e guards de rota `withModuleRoute`/`filterMenuByAccess`. Server `auth()` boundary é DEFERRED documentado, não bloqueia VERIFIED.

## Contexto
- Dashboard é 100% `'use client'` (sidebar, theme, ClinicSelector). `buildUserContext()` precisa DB (`resolveAccess` + manifesto) — não pode ser resolvido no client sem Server Action.
- `getVisibleCoreMenu`/`getVisibleMenu` (`src/lib/ui/menu-actions.ts:21`) já é Server Action que monta `buildUserContext()` + `buildMenu`/`filterMenuByAccess` e filtra por módulo + RBAC real. Sidebar consome via `useEffect` + `ICON_MAP`.
- `withModuleRoute`/`assertModuleForJob` já gateiam rotas API e jobs (`src/core/modules/gates.ts:10`).

## Decisão
- **Manter** `src/app/dashboard/layout.tsx:1` `'use client'` com guard client (`useAuth` + `loading` + `!user → router.push('/login')` + `null` enquanto `!profile`).
- **Server boundary DEFERRED**: `src/app/dashboard/layout.tsx` não faz `await auth()` direto para evitar refatorar 100% client-shell em tranche W4. Documentado como DEFERRED per ledger `F4.07 VERIFIED — client guard verified, server boundary documented as DEFERRED per ADR`.
- **Compensação**: `getVisibleCoreMenu` Server Action + `withModuleRoute` em todas as rotas `/api/*` de módulos contratáveis garantem que página protegida nunca dependa *apenas* de guard client-side para dados sensíveis.

## Alternativa descartada
- Converter `layout.tsx` para `async ServerComponent` com `const session = await auth(); if (!session) redirect('/login')` — quebraria `useTheme`/`useAuth`/`usePathname`/`localStorage` e exigiria rewrite do shell inteiro (risco W6). Deferido para pós-W6.

## Evidência
- `src/__tests__/security/manifest-paths.test.ts` 3/3 PASS (no stale `/dashboard/conversations`)
- `src/lib/ui/__tests__/sidebar-manifest.test.ts` 3/3 PASS (RBAC only from manifest)
- `src/core/modules/__tests__/gates.test.ts` PASS (`filterMenuByAccess`, `withModuleRoute` 404)
- `src/lib/ui/menu-actions.ts:21` `getVisibleMenu` Server Action (`try { buildUserContext } catch { return [] }`)

*ADR 2026-08-25 — F4.07 VERIFIED local, server guard DEFERRED sem bloquear W4.*
