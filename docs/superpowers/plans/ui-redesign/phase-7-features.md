# Phase 7: Conversations, Analytics, Settings, Notifications

**Goal:** Migrar as funcionalidades especiais do dashboard: Conversas (split pane), Analytics (com Recharts), Configuracoes (settings form), e o sistema de notificacoes.

**Depends on:** Phase 4

---

## Task 1: Migrate Conversations Page

**Files:**
- Modify: `src/app/dashboard/conversas/page.tsx`

- [ ] **Step 1: Read current file**

```bash
wc -l src/app/dashboard/conversas/page.tsx
```

- [ ] **Step 2: Apply migration pattern**

The conversations page uses a split-pane layout (inbox list + message view).

Key changes:
- Header: `<PageHeader title="Conversas" description="Mensagens dos pacientes" />`
- Conversation list: Cards with avatar (green online indicator), message preview bubble, unread count badge (pill teal)
- Quick actions: "Responder" and "Agendar" buttons using `<Button variant="ghost">`
- Replace all color classes with theme-aware variants
- Use `<Avatar>` from shadcn/ui for user avatars
- Keep all message sending/receiving logic unchanged

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/conversas/page.tsx
git commit -m "feat: migrate conversations page to design system"
```

---

## Task 2: Migrate Analytics Page

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Apply migration pattern**

The analytics page already uses `useAnalytics` and `useROI` hooks. The rendering components were migrated in Phase 4.

Key changes:
- Header: `<PageHeader title="Analytics" description="Metricas e insights da clinica" />`
- Ensure all chart imports point to the new Recharts components from `src/components/charts/`
- Replace remaining stat cards with `<StatsGrid>`
- Replace `bg-white rounded-xl shadow-sm` with `<Card>`
- Update ROICard to use teal-based colors

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/analytics/page.tsx
git commit -m "feat: migrate analytics page to design system"
```

---

## Task 3: Migrate Settings Page

**Files:**
- Modify: `src/app/dashboard/configuracoes/page.tsx`

- [ ] **Step 1: Apply migration pattern**

Key changes:
- Header: `<PageHeader title="Configuracoes" description="Configuracoes da clinica" />`
- Settings cards: Use `<Card>` sections with `<Switch>` from shadcn/ui for notification toggles
- Form fields: Use shadcn/ui `<Input>`, `<Select>`, `<Button>`
- Save button: Use teal primary button style
- Notification preferences: Use `<Dialog>` with `<Switch>` for each of the 6 categories

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/configuracoes/page.tsx
git commit -m "feat: migrate settings page to design system"
```

---

## Task 4: Update Notification System

**Files:**
- Modify: `src/lib/ui/toast.tsx`
- Modify: Any files that import from `@/lib/ui/toast`

- [ ] **Step 1: Update ToastProvider to use shadcn/ui Toast**

The current `src/lib/ui/toast.tsx` has a custom ToastProvider with 4 types (success, error, warning, info).

Keep the `ToastProvider` export and API surface but update internally to use shadcn/ui `useToast` hook. Map the existing toast types:

```typescript
// In src/lib/ui/toast.tsx, update to use shadcn/ui internally

import { useToast as useShadcnToast } from "@/components/ui/use-toast"

export function useCustomToast() {
  const { toast } = useShadcnToast()

  return {
    success: (title: string, description?: string) =>
      toast({ title, description, className: "border-green-200 dark:border-green-800" }),
    error: (title: string, description?: string) =>
      toast({ title, description, variant: "destructive" }),
    warning: (title: string, description?: string) =>
      toast({ title, description, className: "border-amber-200 dark:border-amber-800" }),
    info: (title: string, description?: string) =>
      toast({ title, description, className: "border-blue-200 dark:border-blue-800" }),
  }
}
```

Keep `ToastProvider` as a re-export of the existing context for backwards compatibility during migration.

- [ ] **Step 2: Verify all toast usages still work**

```bash
grep -r "useToast\|addToast\|ToastProvider" src/ --include="*.tsx" --include="*.ts" | head -20
```

Ensure all imports resolve correctly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui/toast.tsx
git commit -m "feat: migrate notification toast to shadcn/ui"
```

---

## Phase 7 Complete

All feature pages migrated:
- Conversations with premium cards and avatars
- Analytics with Recharts and StatsGrid
- Settings with shadcn/ui form components
- Notification system using shadcn/ui Toast
