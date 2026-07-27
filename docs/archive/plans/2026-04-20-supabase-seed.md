# Supabase Connection + Seed Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Synkroo calendar to a real Supabase project and populate it with realistic Brazilian dental clinic data for drag-and-drop testing.

**Architecture:** Single seed script (`scripts/seed-database.ts`) using Supabase service role key to bypass RLS. Interactive env setup if `.env.local` is missing. Idempotent — safe to re-run.

**Tech Stack:** TypeScript, `@supabase/supabase-js` (already installed), `npx tsx` as runner

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/seed-database.ts` | Main seed script — env setup, data insertion, summary |
| Create | `.env.local` | Supabase credentials (created interactively by script) |
| Modify | `package.json` | Add `seed` npm script |

---

### Task 1: Add `tsx` dependency and `seed` script to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add tsx as a dev dependency**

```bash
npm install -D tsx
```

- [ ] **Step 2: Add seed script to package.json**

Add to the `"scripts"` section:

```json
"seed": "npx tsx scripts/seed-database.ts"
```

- [ ] **Step 3: Verify tsx works**

```bash
npx tsx --version
```

Expected: version number printed (e.g., `4.x.x`)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tsx and seed script to package.json"
```

---

### Task 2: Create the seed script — environment setup and Supabase client

**Files:**
- Create: `scripts/seed-database.ts`

- [ ] **Step 1: Create the script file with env setup and client creation**

Create `scripts/seed-database.ts` with this content:

```typescript
// scripts/seed-database.ts
// Seed script for Synkroo — populates Supabase with realistic BR dental clinic data
// Usage: npm run seed

import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

// ── Types ────────────────────────────────────────────────────────
interface SeedContext {
  supabase: ReturnType<typeof createClient>
  clinicId: string
  adminUserId: string
  dentistIds: string[]
  procedureIds: string[]
  patientIds: string[]
}

// ── Environment Setup ────────────────────────────────────────────
const ENV_PATH = resolve(process.cwd(), '.env.local')

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function ensureEnvFile(): Promise<{ url: string; anonKey: string; serviceKey: string }> {
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, 'utf-8')
    const url = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
    const anonKey = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
    const serviceKey = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

    if (url && anonKey && serviceKey) {
      console.log('[env] .env.local found with all required variables.')
      return { url, anonKey, serviceKey }
    }
    console.log('[env] .env.local exists but is missing required variables.')
  }

  console.log('\n=== Supabase Configuration ===')
  console.log('Enter your Supabase project credentials.')
  console.log('Find them at: https://supabase.com/dashboard → Your Project → Settings → API\n')

  const url = await ask('NEXT_PUBLIC_SUPABASE_URL (e.g. https://xxx.supabase.co): ')
  const anonKey = await ask('NEXT_PUBLIC_SUPABASE_ANON_KEY: ')
  const serviceKey = await ask('SUPABASE_SERVICE_ROLE_KEY: ')

  if (!url || !anonKey || !serviceKey) {
    console.error('All three values are required. Exiting.')
    process.exit(1)
  }

  const envContent = [
    '# Supabase (auto-configured by seed script)',
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
    '',
  ].join('\n')

  writeFileSync(ENV_PATH, envContent, 'utf-8')
  console.log(`[env] Written to ${ENV_PATH}\n`)

  return { url, anonKey, serviceKey }
}

function createServiceRoleClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Logging helpers ──────────────────────────────────────────────
function log(phase: string, msg: string) {
  console.log(`[${phase}] ${msg}`)
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('=== Synkroo Database Seed ===\n')

  const { url, serviceKey } = await ensureEnvFile()
  const supabase = createServiceRoleClient(url, serviceKey)

  // Verify connection
  const { error: connErr } = await supabase.from('clinics').select('id').limit(1)
  if (connErr) {
    console.error('[error] Cannot connect to Supabase:', connErr.message)
    console.error('Check your credentials in .env.local')
    process.exit(1)
  }
  log('init', 'Connection verified.')

  // ── Phase 1: Clinic ───────────────────────────────────────────
  const clinicId = await seedClinic(supabase)

  // ── Phase 2: Admin User ───────────────────────────────────────
  const adminUserId = await seedAdminUser(supabase, clinicId)

  // ── Phase 3: Dentists ─────────────────────────────────────────
  const dentistIds = await seedDentists(supabase, clinicId)

  // ── Phase 4: Procedures ───────────────────────────────────────
  const procedureIds = await seedProcedures(supabase, clinicId)

  // ── Phase 5: Patients ─────────────────────────────────────────
  const patientIds = await seedPatients(supabase, clinicId)

  // ── Phase 6: Schedule Blocks ──────────────────────────────────
  await seedScheduleBlocks(supabase, clinicId, dentistIds)

  // ── Phase 7: Appointments ─────────────────────────────────────
  await seedAppointments(supabase, { supabase, clinicId, adminUserId, dentistIds, procedureIds, patientIds })

  // ── Summary ───────────────────────────────────────────────────
  printSummary(clinicId)
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})

// ── Placeholder functions — implemented in later tasks ───────────
// Each function is replaced by its full implementation in the task that defines it.
// The script is built incrementally: each task adds one function body.

async function seedClinic(supabase: ReturnType<typeof createClient>): Promise<string> {
  throw new Error('seedClinic not implemented yet')
}

async function seedAdminUser(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string> {
  throw new Error('seedAdminUser not implemented yet')
}

async function seedDentists(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string[]> {
  throw new Error('seedDentists not implemented yet')
}

async function seedProcedures(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string[]> {
  throw new Error('seedProcedures not implemented yet')
}

async function seedPatients(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string[]> {
  throw new Error('seedPatients not implemented yet')
}

async function seedScheduleBlocks(supabase: ReturnType<typeof createClient>, clinicId: string, dentistIds: string[]): Promise<void> {
  throw new Error('seedScheduleBlocks not implemented yet')
}

async function seedAppointments(supabase: ReturnType<typeof createClient>, ctx: SeedContext): Promise<void> {
  throw new Error('seedAppointments not implemented yet')
}

function printSummary(clinicId: string): void {
  throw new Error('printSummary not implemented yet')
}
```

- [ ] **Step 2: Verify the script compiles**

```bash
npx tsx scripts/seed-database.ts
```

Expected: Script prompts for credentials or starts connecting (will fail at `seedClinic` — that's expected at this stage)

- [ ] **Step 3: Commit**

```bash
mkdir -p scripts
git add scripts/seed-database.ts
git commit -m "feat(seed): add seed script scaffold with env setup"
```

---

### Task 3: Implement seedClinic and seedAdminUser

**Files:**
- Modify: `scripts/seed-database.ts` — replace the `seedClinic` and `seedAdminUser` placeholder functions

- [ ] **Step 1: Replace the seedClinic function**

Find the `seedClinic` placeholder and replace it with:

```typescript
async function seedClinic(supabase: ReturnType<typeof createClient>): Promise<string> {
  const SLUG = 'odonto-demo'

  // Check if clinic already exists
  const { data: existing } = await supabase
    .from('clinics')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle()

  if (existing) {
    log('clinic', `Clinic already exists (${existing.id}). Skipping.`)
    return existing.id
  }

  const { data, error } = await supabase
    .from('clinics')
    .insert({
      name: 'Clinica Odonto Demo',
      slug: SLUG,
      phone: '(11) 3456-7890',
      email: 'contato@odontodemo.com.br',
      settings: {
        business_hours: { start: '08:00', end: '18:00' },
        timezone: 'America/Sao_Paulo',
      },
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create clinic: ${error.message}`)

  log('clinic', `Created: Clinica Odonto Demo (${data.id})`)
  return data.id
}
```

- [ ] **Step 2: Replace the seedAdminUser function**

Find the `seedAdminUser` placeholder and replace it with:

```typescript
async function seedAdminUser(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string> {
  const ADMIN_EMAIL = 'admin@odontodemo.com.br'
  const ADMIN_PASSWORD = 'demo123456'

  // Check if user already exists in our users table
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('email', ADMIN_EMAIL)
    .maybeSingle()

  if (existing) {
    log('admin', `Admin user already exists (${existing.id}). Skipping.`)
    return existing.id
  }

  // Create auth user via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })

  if (authError) {
    // User might exist in auth but not in our users table
    if (authError.message.includes('already been registered')) {
      // List users to find the existing one
      const { data: userList } = await supabase.auth.admin.listUsers()
      const existingAuth = userList?.users?.find((u) => u.email === ADMIN_EMAIL)
      if (existingAuth) {
        // Insert into users table only
        const { data, error: insertErr } = await supabase
          .from('users')
          .insert({
            id: existingAuth.id,
            clinic_id: clinicId,
            email: ADMIN_EMAIL,
            name: 'Admin Demo',
            role: 'owner',
            phone: '(11) 99999-0000',
            is_active: true,
          })
          .select('id')
          .single()

        if (insertErr) throw new Error(`Failed to create user record: ${insertErr.message}`)
        log('admin', `Linked existing auth user to users table (${data.id})`)
        return data.id
      }
    }
    throw new Error(`Failed to create auth user: ${authError.message}`)
  }

  // Insert into users table
  const { data, error: insertErr } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      clinic_id: clinicId,
      email: ADMIN_EMAIL,
      name: 'Admin Demo',
      role: 'owner',
      phone: '(11) 99999-0000',
      is_active: true,
    })
    .select('id')
    .single()

  if (insertErr) throw new Error(`Failed to create user record: ${insertErr.message}`)

  log('admin', `Created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (${data.id})`)
  return data.id
}
```

- [ ] **Step 3: Verify script runs through phases 1-2**

```bash
npx tsx scripts/seed-database.ts
```

Expected: Creates clinic and admin user (then fails at `seedDentists` — expected)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-database.ts
git commit -m "feat(seed): implement clinic and admin user creation"
```

---

### Task 4: Implement seedDentists and seedProcedures

**Files:**
- Modify: `scripts/seed-database.ts` — replace the `seedDentists` and `seedProcedures` placeholder functions

- [ ] **Step 1: Replace the seedDentists function**

```typescript
async function seedDentists(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string[]> {
  const DENTISTS = [
    { name: 'Dr. Maria Silva', specialty: 'Ortodontia', phone: '(11) 99999-0001', email: 'maria@odontodemo.com.br', cro: 'CRO-SP 12345' },
    { name: 'Dr. Joao Santos', specialty: 'Implantodontia', phone: '(11) 99999-0002', email: 'joao@odontodemo.com.br', cro: 'CRO-SP 54321' },
    { name: 'Dr. Ana Oliveira', specialty: 'Endodontia', phone: '(11) 99999-0003', email: 'ana@odontodemo.com.br', cro: 'CRO-SP 67890' },
    { name: 'Dr. Carlos Pereira', specialty: 'Clinico Geral', phone: '(11) 99999-0004', email: 'carlos@odontodemo.com.br', cro: 'CRO-SP 11111' },
  ]

  // Check existing
  const { data: existing } = await supabase
    .from('dentists')
    .select('id, name')
    .eq('clinic_id', clinicId)

  if (existing && existing.length >= DENTISTS.length) {
    log('dentists', `${existing.length} dentists already exist. Skipping.`)
    return existing.map((d) => d.id)
  }

  // Clean slate for this clinic's dentists
  if (existing && existing.length > 0) {
    await supabase.from('dentists').delete().eq('clinic_id', clinicId)
  }

  const inserts = DENTISTS.map((d) => ({
    clinic_id: clinicId,
    name: d.name,
    specialty: d.specialty,
    phone: d.phone,
    email: d.email,
    cro: d.cro,
    is_active: true,
    working_hours: {
      mon: { start: '08:00', end: '12:00', resume: '13:00', close: '18:00' },
      tue: { start: '08:00', end: '12:00', resume: '13:00', close: '18:00' },
      wed: { start: '08:00', end: '12:00', resume: '13:00', close: '18:00' },
      thu: { start: '08:00', end: '12:00', resume: '13:00', close: '18:00' },
      fri: { start: '08:00', end: '12:00', resume: '13:00', close: '18:00' },
      sat: { start: '08:00', end: '12:00' },
    },
  }))

  const { data, error } = await supabase
    .from('dentists')
    .insert(inserts)
    .select('id')

  if (error) throw new Error(`Failed to create dentists: ${error.message}`)

  log('dentists', `Created ${data.length} dentists: ${DENTISTS.map((d) => d.name).join(', ')}`)
  return data.map((d) => d.id)
}
```

- [ ] **Step 2: Replace the seedProcedures function**

```typescript
async function seedProcedures(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string[]> {
  const PROCEDURES = [
    { name: 'Limpeza (Profilaxia)', duration_minutes: 30, price: 150.00, category: 'Preventiva', description: 'Limpeza profissional e profilaxia dental' },
    { name: 'Obturacao (Restauracao)', duration_minutes: 45, price: 200.00, category: 'Restauradora', description: 'Restauracao com material composto' },
    { name: 'Tratamento de Canal', duration_minutes: 60, price: 500.00, category: 'Endodontia', description: 'Tratamento endodontico completo' },
    { name: 'Extracao Simples', duration_minutes: 30, price: 180.00, category: 'Cirurgica', description: 'Extracao dental simples' },
    { name: 'Extracao Siso', duration_minutes: 60, price: 400.00, category: 'Cirurgica', description: 'Extracao de dente siso' },
    { name: 'Clareamento Dental', duration_minutes: 45, price: 800.00, category: 'Estetica', description: 'Clareamento profissional' },
    { name: 'Avaliacao Ortodontica', duration_minutes: 30, price: 300.00, category: 'Ortodontia', description: 'Consulta inicial para aparelho' },
    { name: 'Manutencao de Aparelho', duration_minutes: 30, price: 150.00, category: 'Ortodontia', description: 'Ajuste e manutencao de aparelho' },
    { name: 'Consulta Implante', duration_minutes: 45, price: 350.00, category: 'Implantodontia', description: 'Avaliacao para implante dentario' },
    { name: 'Coroa Provisoria', duration_minutes: 45, price: 400.00, category: 'Restauradora', description: 'Colocacao de coroa provisoria' },
    { name: 'Raio-X Panoramico', duration_minutes: 15, price: 80.00, category: 'Diagnostica', description: 'Raio-X panoramico completo' },
    { name: 'Consulta de Retorno', duration_minutes: 15, price: 0.00, category: 'Consulta', description: 'Consulta de retorno pos-procedimento' },
  ]

  // Check existing
  const { data: existing } = await supabase
    .from('procedures')
    .select('id')
    .eq('clinic_id', clinicId)

  if (existing && existing.length >= PROCEDURES.length) {
    log('procedures', `${existing.length} procedures already exist. Skipping.`)
    return existing.map((p) => p.id)
  }

  if (existing && existing.length > 0) {
    await supabase.from('procedures').delete().eq('clinic_id', clinicId)
  }

  const inserts = PROCEDURES.map((p) => ({
    clinic_id: clinicId,
    name: p.name,
    description: p.description,
    duration_minutes: p.duration_minutes,
    price: p.price,
    category: p.category,
    is_active: true,
  }))

  const { data, error } = await supabase
    .from('procedures')
    .insert(inserts)
    .select('id')

  if (error) throw new Error(`Failed to create procedures: ${error.message}`)

  log('procedures', `Created ${data.length} procedures`)
  return data.map((p) => p.id)
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-database.ts
git commit -m "feat(seed): implement dentists and procedures seeding"
```

---

### Task 5: Implement seedPatients

**Files:**
- Modify: `scripts/seed-database.ts` — replace the `seedPatients` placeholder function

- [ ] **Step 1: Replace the seedPatients function**

```typescript
async function seedPatients(supabase: ReturnType<typeof createClient>, clinicId: string): Promise<string[]> {
  const PATIENT_NAMES = [
    'Ana Paula Souza', 'Bruno Costa', 'Camila Rodrigues', 'Diego Ferreira',
    'Elena Martins', 'Fabio Almeida', 'Gabriela Lima', 'Henrique Nascimento',
    'Isabela Ribeiro', 'Joao Pedro Carvalho', 'Karina Santos', 'Lucas Oliveira',
    'Marina Silva', 'Nicolas Pereira', 'Olivia Gomes', 'Paulo Henrique Dias',
    'Rafaela Moreira', 'Samuel Rocha', 'Tatiana Barbosa', 'Vinicius Fernandes',
    'Wendy Lopes', 'Xavier Mendes', 'Yasmin Alves', 'Zander Cardoso',
    'Beatriz Melo', 'Caio Furtado', 'Daniela Teixeira', 'Eduardo Monteiro',
    'Fernanda Correia', 'Gustavo Neves',
  ]

  const GENDERS = ['M', 'F']

  // Check existing
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('clinic_id', clinicId)

  if (existing && existing.length >= 25) {
    log('patients', `${existing.length} patients already exist. Skipping.`)
    return existing.map((p) => p.id)
  }

  if (existing && existing.length > 0) {
    await supabase.from('patients').delete().eq('clinic_id', clinicId)
  }

  const inserts = PATIENT_NAMES.map((name, i) => {
    const phoneNum = String(9700000001 + i)
    const areaCode = '11'
    const phone = `(${areaCode}) 9${phoneNum.slice(1, 5)}-${phoneNum.slice(5, 9)}`
    const firstName = name.split(' ')[0].toLowerCase()
    const gender = GENDERS[i % 2]
    // Some patients have email, some don't
    const hasEmail = i % 3 !== 2
    const email = hasEmail ? `${firstName}@email.com` : undefined
    // Some have notes
    const notes = i % 5 === 0 ? 'Paciente com historico de ansiedade' : undefined

    return {
      clinic_id: clinicId,
      name,
      phone,
      email: email ?? null,
      gender,
      notes: notes ?? null,
    }
  })

  const { data, error } = await supabase
    .from('patients')
    .insert(inserts)
    .select('id')

  if (error) throw new Error(`Failed to create patients: ${error.message}`)

  log('patients', `Created ${data.length} patients`)
  return data.map((p) => p.id)
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-database.ts
git commit -m "feat(seed): implement patients seeding with realistic BR data"
```

---

### Task 6: Implement seedScheduleBlocks and seedAppointments

**Files:**
- Modify: `scripts/seed-database.ts` — replace `seedScheduleBlocks`, `seedAppointments`, and `printSummary` placeholders

- [ ] **Step 1: Replace the seedScheduleBlocks function**

```typescript
async function seedScheduleBlocks(supabase: ReturnType<typeof createClient>, clinicId: string, dentistIds: string[]): Promise<void> {
  // Check existing
  const { data: existing } = await supabase
    .from('schedule_blocks')
    .select('id')
    .eq('clinic_id', clinicId)

  if (existing && existing.length > 0) {
    log('schedule', `${existing.length} schedule blocks already exist. Skipping.`)
    return
  }

  const blocks: Array<{
    clinic_id: string
    dentist_id: string
    day_of_week: number
    start_time: string
    end_time: string
    is_available: boolean
  }> = []

  // Monday=0 to Friday=4: 08:00-12:00 and 13:00-18:00
  // Saturday=5: 08:00-12:00 only (for first 2 dentists)
  for (const dentistId of dentistIds) {
    for (let day = 0; day <= 4; day++) {
      blocks.push({
        clinic_id: clinicId,
        dentist_id: dentistId,
        day_of_week: day,
        start_time: '08:00',
        end_time: '12:00',
        is_available: true,
      })
      blocks.push({
        clinic_id: clinicId,
        dentist_id: dentistId,
        day_of_week: day,
        start_time: '13:00',
        end_time: '18:00',
        is_available: true,
      })
    }
    // Saturday morning for first 2 dentists
    if (dentistIds.indexOf(dentistId) < 2) {
      blocks.push({
        clinic_id: clinicId,
        dentist_id: dentistId,
        day_of_week: 5,
        start_time: '08:00',
        end_time: '12:00',
        is_available: true,
      })
    }
  }

  const { error } = await supabase.from('schedule_blocks').insert(blocks)
  if (error) throw new Error(`Failed to create schedule blocks: ${error.message}`)

  log('schedule', `Created ${blocks.length} schedule blocks`)
}
```

- [ ] **Step 2: Replace the seedAppointments function**

```typescript
async function seedAppointments(supabase: ReturnType<typeof createClient>, ctx: SeedContext): Promise<void> {
  const { clinicId, dentistIds, procedureIds, patientIds } = ctx

  // Delete existing appointments for this clinic (clean slate)
  const { error: delErr } = await supabase
    .from('appointments')
    .delete()
    .eq('clinic_id', clinicId)

  if (delErr) throw new Error(`Failed to clear existing appointments: ${delErr.message}`)

  const STATUS_DISTRIBUTION: Array<{ status: string; weight: number }> = [
    { status: 'scheduled', weight: 30 },
    { status: 'confirmed', weight: 25 },
    { status: 'completed', weight: 25 },
    { status: 'cancelled', weight: 10 },
    { status: 'in_progress', weight: 5 },
    { status: 'no_show', weight: 5 },
  ]

  function pickStatus(): string {
    const rand = Math.random() * 100
    let cumulative = 0
    for (const { status, weight } of STATUS_DISTRIBUTION) {
      cumulative += weight
      if (rand < cumulative) return status
    }
    return 'scheduled'
  }

  // Generate time slots for the week
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + mondayOffset)

  // Build available slots: 3 weeks (past, current, next)
  const slots: Array<{ date: Date; hour: number; minute: number }> = []

  for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) { // Mon-Fri
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + weekOffset * 7 + dayOffset)

      // Morning slots: 08:00-12:00
      for (let h = 8; h < 12; h++) {
        slots.push({ date, hour: h, minute: 0 })
        slots.push({ date, hour: h, minute: 30 })
      }
      // Afternoon slots: 13:00-18:00
      for (let h = 13; h < 18; h++) {
        slots.push({ date, hour: h, minute: 0 })
        slots.push({ date, hour: h, minute: 30 })
      }
    }
  }

  // Track occupied slots per dentist to avoid overlaps
  const occupied = new Map<string, Set<string>>()
  for (const did of dentistIds) {
    occupied.set(did, new Set())
  }

  function isSlotFree(dentistId: string, start: Date, durationMin: number): boolean {
    const dentistSlots = occupied.get(dentistId)!
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    for (let m = startMinutes; m < startMinutes + durationMin; m += 15) {
      const key = `${start.toISOString().slice(0, 10)}_${m}`
      if (dentistSlots.has(key)) return false
    }
    return true
  }

  function markOccupied(dentistId: string, start: Date, durationMin: number): void {
    const dentistSlots = occupied.get(dentistId)!
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    for (let m = startMinutes; m < startMinutes + durationMin; m += 15) {
      dentistSlots.add(`${start.toISOString().slice(0, 10)}_${m}`)
    }
  }

  // Shuffle slots for randomness
  const shuffledSlots = [...slots].sort(() => Math.random() - 0.5)

  // Get procedure durations (index-based: procedureIds maps to the PROCEDURES array from seedProcedures)
  const PROCEDURE_DURATIONS = [30, 45, 60, 30, 60, 45, 30, 30, 45, 45, 15, 15]

  const appointments: Array<{
    clinic_id: string
    patient_id: string
    dentist_id: string
    procedure_id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    notes: string | null
  }> = []

  let targetCount = 80
  let attempts = 0
  const maxAttempts = shuffledSlots.length * 2

  while (appointments.length < targetCount && attempts < maxAttempts) {
    attempts++
    const slot = shuffledSlots[attempts % shuffledSlots.length]
    const dentistIdx = Math.floor(Math.random() * dentistIds.length)
    const dentistId = dentistIds[dentistIdx]
    const procedureIdx = Math.floor(Math.random() * procedureIds.length)
    const procedureId = procedureIds[procedureIdx]
    const duration = PROCEDURE_DURATIONS[procedureIdx] ?? 30

    const scheduledAt = new Date(slot.date)
    scheduledAt.setHours(slot.hour, slot.minute, 0, 0)

    if (!isSlotFree(dentistId, scheduledAt, duration)) continue

    // Adjust status based on timing
    let status = pickStatus()
    const slotDate = new Date(scheduledAt)
    if (slotDate < today) {
      // Past appointments: mostly completed or cancelled
      status = Math.random() < 0.8 ? 'completed' : (Math.random() < 0.5 ? 'cancelled' : 'no_show')
    } else if (slotDate.getTime() === today.getTime()) {
      // Today: mostly scheduled/confirmed/in_progress
      status = Math.random() < 0.4 ? 'in_progress' : (Math.random() < 0.5 ? 'confirmed' : 'scheduled')
    } else {
      // Future: scheduled or confirmed
      status = Math.random() < 0.6 ? 'scheduled' : 'confirmed'
    }

    const patientIdx = Math.floor(Math.random() * patientIds.length)

    markOccupied(dentistId, scheduledAt, duration)

    appointments.push({
      clinic_id: clinicId,
      patient_id: patientIds[patientIdx],
      dentist_id: dentistId,
      procedure_id: procedureId,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
      status,
      notes: null,
    })
  }

  // Insert in batches of 20
  for (let i = 0; i < appointments.length; i += 20) {
    const batch = appointments.slice(i, i + 20)
    const { error } = await supabase.from('appointments').insert(batch)
    if (error) throw new Error(`Failed to insert appointments batch ${i}: ${error.message}`)
  }

  log('appointments', `Created ${appointments.length} appointments across 3 weeks`)
}
```

- [ ] **Step 3: Replace the printSummary function**

```typescript
function printSummary(clinicId: string): void {
  console.log('\n========================================')
  console.log('   Seed Complete!')
  console.log('========================================')
  console.log(`  Clinic ID:  ${clinicId}`)
  console.log(`  Clinic:     Clinica Odonto Demo`)
  console.log('')
  console.log('  Login credentials:')
  console.log('    Email:    admin@odontodemo.com.br')
  console.log('    Password: demo123456')
  console.log('')
  console.log('  Next steps:')
  console.log('    1. Run: npm run dev')
  console.log('    2. Open: http://localhost:3000/login')
  console.log('    3. Login with the credentials above')
  console.log('    4. Navigate to the calendar')
  console.log('========================================\n')
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-database.ts
git commit -m "feat(seed): implement schedule blocks, appointments, and summary output"
```

---

### Task 7: Run the seed script end-to-end

**Files:** None (execution only)

- [ ] **Step 1: Run the seed script**

```bash
npm run seed
```

Expected: Script prompts for Supabase credentials (if `.env.local` missing), then creates all data.

- [ ] **Step 2: Verify data in Supabase Dashboard**

Go to Supabase Dashboard → Table Editor and verify:
- `clinics`: 1 row (Clinica Odonto Demo)
- `users`: 1 row (admin@odontodemo.com.br, role: owner)
- `dentists`: 4 rows
- `procedures`: 12 rows
- `patients`: 30 rows
- `schedule_blocks`: ~40 rows
- `appointments`: ~80 rows

- [ ] **Step 3: Start the dev server and test login**

```bash
npm run dev
```

Open http://localhost:3000/login and login with:
- Email: `admin@odontodemo.com.br`
- Password: `demo123456`

- [ ] **Step 4: Verify calendar shows real data**

After login:
1. Navigate to the calendar/dashboard
2. Verify Day/Week views show appointments
3. Verify Professionals view shows 4 dentists
4. Verify drag-and-drop persists after page refresh
5. Check browser console — no `[supabase] ... called without config` warnings

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(seed): adjustments from end-to-end testing"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 9 phases from spec have corresponding tasks (Task 2 covers Phase 1-2, Task 3 adds Phase 3-4, Task 5 adds Phase 5, Task 6 adds Phase 6-8-9)
- [x] **Placeholder scan:** No TBD/TODO/placeholders — all functions have complete implementations
- [x] **Type consistency:** All Insert types match `database.types.ts` signatures (clinic_id as string, optional fields as `?? null`, status as string literal)
- [x] **Idempotency:** All seed functions check for existing data before inserting
- [x] **No overlap:** `seedAppointments` tracks occupied slots per dentist with 15-min granularity
