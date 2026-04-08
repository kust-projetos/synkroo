# Phase 5: Listing Pages (6 pages)

**Goal:** Migrar as 6 páginas de listagem para usar os novos componentes do design system.

**Depends on:** Phase 4

---

## Migration Pattern (all listing pages follow this)

For each page, the pattern is the same:

1. **Replace imports:** Add design system components, Heroicons
2. **Replace header:** Use `<PageHeader>` with title, description, and action button
3. **Replace stat cards:** Use `<StatsGrid>` if the page has stats
4. **Replace search/filters:** Use `<SearchInput>` and `<FilterBar>`
5. **Replace tables/lists:** Use `<DataTable>` or `<Card>` from shadcn/ui
6. **Replace colors:** `bg-white` -> `bg-card`, `text-gray-*` -> semantic theme colors, `shadow-sm` -> keep (shadcn pattern)
7. **Replace emojis:** Use Heroicons
8. **Replace status badges:** Use `<StatusBadge>`
9. **Replace empty states:** Use `<EmptyState>`
10. **Keep all business logic, hooks, state management, data fetching unchanged**

---

## Task 1: Migrate `/dashboard/pacientes` (Patient List)

**Files:**
- Modify: `src/app/dashboard/pacientes/page.tsx`

- [ ] **Step 1: Read current file**

```bash
wc -l src/app/dashboard/pacientes/page.tsx
```

- [ ] **Step 2: Apply migration pattern**

Replace visual elements using the pattern above. Keep all `useEffect`, `useState`, `fetch`, `supabase` calls unchanged.

Key changes:
- Header: `<PageHeader title="Pacientes" description="Gerencie seus pacientes" action={<Button>+ Novo Paciente</Button>} />`
- Search: `<SearchInput value={search} onChange={setSearch} />`
- Table: `<DataTable columns={columns} data={filteredPatients} keyExtractor={(p) => p.id} />`
- Status: `<StatusBadge status="teal">Ativo</StatusBadge>`
- Empty: `<EmptyState icon={<UsersIcon />} title="Nenhum paciente" action={...} />`

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/pacientes/page.tsx
git commit -m "feat: migrate patients listing to design system"
```

---

## Task 2: Migrate `/dashboard/agendamentos` (Appointments List)

**Files:**
- Modify: `src/app/dashboard/agendamentos/page.tsx`

- [ ] **Step 1: Apply migration pattern**

Key changes:
- Header: `<PageHeader title="Agendamentos" description="Gerencie suas consultas" action={<Button>+ Novo Agendamento</Button>} />`
- Filters: `<FilterBar>` with date/status selects using shadcn Select
- Appointment cards: Use `<Card>` with the premium appointment card style (date sidebar with teal gradient)
- Status: Map `confirmed/cancelled/pending/completed` to `<StatusBadge>` with appropriate colors

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/agendamentos/page.tsx
git commit -m "feat: migrate appointments listing to design system"
```

---

## Task 3: Migrate `/dashboard/leads` (Leads Pipeline)

**Files:**
- Modify: `src/app/dashboard/leads/page.tsx`

- [ ] **Step 1: Apply migration pattern**

Key changes:
- Header: `<PageHeader title="Leads" description="Gerencie seus leads" action={<Button>+ Novo Lead</Button>} />`
- Stats: `<StatsGrid>` with lead counts by temperature
- Lead cards: Left border with temperature gradient, score bar, badge (Quente/Morno/Frio)
- Status: Map lead temperatures to `<StatusBadge>` variants

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/leads/page.tsx
git commit -m "feat: migrate leads listing to design system"
```

---

## Task 4: Migrate `/dashboard/lista-espera` (Waitlist)

**Files:**
- Modify: `src/app/dashboard/lista-espera/page.tsx`

- [ ] **Step 1: Apply migration pattern**

Key changes:
- Header: `<PageHeader title="Lista de Espera" description="Pacientes aguardando agendamento" />`
- Stats: `<StatsGrid>` with waitlist counts
- Waitlist cards: Priority indicator (color-coded), preferred date/time, days waiting badge
- Status: `<StatusBadge>` for waitlist status

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/lista-espera/page.tsx
git commit -m "feat: migrate waitlist to design system"
```

---

## Task 5: Migrate `/dashboard/dentistas` (Dentists List)

**Files:**
- Modify: `src/app/dashboard/dentistas/page.tsx`

- [ ] **Step 1: Apply migration pattern**

Key changes:
- Header: `<PageHeader title="Dentistas" description="Equipe de profissionais" action={<Button>+ Novo Dentista</Button>} />`
- Table: `<DataTable>` with dentist info
- Search: `<SearchInput>`
- Status: `<StatusBadge>` for active/inactive dentists

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/dentistas/page.tsx
git commit -m "feat: migrate dentists listing to design system"
```

---

## Task 6: Migrate `/dashboard/procedimentos` (Procedures Grid)

**Files:**
- Modify: `src/app/dashboard/procedimentos/page.tsx`

- [ ] **Step 1: Apply migration pattern**

Key changes:
- Header: `<PageHeader title="Procedimentos" description="Tipos de procedimentos oferecidos" action={<Button>+ Novo Procedimento</Button>} />`
- Grid: Use `<Card>` for each procedure with consistent styling
- Replace any hardcoded colors with theme-aware classes

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/procedimentos/page.tsx
git commit -m "feat: migrate procedures to design system"
```

---

## Phase 5 Complete

All 6 listing pages now use the design system:
- Consistent headers with PageHeader
- Unified search/filter patterns
- DataTable or Card-based layouts
- StatusBadge for all status indicators
- EmptyState for zero-data scenarios
- Theme-aware colors throughout
