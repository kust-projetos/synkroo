# Phase 4: Dashboard Layout + Main Page + Analytics Charts

**Goal:** Atualizar o dashboard layout para suportar sidebar colapsável e tema, migrar a página principal do dashboard para usar os novos componentes premium, e migrar charts CSS-based para Recharts.

**Depends on:** Phase 1, 2, 3

---

## Task 1: Update Dashboard Layout

**Files:**
- Modify: `src/lib/ui/dashboard-layout.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Update `src/lib/ui/dashboard-layout.tsx`**

Current file uses: fixed sidebar width, `bg-gray-100`, `ChatWidget` with `primaryColor="#6366F1"`.
Replace to use: theme-aware background, new Sidebar component, ChatWidget without hardcoded primaryColor.

```tsx
"use client"

import { Sidebar, MobileSidebar } from "@/lib/ui/sidebar"
import { ChatWidget } from "@/lib/ui/chat-widget"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <MobileSidebar />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-xs">S</div>
            <span className="font-bold text-foreground">Synkroo</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  )
}
```

Note: The `ChatWidget` component may have different props than shown. Check the actual component signature in `src/lib/ui/chat-widget.tsx` and adapt accordingly. The key change is removing `primaryColor` prop so it uses CSS variables.

- [ ] **Step 2: Update `src/app/dashboard/layout.tsx`**

Current loading spinner uses `bg-gray-50` and `border-indigo-600`. Update to use theme colors:

```tsx
'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/lib/ui/dashboard-layout'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ui/dashboard-layout.tsx src/app/dashboard/layout.tsx
git commit -m "feat: update dashboard layout with collapsible sidebar and theme support"
```

---

## Task 2: Migrate Dashboard Main Page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update `src/app/dashboard/page.tsx`**

The current page has 6 stat cards with inconsistent colors (indigo, green, orange, purple, blue, teal) and emojis.
Replace with StatsGrid using StatCard/StatCardInverted and Heroicons.

Read the current page first to understand the exact data being displayed, then update to use the new components. Key changes:

1. Import `StatsGrid` and `StatCard` from `@/components/ui/stats-grid` and `@/components/ui/stat-card`
2. Replace individual stat card divs with `<StatsGrid>` component
3. Replace emojis with Heroicons (e.g., `UsersIcon`, `CalendarDaysIcon`, `CurrencyDollarIcon`, `ChatBubbleLeftRightIcon`)
4. Use `invert={true}` on the first stat card (patients) for the teal inverted variant
5. Replace `bg-white rounded-xl shadow-sm` cards with `<Card>` from shadcn/ui
6. Replace `text-gray-*` classes with semantic theme colors (`text-foreground`, `text-muted-foreground`)
7. Replace `bg-gray-50/bg-gray-100` with `bg-muted`
8. Update section headers to use consistent styling
9. Replace `+ Novo Agendamento` emoji button with Heroicon `PlusIcon`

The exact data fetching hooks and state management remain unchanged. Only the JSX rendering changes.

- [ ] **Step 2: Verify page loads**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/dashboard -o /dev/null -w "%{http_code}"
```

Expected: 200 (redirect to login if not authenticated, which is correct behavior)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: migrate dashboard page to premium stat cards and Heroicons"
```

---

## Task 3: Migrate Charts to Recharts

**Files:**
- Create: `src/components/charts/hourly-chart.tsx`
- Create: `src/components/charts/day-of-week-chart.tsx`
- Create: `src/components/charts/trends-chart.tsx`
- Modify: `src/lib/ui/analytics-charts.tsx` (update existing components to use new chart components)

- [ ] **Step 1: Create `src/components/charts/hourly-chart.tsx`**

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface HourlyData {
  hour: string
  consultas: number
}

interface HourlyChartProps {
  data: HourlyData[]
  loading?: boolean
}

export function HourlyChart({ data, loading }: HourlyChartProps) {
  if (loading) {
    return <div className="h-64 bg-muted rounded-xl animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Distribuicao por Horario</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Sem dados suficientes
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Distribuicao por Horario</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="consultas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((_, index) => (
                  <Cell key={index} fill="hsl(168, 84%, 39%)" className="fill-teal-600 dark:fill-teal-400" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `src/components/charts/day-of-week-chart.tsx`**

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DayOfWeekData {
  dia: string
  consultas: number
}

interface DayOfWeekChartProps {
  data: DayOfWeekData[]
  loading?: boolean
}

export function DayOfWeekChart({ data, loading }: DayOfWeekChartProps) {
  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Distribuicao por Dia da Semana</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Distribuicao por Dia da Semana</CardTitle></CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="dia" type="category" tick={{ fontSize: 12 }} width={40} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="consultas" fill="hsl(168, 84%, 39%)" radius={[0, 4, 4, 0]} maxBarSize={24} className="fill-teal-600 dark:fill-teal-400" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create `src/components/charts/trends-chart.tsx`**

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TrendData {
  date: string
  concluidos: number
  cancelados: number
  noShow: number
}

interface TrendsChartProps {
  data: TrendData[]
  loading?: boolean
}

export function TrendsChart({ data, loading }: TrendsChartProps) {
  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Tendencias (ultimos 14 dias)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tendencias (ultimos 14 dias)</CardTitle></CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="concluidos" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} name="Concluido" />
              <Bar dataKey="cancelados" stackId="a" fill="#f59e0b" name="Cancelado" />
              <Bar dataKey="noShow" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="No-show" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Update `src/lib/ui/analytics-charts.tsx`**

The existing file has `HourlyChart`, `DayOfWeekChart`, `TrendsChart`, `AnalyticsMetrics`, and `ROICard` using CSS-based charts.
Keep the hooks (`useAnalytics`, `useROI`) and data types unchanged. Replace only the rendering components to use the new Recharts-based chart components from `src/components/charts/`.

For `AnalyticsMetrics`, replace the stat cards with `<StatsGrid>` from the design system.

For `ROICard`, keep the card structure but update colors from indigo/green/blue/purple/orange to the new teal-based palette using semantic theme colors.

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/ src/lib/ui/analytics-charts.tsx
git commit -m "feat: migrate analytics charts from CSS to Recharts"
```

---

## Phase 4 Complete

The dashboard is now fully redesigned:
- Collapsible sidebar with theme support
- Premium stat cards with gradients
- Recharts-based analytics charts
- Theme-aware loading states
- Consistent design language throughout
