# Phase 6: Form & Detail Pages (14 pages)

**Goal:** Migrar todas as páginas de formulário e detalhe para usar os novos componentes do design system.

**Depends on:** Phase 4

---

## Migration Pattern for Form Pages

1. **Wrap in `<FormPage>`**: title, backHref, onSubmit, submitLabel
2. **Use shadcn/ui inputs**: `<Input>`, `<Select>`, `<Button>`
3. **Replace colors**: indigo -> teal, gray-* -> semantic theme colors
4. **Replace emojis with Heroicons**
5. **Keep all form state, validation, API calls unchanged**

## Migration Pattern for Detail Pages

1. **Wrap in `<DetailPage>`**: title, backHref, status, actions
2. **Use `<Card>` for sections**
3. **Use `<Tabs>` for tabbed content** (patient detail, etc.)
4. **Use `<StatusBadge>` for status**
5. **Replace hardcoded colors with theme-aware classes**

---

## Task 1: Migrate Patient Form Pages

**Files:**
- Modify: `src/app/dashboard/pacientes/novo/page.tsx`
- Modify: `src/app/dashboard/pacientes/[id]/editar/page.tsx`

- [ ] **Step 1: Migrate `pacientes/novo/page.tsx`**

Use `<FormPage>` wrapper. Replace individual form fields with shadcn/ui `<Input>`, `<Select>`. Keep all validation logic.

- [ ] **Step 2: Migrate `pacientes/[id]/editar/page.tsx`**

Same as novo but with pre-filled data. Use `<FormPage>` with `submitLabel="Atualizar"`.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/pacientes/novo/page.tsx src/app/dashboard/pacientes/[id]/editar/page.tsx
git commit -m "feat: migrate patient forms to design system"
```

---

## Task 2: Migrate Patient Detail Page

**Files:**
- Modify: `src/app/dashboard/pacientes/[id]/page.tsx`

- [ ] **Step 1: Migrate**

Use `<DetailPage>` with status badge. Use `<Tabs>` for Info/Consultas tabs. Use `<Card>` for info sections. Replace all color classes with theme-aware variants.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/pacientes/[id]/page.tsx
git commit -m "feat: migrate patient detail to design system"
```

---

## Task 3: Migrate Inactive Patients Page

**Files:**
- Modify: `src/app/dashboard/pacientes/inativos/page.tsx`

- [ ] **Step 1: Migrate**

Use `<PageHeader>`, `<StatsGrid>` for inactive stats, `<DataTable>` for patient list, `<Dialog>` for contact modal (replacing custom modal). Use `<StatusBadge status="warning">` for inactive status.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/pacientes/inativos/page.tsx
git commit -m "feat: migrate inactive patients to design system"
```

---

## Task 4: Migrate Appointment Form & Detail

**Files:**
- Modify: `src/app/dashboard/agendamentos/novo/page.tsx`
- Modify: `src/app/dashboard/agendamentos/[id]/page.tsx`

- [ ] **Step 1: Migrate appointment form**

Use `<FormPage>`. The form is complex (typeahead, time slots) — keep all the logic, only update the visual wrapper and input components.

- [ ] **Step 2: Migrate appointment detail**

Use `<DetailPage>` with status badge and edit action.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/agendamentos/novo/page.tsx src/app/dashboard/agendamentos/[id]/page.tsx
git commit -m "feat: migrate appointment form and detail to design system"
```

---

## Task 5: Migrate Campaign Pages

**Files:**
- Modify: `src/app/dashboard/campanhas/page.tsx`
- Modify: `src/app/dashboard/campanhas/nova/page.tsx`
- Modify: `src/app/dashboard/campanhas/[id]/page.tsx`

- [ ] **Step 1: Migrate campaign list**

Use `<PageHeader>`, campaign cards with metrics grid using the premium card pattern from the spec.

- [ ] **Step 2: Migrate campaign form**

Use `<FormPage>` with template editor. Keep all campaign logic.

- [ ] **Step 3: Migrate campaign detail**

Use `<DetailPage>` with `<StatsGrid>` for campaign metrics, segmented progress bar.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/campanhas/
git commit -m "feat: migrate campaign pages to design system"
```

---

## Task 6: Migrate Lead Form & Detail

**Files:**
- Modify: `src/app/dashboard/leads/novo/page.tsx`
- Modify: `src/app/dashboard/leads/[id]/page.tsx`

- [ ] **Step 1: Migrate lead form**

Use `<FormPage>`.

- [ ] **Step 2: Migrate lead detail**

Use `<DetailPage>` with score bar and temperature badge.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/leads/novo/page.tsx src/app/dashboard/leads/[id]/page.tsx
git commit -m "feat: migrate lead form and detail to design system"
```

---

## Task 7: Migrate Dentist Form & Detail

**Files:**
- Modify: `src/app/dashboard/dentistas/novo/page.tsx`
- Modify: `src/app/dashboard/dentistas/[id]/page.tsx`

- [ ] **Step 1: Migrate dentist form and detail**

Apply the same patterns as above.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/dentistas/novo/page.tsx src/app/dashboard/dentistas/[id]/page.tsx
git commit -m "feat: migrate dentist form and detail to design system"
```

---

## Task 8: Migrate Procedure Form & Detail

**Files:**
- Modify: `src/app/dashboard/procedimentos/novo/page.tsx`
- Modify: `src/app/dashboard/procedimentos/[id]/page.tsx`

- [ ] **Step 1: Migrate procedure form and detail**

Apply the same patterns as above.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/procedimentos/novo/page.tsx src/app/dashboard/procedimentos/[id]/page.tsx
git commit -m "feat: migrate procedure form and detail to design system"
```

---

## Phase 6 Complete

All 14 form and detail pages migrated:
- Consistent form layouts with FormPage
- Detail views with status badges and actions
- Theme-aware colors and components
- Heroicons replacing emojis
- shadcn/ui Dialog/Select/Inputs throughout
