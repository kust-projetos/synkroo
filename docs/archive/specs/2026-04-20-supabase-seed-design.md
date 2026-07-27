# Supabase Connection + Seed Data

**Date:** 2026-04-20
**Status:** Approved
**Scope:** Connect calendar to real Supabase backend and populate with realistic BR dental clinic data

---

## Context

The calendar currently uses mock data (`generateMockEvents`) when `NEXT_PUBLIC_SUPABASE_URL` is not configured or the user has no `clinic_id`. The drag-and-drop calls `/api/appointments/[id]/reschedule` which fails on mock IDs, causing events to snap back.

**Goal:** Connect to a real Supabase project, create a demo clinic with realistic data, and enable full drag-and-drop + view testing.

---

## Approach

**Service Role Seed Script** (`scripts/seed-database.ts`)

A standalone TypeScript script using `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and insert data directly. Interactive setup for `.env.local` if not configured.

---

## Script Design

### File: `scripts/seed-database.ts`

**Runner:** `npx tsx scripts/seed-database.ts`

### Phase 1: Environment Setup

1. Check if `.env.local` exists with required vars
2. If missing, prompt interactively for:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Write to `.env.local`
4. Validate connection with a test query

### Phase 2: Create Clinic

- **Table:** `clinics`
- **Data:**
  - name: "Clinica Odonto Demo"
  - slug: "odonto-demo"
  - phone: "(11) 3456-7890"
  - email: "contato@odontodemo.com.br"
  - settings: `{ "business_hours": { "start": "08:00", "end": "18:00" } }`
- **Idempotency:** Check by slug before inserting

### Phase 3: Create Admin User

- **Supabase Auth:** `supabase.auth.admin.createUser()`
  - email: `admin@odontodemo.com.br`
  - password: `demo123456`
  - email_confirm: true
- **Table:** `users`
  - role: `owner`
  - clinic_id: from Phase 2
- **Idempotency:** Check by email before creating

### Phase 4: Create Dentists (4)

- **Table:** `dentists`
- **Data:**

| Name | Specialty | Phone | CRO |
|------|-----------|-------|-----|
| Dr. Maria Silva | Ortodontia | (11) 99999-0001 | CRO-SP 12345 |
| Dr. Joao Santos | Implantodontia | (11) 99999-0002 | CRO-SP 54321 |
| Dr. Ana Oliveira | Endodontia | (11) 99999-0003 | CRO-SP 67890 |
| Dr. Carlos Pereira | Clinico Geral | (11) 99999-0004 | CRO-SP 11111 |

### Phase 5: Create Procedures (12)

- **Table:** `procedures`
- **Data:**

| Name | Duration (min) | Price (R$) | Category |
|------|---------------|------------|----------|
| Limpeza (Profilaxia) | 30 | 150.00 | Preventiva |
| Obturacao (Restauracao) | 45 | 200.00 | Restauradora |
| Tratamento de Canal | 60 | 500.00 | Endodontia |
| Extracao Simples | 30 | 180.00 | Cirurgica |
| Extracao Siso | 60 | 400.00 | Cirurgica |
| Clareamento Dental | 45 | 800.00 | Estetica |
| Aparência de Aparelho (Consulta) | 30 | 300.00 | Ortodontia |
| Manutencao de Aparelho | 30 | 150.00 | Ortodontia |
| Implante Dentario (Consulta) | 45 | 350.00 | Implantodontia |
| Corona (Provisorio) | 45 | 400.00 | Restauradora |
| Raio-X Panoramico | 15 | 80.00 | Diagnostica |
| Consulta de Retorno | 15 | 0.00 | Consulta |

### Phase 6: Create Patients (~30)

- **Table:** `patients`
- **Data:** Brazilian names, SP phone numbers `(11) 9xxxx-xxxx`, some with email/Cpf
- **Variety:** Mix of genders, ages (birth_date), some with notes/tags
- **Idempotency:** Check by (clinic_id, phone) before inserting

### Phase 7: Create Appointments (~80)

- **Table:** `appointments`
- **Distribution:**
  - ~60% in current week (Mon-Fri, 08:00-18:00)
  - ~20% in past week (completed/cancelled/no_show)
  - ~20% in next week (scheduled/confirmed)
- **Status distribution:**
  - scheduled: 30%
  - confirmed: 25%
  - completed: 25%
  - cancelled: 10%
  - in_progress: 5%
  - no_show: 5%
- **Duration:** Match procedure duration_minutes
- **Constraints:** No overlapping appointments for same dentist in same time slot
- **Idempotency:** Delete existing appointments for clinic before seeding (clean slate)

### Phase 8: Create Schedule Blocks

- **Table:** `schedule_blocks`
- **Data:** Working hours for each dentist (Mon-Fri 08:00-12:00, 13:00-18:00, some with Saturday morning)

### Phase 9: Summary Output

Print to console:
- Clinic name + ID
- Admin credentials (email + password)
- Counts: patients, dentists, procedures, appointments
- Next steps: run `npm run dev` and login

---

## Technical Constraints

- **RLS bypass:** Use `createClient` with service role key and `auth: { autoRefreshToken: false, persistSession: false }` options
- **No overlapping appointments:** Script must check for conflicts before inserting
- **Timezone:** Use `America/Sao_Paulo` for generating appointment times (scheduled_at as TIMESTAMPTZ)
- **Dependencies:** `@supabase/supabase-js` (already installed), `tsx` for running TypeScript
- **Idempotency:** All inserts use check-before-insert or delete-then-insert pattern

---

## After Seeding

The calendar will automatically switch from mock to real data because:
1. `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` configured
2. User logs in with admin credentials
3. `useCalendarEvents` detects `clinicId` from profile
4. `useMock` evaluates to `false`
5. Real Supabase data flows through the same pipeline

---

## Success Criteria

- [ ] `.env.local` configured with valid Supabase credentials
- [ ] Demo clinic + admin user created and accessible via login
- [ ] 4 dentists appear in Professionals view
- [ ] ~80 appointments visible across Day/Week/Month views
- [ ] Drag-and-drop successfully reschedules appointments (persists after page refresh)
- [ ] No mock fallback triggered (console shows no `[supabase] ... called without config` warnings)
