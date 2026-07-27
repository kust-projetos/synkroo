# Synkroo UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar toda a interface do Synkroo para uma identidade visual Minimalista Premium com tema claro/escuro, sidebar colapsável, cards premium e design system com shadcn/ui.

**Architecture:** Substituir a camada visual (componentes, estilos, layout) mantendo toda a lógica de negócio intacta. shadcn/ui (Radix + Tailwind) como base do design system, next-themes para tema claro/escuro, Heroicons para ícones, Recharts para charts. CSS variables HSL para tokens de design.

**Tech Stack:** Next.js 15, Tailwind CSS 3.4, shadcn/ui (Radix), next-themes, @heroicons/react, Recharts 3.x, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-08-ui-redesign-design.md` (v1.1)

---

## File Structure

### New Files (to create)
```
src/
├── lib/
│   └── utils.ts                          # cn() helper (shadcn/ui)
├── components/
│   └── ui/                               # shadcn/ui components (installed via CLI)
│       ├── button.tsx
│       ├── input.tsx
│       ├── badge.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       ├── use-toast.ts
│       ├── tooltip.tsx
│       ├── avatar.tsx
│       ├── skeleton.tsx
│       ├── separator.tsx
│       ├── popover.tsx
│       ├── sheet.tsx
│       ├── switch.tsx
│       ├── page-header.tsx               # Custom: título + subtítulo + action
│       ├── stats-grid.tsx                # Custom: grid de stat cards
│       ├── data-table.tsx                # Custom: tabela com search/filters
│       ├── form-page.tsx                 # Custom: container de formulário
│       ├── detail-page.tsx               # Custom: container de detail
│       ├── back-link.tsx                 # Custom: navegação ← Voltar
│       ├── status-badge.tsx              # Custom: badge de status
│       ├── stat-card.tsx                 # Custom: card de métrica premium
│       ├── stat-card-inverted.tsx        # Custom: card teal invertido
│       ├── patient-card.tsx              # Custom: card de paciente
│       ├── appointment-card.tsx          # Custom: card de agendamento
│       ├── lead-card.tsx                 # Custom: card de lead
│       ├── campaign-card.tsx             # Custom: card de campanha
│       ├── conversation-card.tsx         # Custom: card de conversa
│       ├── empty-state.tsx              # Custom: estado vazio com CTA
│       ├── search-input.tsx             # Custom: input de busca
│       └── filter-bar.tsx               # Custom: barra de filtros
├── components/
│   └── charts/
│       ├── hourly-chart.tsx              # Recharts BarChart vertical
│       ├── day-of-week-chart.tsx         # Recharts BarChart horizontal
│       └── trends-chart.tsx             # Recharts BarChart stacked
├── components/
│   └── theme-provider.tsx               # next-themes wrapper
components.json                            # shadcn/ui config
```

### Modified Files (existing)
```
tailwind.config.ts                        # dark mode, new tokens, animate plugin
src/app/globals.css                       # HSL CSS variables light/dark
src/app/layout.tsx                        # suppressHydrationWarning
src/app/providers.tsx                     # ThemeProvider
src/lib/ui/sidebar.tsx                    # Complete rewrite (Heroicons, sections, collapse)
src/lib/ui/dashboard-layout.tsx           # Collapsible sidebar, theme-aware
src/app/dashboard/layout.tsx              # Theme-aware loading spinner
src/app/dashboard/page.tsx                # StatCard premium, StatsGrid
src/lib/ui/analytics-charts.tsx           # Recharts migration
src/lib/ui/toast.tsx                      # Replace with shadcn/ui Toast
src/app/login/page.tsx                    # Teal palette, premium card
src/app/page.tsx                          # Landing: Forest Dark gradient
# + 22 more dashboard pages (visual-only changes)
```

---

## Plan Files by Phase

| Phase | File | Description | Pages |
|-------|------|-------------|-------|
| 1 | `ui-redesign/phase-1-foundation.md` | shadcn/ui init, CSS vars, utils, ThemeProvider | — |
| 2 | `ui-redesign/phase-2-core-components.md` | Custom components (PageHeader, StatsGrid, etc.) | — |
| 3 | `ui-redesign/phase-3-sidebar.md` | Sidebar rewrite (Heroicons, sections, collapse) | — |
| 4 | `ui-redesign/phase-4-dashboard.md` | Dashboard layout + main page + analytics | 2 |
| 5 | `ui-redesign/phase-5-listings.md` | Listing pages (6 pages) | 6 |
| 6 | `ui-redesign/phase-6-forms-details.md` | Forms + detail pages (14 pages) | 14 |
| 7 | `ui-redesign/phase-7-features.md` | Conversations, Settings, Notifications | 3 |
| 8 | `ui-redesign/phase-8-auth-landing.md` | Auth, Landing, Chat Widget | 4 |

**Total: 8 phases, ~30 tasks, ~150 steps**

---

## Execution Order

```
Phase 1 (Foundation)
  ↓
Phase 2 (Core Components)
  ↓
Phase 3 (Sidebar)
  ↓
Phase 4 (Dashboard) ← first visible result
  ↓
Phase 5 (Listings) ← parallel possible
Phase 6 (Forms/Details) ← parallel possible
Phase 7 (Features) ← parallel possible
  ↓
Phase 8 (Auth/Landing/Chat)
```

Phases 5, 6, 7 can run in parallel after Phase 4 is complete.
