# Phase 2: Core Components — Custom Synkroo Components

**Goal:** Criar todos os componentes customizados do design system Synkroo.

**Depends on:** Phase 1 (Foundation)

---

## Task 1: Create PageHeader Component

**Files:**
- Create: `src/components/ui/page-header.tsx`

- [ ] **Step 1: Create `src/components/ui/page-header.tsx`**

```tsx
import { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/page-header.tsx
git commit -m "feat: add PageHeader component"
```

---

## Task 2: Create StatusBadge Component

**Files:**
- Create: `src/components/ui/status-badge.tsx`

- [ ] **Step 1: Create `src/components/ui/status-badge.tsx`**

```tsx
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusType = "success" | "warning" | "error" | "info" | "teal" | "zinc"

const statusStyles: Record<StatusType, string> = {
  success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
}

interface StatusBadgeProps {
  status: StatusType
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export function StatusBadge({ status, children, className, dot = true }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-medium text-xs border px-2.5 py-0.5 rounded-md", statusStyles[status], className)}>
      {dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/status-badge.tsx
git commit -m "feat: add StatusBadge component with 6 status colors"
```

---

## Task 3: Create BackLink Component

**Files:**
- Create: `src/components/ui/back-link.tsx`

- [ ] **Step 1: Create `src/components/ui/back-link.tsx`**

```tsx
import Link from "next/link"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"

interface BackLinkProps {
  href: string
  label?: string
}

export function BackLink({ href, label = "Voltar" }: BackLinkProps) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/back-link.tsx
git commit -m "feat: add BackLink component"
```

---

## Task 4: Create StatCard Component (Premium)

**Files:**
- Create: `src/components/ui/stat-card.tsx`

- [ ] **Step 1: Create `src/components/ui/stat-card.tsx`**

This component has two variants: normal (with gradient strip) and inverted (teal background with dot pattern).

```tsx
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; label?: string }
  className?: string
  invert?: boolean
}

export function StatCard({ label, value, icon, trend, className, invert }: StatCardProps) {
  if (invert) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 p-5", className)}>
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/70 font-medium">{label}</p>
              <p className="text-3xl font-extrabold text-white tracking-tight mt-1">{value}</p>
            </div>
            {icon && <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">{icon}</div>}
          </div>
          {trend && (
            <div className="mt-3 flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded">
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              {trend.label && <span className="text-xs text-white/60">{trend.label}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl bg-card shadow-sm overflow-hidden", className)}>
      <div className="h-[3px] bg-gradient-to-r from-teal-600 via-teal-500 to-teal-400" />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-br from-teal-600 to-teal-400" />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          </div>
          {icon && (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 flex items-center justify-center relative">
              {icon}
              {trend && trend.value > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center">
                  <span className="text-[6px] text-white font-bold">&#8593;</span>
                </div>
              )}
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex-1 bg-muted rounded h-1.5 overflow-hidden">
              <div className="h-full rounded bg-gradient-to-r from-teal-600 to-teal-400"
                style={{ width: `${Math.min(Math.abs(trend.value) * 3, 100)}%` }} />
            </div>
            <div className="flex items-center gap-1">
              <span className={cn("text-xs font-bold", trend.value >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400")}>
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              {trend.label && <span className="text-[10px] text-muted-foreground">{trend.label}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/stat-card.tsx
git commit -m "feat: add StatCard premium component (normal + inverted)"
```

---

## Task 5: Create StatsGrid Component

**Files:**
- Create: `src/components/ui/stats-grid.tsx`

- [ ] **Step 1: Create `src/components/ui/stats-grid.tsx`**

```tsx
import { cn } from "@/lib/utils"
import { StatCard } from "@/components/ui/stat-card"

interface StatItem {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; label?: string }
  invert?: boolean
}

interface StatsGridProps {
  stats: StatItem[]
  columns?: 2 | 3 | 4 | 5
  className?: string
}

export function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {stats.map((stat, i) => (
        <StatCard key={i} {...stat} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/stats-grid.tsx
git commit -m "feat: add StatsGrid responsive grid component"
```

---

## Task 6: Create EmptyState Component

**Files:**
- Create: `src/components/ui/empty-state.tsx`

- [ ] **Step 1: Create `src/components/ui/empty-state.tsx`**

```tsx
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-2xl bg-card shadow-sm p-8 text-center", className)}>
      {icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 shadow-md shadow-teal-600/20">
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat: add EmptyState component with icon and CTA"
```

---

## Task 7: Create SearchInput Component

**Files:**
- Create: `src/components/ui/search-input.tsx`

- [ ] **Step 1: Create `src/components/ui/search-input.tsx`**

```tsx
"use client"

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = "Buscar...", className }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/search-input.tsx
git commit -m "feat: add SearchInput component"
```

---

## Task 8: Create FormPage Component

**Files:**
- Create: `src/components/ui/form-page.tsx`

- [ ] **Step 1: Create `src/components/ui/form-page.tsx`**

```tsx
import { ReactNode } from "react"
import { BackLink } from "@/components/ui/back-link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface FormPageProps {
  title: string
  backHref: string
  backLabel?: string
  children: ReactNode
  onSubmit?: () => void
  submitLabel?: string
  cancelHref?: string
  loading?: boolean
}

export function FormPage({ title, backHref, backLabel = "Voltar", children, onSubmit, submitLabel = "Salvar", cancelHref, loading = false }: FormPageProps) {
  return (
    <div>
      <BackLink href={backHref} label={backLabel} />
      <h1 className="text-xl font-bold tracking-tight text-foreground mb-6">{title}</h1>
      <Card className="p-6">
        <div className="space-y-4">{children}</div>
        {(onSubmit || cancelHref) && (
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            {cancelHref && <BackLink href={cancelHref} label="Cancelar" />}
            {onSubmit && (
              <Button onClick={onSubmit} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
                {loading ? "Salvando..." : submitLabel}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/form-page.tsx
git commit -m "feat: add FormPage container component"
```

---

## Task 9: Create DetailPage Component

**Files:**
- Create: `src/components/ui/detail-page.tsx`

- [ ] **Step 1: Create `src/components/ui/detail-page.tsx`**

```tsx
import { ReactNode } from "react"
import { BackLink } from "@/components/ui/back-link"
import { StatusBadge } from "@/components/ui/status-badge"

interface DetailPageProps {
  title: string
  backHref: string
  backLabel?: string
  status?: { type: "success" | "warning" | "error" | "info" | "teal" | "zinc"; label: string }
  actions?: ReactNode
  children: ReactNode
}

export function DetailPage({ title, backHref, backLabel = "Voltar", status, actions, children }: DetailPageProps) {
  return (
    <div>
      <BackLink href={backHref} label={backLabel} />
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {status && <StatusBadge status={status.type}>{status.label}</StatusBadge>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/detail-page.tsx
git commit -m "feat: add DetailPage container component"
```

---

## Task 10: Create FilterBar and DataTable Components

**Files:**
- Create: `src/components/ui/filter-bar.tsx`
- Create: `src/components/ui/data-table.tsx`

- [ ] **Step 1: Create `src/components/ui/filter-bar.tsx`**

```tsx
import { ReactNode } from "react"

interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return <div className={`flex items-center gap-3 flex-wrap ${className || ""}`}>{children}</div>
}
```

- [ ] **Step 2: Create `src/components/ui/data-table.tsx`**

```tsx
"use client"

import { ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  keyExtractor: (row: T) => string
}

export function DataTable<T>({ columns, data, loading = false, emptyMessage = "Nenhum resultado encontrado", keyExtractor }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>{columns.map((col) => <TableHead key={col.key} className={col.className}>{col.header}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{columns.map((col) => <TableCell key={col.key} className={col.className}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (data.length === 0) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((col) => <TableHead key={col.key} className={col.className}>{col.header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={keyExtractor(row)}>{columns.map((col) => <TableCell key={col.key} className={col.className}>{col.cell(row)}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/filter-bar.tsx src/components/ui/data-table.tsx
git commit -m "feat: add FilterBar and DataTable components"
```

---

## Phase 2 Complete

All custom design system components are ready:
- **Layout:** PageHeader, FormPage, DetailPage, BackLink, FilterBar
- **Data Display:** StatusBadge, StatCard, StatsGrid, EmptyState, DataTable
- **Inputs:** SearchInput
