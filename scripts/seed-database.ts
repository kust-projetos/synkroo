// @ts-nocheck
/**
 * Seed script for Synkroo — populates Supabase with realistic Brazilian dental clinic data.
 *
 * Usage:  npx tsx scripts/seed-database.ts
 *
 * Tables seeded: clinics, users (auth + public), dentists, procedures,
 *                patients, schedule_blocks, appointments
 *
 * Idempotent: safe to re-run. Existing seed data is replaced on each run.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'

// ---------------------------------------------------------------------------
// Types — mirror the Insert shapes from database.types.ts
// ---------------------------------------------------------------------------

interface ClinicInsert {
  id?: string
  name: string
  slug: string
  phone: string
  email: string
  website?: string | null
  address?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
}

interface UserInsert {
  id?: string
  clinic_id: string
  email: string
  name: string
  role?: 'owner' | 'admin' | 'dentist' | 'receptionist'
  phone?: string | null
  avatar_url?: string | null
  is_active?: boolean
}

interface DentistInsert {
  id?: string
  clinic_id: string
  name: string
  phone?: string | null
  email?: string | null
  cro?: string | null
  specialty?: string | null
  avatar_url?: string | null
  is_active?: boolean
  working_hours?: Record<string, unknown> | null
}

interface ProcedureInsert {
  id?: string
  clinic_id: string
  name: string
  description?: string | null
  duration_minutes?: number | null
  price?: number | null
  category?: string | null
  is_active?: boolean
}

interface PatientInsert {
  id?: string
  clinic_id: string
  name: string
  phone: string
  email?: string | null
  cpf?: string | null
  birth_date?: string | null
  gender?: string | null
  address?: Record<string, unknown> | null
  notes?: string | null
  tags?: string[] | null
}

interface ScheduleBlockInsert {
  id?: string
  clinic_id: string
  dentist_id?: string | null
  day_of_week?: number | null
  start_time: string
  end_time: string
  is_available?: boolean
}

interface AppointmentInsert {
  id?: string
  clinic_id: string
  patient_id: string
  dentist_id?: string | null
  procedure_id?: string | null
  scheduled_at: string
  duration_minutes?: number
  status?: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
} as const

function log(label: string, msg: string): void {
  console.log(`  ${CLR.cyan}[${label}]${CLR.reset} ${msg}`)
}

function ok(msg: string): void {
  console.log(`  ${CLR.green}OK${CLR.reset}  ${msg}`)
}

function warn(msg: string): void {
  console.log(`  ${CLR.yellow}!!${CLR.reset}  ${msg}`)
}

function fail(msg: string): void {
  console.log(`  ${CLR.red}ERR${CLR.reset} ${msg}`)
}

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Build an ISO-8601 timestamp from a base date, day offset, and HH:mm string. */
function makeTimestamp(base: Date, dayOffset: number, time: string): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  // Ensure timezone-aware output in UTC
  return d.toISOString()
}

function makeTimestampFromDate(date: Date, time: string): string {
  const d = new Date(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Generate a realistic Brazilian CPF (format only, not valid digraphs). */
function fakeCpf(): string {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 9))
  const d1 = digits.reduce((acc, v, i) => acc + v * (10 - i), 0)
  const r1 = (d1 * 10) % 11
  digits.push(r1 >= 10 ? 0 : r1)
  const d2 = digits.reduce((acc, v, i) => acc + v * (11 - i), 0)
  const r2 = (d2 * 10) % 11
  digits.push(r2 >= 10 ? 0 : r2)
  return digits.join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/** Format a random SP mobile number. */
function fakePhone(): string {
  const n = String(randomInt(900000000, 999999999))
  return `(11) 9${n.slice(1, 4)}-${n.slice(4, 8)}`
}

/** Generate a random date of birth between 1955 and 2005. */
function fakeBirthDate(): string {
  const year = randomInt(1955, 2005)
  const month = String(randomInt(1, 12)).padStart(2, '0')
  const day = String(randomInt(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Ask user for input via readline. */
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`  ${CLR.yellow}?${CLR.reset} ${question}: `, (answer) => {
      resolve(answer.trim())
    })
  })
}

// ---------------------------------------------------------------------------
// 1. Environment setup
// ---------------------------------------------------------------------------

async function loadEnv(): Promise<{
  supabaseUrl: string
  anonKey: string
  serviceRoleKey: string
}> {
  const envPath = path.resolve(process.cwd(), '.env.local')

  // Attempt to read existing .env.local
  let envContent = ''
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
  }

  const getVar = (name: string): string | undefined => {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : process.env[name]
  }

  let supabaseUrl = getVar('NEXT_PUBLIC_SUPABASE_URL')
  let anonKey = getVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  let serviceRoleKey = getVar('SUPABASE_SERVICE_ROLE_KEY')

  // Interactive prompt for missing values
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const missing: string[] = []

  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    console.log(`\n${CLR.bold}Missing environment variables:${CLR.reset} ${missing.join(', ')}`)
    console.log('Please provide them below (or press Ctrl+C to cancel):\n')

    if (!supabaseUrl) supabaseUrl = await ask(rl, 'NEXT_PUBLIC_SUPABASE_URL')
    if (!anonKey) anonKey = await ask(rl, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (!serviceRoleKey) serviceRoleKey = await ask(rl, 'SUPABASE_SERVICE_ROLE_KEY')

    // Persist to .env.local
    const lines = envContent ? envContent.split('\n') : []
    const setVar = (name: string, value: string) => {
      const idx = lines.findIndex((l) => l.startsWith(`${name}=`))
      if (idx >= 0) {
        lines[idx] = `${name}=${value}`
      } else {
        lines.push(`${name}=${value}`)
      }
    }
    setVar('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl!)
    setVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey!)
    setVar('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey!)
    fs.writeFileSync(envPath, lines.join('\n') + '\n')
    ok(`Saved credentials to ${envPath}`)
  }

  rl.close()

  // Validate
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    fail('All three environment variables are required. Aborting.')
    process.exit(1)
  }

  return { supabaseUrl, anonKey, serviceRoleKey }
}

// ---------------------------------------------------------------------------
// 2. seedClinic
// ---------------------------------------------------------------------------

async function seedClinic(
  sb: any,
): Promise<string> {
  log('clinic', 'Seeding demo clinic...')

  const slug = 'odonto-demo'

  // Check if clinic already exists
  const { data: existing } = await sb
    .from('clinics')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    ok(`Clinic already exists (id: ${existing.id})`)
    return existing.id
  }

  const clinic: ClinicInsert = {
    name: 'Registro Demo 15',
    slug,
    phone: '(11) 3456-7890',
    email: 'contato@odontodemo.com.br',
    settings: {
      business_hours: { start: '08:00', end: '18:00' },
      appointment_interval: 30,
      timezone: 'America/Sao_Paulo',
    },
  }

  const { data, error } = await sb.from('clinics').insert(clinic).select('id').single()

  if (error) {
    fail(`Failed to create clinic: ${error.message}`)
    process.exit(1)
  }

  ok(`Created clinic: ${clinic.name} (id: ${data.id})`)
  return data.id
}

// ---------------------------------------------------------------------------
// 3. seedAdminUser
// ---------------------------------------------------------------------------

async function seedAdminUser(
  sb: any,
  clinicId: string,
): Promise<string> {
  log('auth', 'Seeding admin user...')

  const email = 'admin@odontodemo.com.br'
  const password = 'demo123456'
  const name = 'Admin Demo'

  // Check if auth user already exists by listing users with that email
  const { data: userList } = await sb.auth.admin.listUsers()
  const existingAuth = userList?.users?.find((u) => u.email === email)

  let userId: string

  if (existingAuth) {
    userId = existingAuth.id
    ok(`Auth user already exists (id: ${userId})`)
  } else {
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authErr) {
      // Handle "already registered" gracefully
      if (authErr.message?.toLowerCase().includes('already registered')) {
        warn(`Auth user already registered. Looking up existing...`)
        const { data: retryList } = await sb.auth.admin.listUsers()
        const found = retryList?.users?.find((u) => u.email === email)
        if (!found) {
          fail('Could not find existing auth user. Aborting.')
          process.exit(1)
        }
        userId = found.id
      } else {
        fail(`Failed to create auth user: ${authErr.message}`)
        process.exit(1)
      }
    } else {
      userId = authData.user.id
      ok(`Created auth user: ${email}`)
    }
  }

  // Upsert into public users table
  const { data: existingUser } = await sb
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser) {
    ok(`Users row already exists for ${email}`)
    return userId
  }

  const userRow: UserInsert = {
    id: userId,
    clinic_id: clinicId,
    email,
    name,
    role: 'owner',
    phone: '(11) 99999-0000',
    is_active: true,
  }

  const { error: userErr } = await sb.from('users').insert(userRow)

  if (userErr) {
    fail(`Failed to insert user row: ${userErr.message}`)
    process.exit(1)
  }

  ok(`Created user row: ${name} (role: owner)`)
  return userId
}

// ---------------------------------------------------------------------------
// 4. seedDentists
// ---------------------------------------------------------------------------

const DENTIST_SEED = [
  {
    name: 'Registro Demo 24',
    phone: '(11) 99999-0001',
    email: 'maria.silva@odontodemo.com.br',
    cro: 'CRO-SP 12345',
    specialty: 'Ortodontia',
    working_hours: {
      monday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      saturday: { start: '08:00', end: '12:00' },
    },
  },
  {
    name: 'Registro Demo 23',
    phone: '(11) 99999-0002',
    email: 'joao.santos@odontodemo.com.br',
    cro: 'CRO-SP 54321',
    specialty: 'Implantodontia',
    working_hours: {
      monday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      saturday: { start: '08:00', end: '12:00' },
    },
  },
  {
    name: 'Registro Demo 21',
    phone: '(11) 99999-0003',
    email: 'ana.oliveira@odontodemo.com.br',
    cro: 'CRO-SP 67890',
    specialty: 'Endodontia',
    working_hours: {
      monday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    },
  },
  {
    name: 'Registro Demo 22',
    phone: '(11) 99999-0004',
    email: 'carlos.pereira@odontodemo.com.br',
    cro: 'CRO-SP 11111',
    specialty: 'Clinico Geral',
    working_hours: {
      monday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    },
  },
] as const

async function seedDentists(
  sb: any,
  clinicId: string,
): Promise<string[]> {
  log('dentists', 'Seeding 4 dentists...')

  // Delete existing dentists for this clinic (clean slate)
  const { error: delErr } = await sb
    .from('dentists')
    .delete()
    .eq('clinic_id', clinicId)

  if (delErr) {
    warn(`Could not clean existing dentists: ${delErr.message}`)
  }

  const inserts: DentistInsert[] = DENTIST_SEED.map((d) => ({
    clinic_id: clinicId,
    name: d.name,
    phone: d.phone,
    email: d.email,
    cro: d.cro,
    specialty: d.specialty,
    is_active: true,
    working_hours: d.working_hours as Record<string, unknown>,
  }))

  const { data, error } = await sb
    .from('dentists')
    .insert(inserts)
    .select('id, name')

  if (error) {
    fail(`Failed to insert dentists: ${error.message}`)
    process.exit(1)
  }

  const ids = data!.map((d) => d.id)
  for (const d of data!) {
    ok(`Dentist: ${d.name} (id: ${d.id})`)
  }

  return ids
}

// ---------------------------------------------------------------------------
// 5. seedProcedures
// ---------------------------------------------------------------------------

const PROCEDURE_SEED: readonly {
  name: string
  description: string
  duration_minutes: number
  price: number
  category: string
}[] = [
  { name: 'Registro Demo 42', description: 'Limpeza profissional dos dentes com remocao de tartaro e placas', duration_minutes: 30, price: 150, category: 'Preventiva' },
  { name: 'Registro Demo 51', description: 'Restauracao de dente cariado com material composto', duration_minutes: 45, price: 200, category: 'Restauradora' },
  { name: 'Registro Demo 63', description: 'Tratamento endodontico completo do canal radicular', duration_minutes: 60, price: 500, category: 'Endodontia' },
  { name: 'Registro Demo 26', description: 'Extracao de dente sem complexidade cirurgica', duration_minutes: 30, price: 180, category: 'Cirurgica' },
  { name: 'Registro Demo 27', description: 'Extracao de dente do siso (terceiro molar)', duration_minutes: 60, price: 400, category: 'Cirurgica' },
  { name: 'Registro Demo 14', description: 'Clareamento profissional dos dentes em consultorio', duration_minutes: 45, price: 800, category: 'Estetica' },
  { name: 'Registro Demo 6', description: 'Avaliacao inicial para tratamento ortodontico com aparelho', duration_minutes: 30, price: 300, category: 'Ortodontia' },
  { name: 'Registro Demo 45', description: 'Ajuste e manutencao periodica de aparelho ortodontico', duration_minutes: 30, price: 150, category: 'Ortodontia' },
  { name: 'Registro Demo 17', description: 'Avaliacao para colocacao de implante dentario', duration_minutes: 45, price: 350, category: 'Implantodontia' },
  { name: 'Registro Demo 18', description: 'Colocacao de coroa provisoria em dente preparado', duration_minutes: 45, price: 400, category: 'Restauradora' },
  { name: 'Registro Demo 56', description: 'Exame radiografico panoramico completo da arcada dentaria', duration_minutes: 15, price: 80, category: 'Diagnostica' },
  { name: 'Registro Demo 16', description: 'Consulta de retorno pos-procedimento para acompanhamento', duration_minutes: 15, price: 0, category: 'Consulta' },
]

async function seedProcedures(
  sb: any,
  clinicId: string,
): Promise<string[]> {
  log('procedures', 'Seeding 12 procedures...')

  // Clean slate
  const { error: delErr } = await sb
    .from('procedures')
    .delete()
    .eq('clinic_id', clinicId)

  if (delErr) {
    warn(`Could not clean existing procedures: ${delErr.message}`)
  }

  const inserts: ProcedureInsert[] = PROCEDURE_SEED.map((p) => ({
    clinic_id: clinicId,
    name: p.name,
    description: p.description,
    duration_minutes: p.duration_minutes,
    price: p.price,
    category: p.category,
    is_active: true,
  }))

  const { data, error } = await sb
    .from('procedures')
    .insert(inserts)
    .select('id, name')

  if (error) {
    fail(`Failed to insert procedures: ${error.message}`)
    process.exit(1)
  }

  const ids = data!.map((p) => p.id)
  ok(`Created ${data!.length} procedures`)
  return ids
}

// ---------------------------------------------------------------------------
// 6. seedPatients
// ---------------------------------------------------------------------------

const PATIENT_SEED: readonly {
  name: string
  gender: string
  email?: string
  notes?: string
}[] = [
  { name: 'Registro Demo 44', gender: 'F', email: 'luciana.ferreira@example.com', notes: 'Alérégica a latex' },
  { name: 'Registro Demo 58', gender: 'M', email: 'roberto.almeida@example.com' },
  { name: 'Registro Demo 30', gender: 'F', email: 'fernanda.costa@example.com', notes: 'Paciente ansiosa — agendar com calma' },
  { name: 'Registro Demo 12', gender: 'M' },
  { name: 'Registro Demo 54', gender: 'F', email: 'patricia.rocha@example.com' },
  { name: 'Registro Demo 47', gender: 'M' },
  { name: 'Registro Demo 39', gender: 'F', email: 'juliana.martins@example.com', notes: 'Prefere consultas pela manha' },
  { name: 'Registro Demo 5', gender: 'M' },
  { name: 'Registro Demo 10', gender: 'F' },
  { name: 'Registro Demo 9', gender: 'M', email: 'bruno.gomes@example.com' },
  { name: 'Registro Demo 36', gender: 'F' },
  { name: 'Registro Demo 61', gender: 'M', notes: 'Hipertenso — verificar medicacao' },
  { name: 'Registro Demo 4', gender: 'F', email: 'amanda.lopes@example.com' },
  { name: 'Registro Demo 55', gender: 'M' },
  { name: 'Registro Demo 7', gender: 'F' },
  { name: 'Registro Demo 43', gender: 'M', email: 'lucas.araujo@example.com' },
  { name: 'Registro Demo 32', gender: 'F', notes: 'Gestante — 2o trimestre' },
  { name: 'Registro Demo 20', gender: 'M' },
  { name: 'Registro Demo 48', gender: 'F', email: 'mariana.dias@example.com' },
  { name: 'Registro Demo 28', gender: 'M' },
  { name: 'Daniela Correia', gender: 'F' },
  { name: 'Gustavo Nunes', gender: 'M', email: 'gustavo.nunes@example.com', notes: 'Paciente novo — indicação da Dra. Maria' },
  { name: 'Tatiana Vieira', gender: 'F' },
  { name: 'Leonardo Pinto', gender: 'M' },
  { name: 'Carolina Monteiro', gender: 'F', email: 'carolina.monteiro@example.com' },
  { name: 'Ricardo Batista', gender: 'M' },
  { name: 'Priscila Teixeira', gender: 'F', notes: 'Diabetica tipo 2' },
  { name: 'Henrique Moura', gender: 'M', email: 'henrique.moura@example.com' },
  { name: 'Vanessa Cardoso', gender: 'F' },
  { name: 'Alexandre Reis', gender: 'M' },
]

async function seedPatients(
  sb: any,
  clinicId: string,
): Promise<string[]> {
  log('patients', `Seeding ${PATIENT_SEED.length} patients...`)

  // Clean slate
  const { error: delErr } = await sb
    .from('patients')
    .delete()
    .eq('clinic_id', clinicId)

  if (delErr) {
    warn(`Could not clean existing patients: ${delErr.message}`)
  }

  const inserts: PatientInsert[] = PATIENT_SEED.map((p) => ({
    clinic_id: clinicId,
    name: p.name,
    phone: fakePhone(),
    email: p.email ?? null,
    cpf: fakeCpf(),
    birth_date: fakeBirthDate(),
    gender: p.gender,
    notes: p.notes ?? null,
  }))

  const { data, error } = await sb
    .from('patients')
    .insert(inserts)
    .select('id, name')

  if (error) {
    fail(`Failed to insert patients: ${error.message}`)
    process.exit(1)
  }

  const ids = data!.map((p) => p.id)
  ok(`Created ${data!.length} patients`)
  return ids
}

// ---------------------------------------------------------------------------
// 7. seedScheduleBlocks
// ---------------------------------------------------------------------------

async function seedScheduleBlocks(
  sb: any,
  clinicId: string,
  dentistIds: string[],
): Promise<void> {
  log('schedule', 'Seeding schedule blocks...')

  // Clean slate
  const { error: delErr } = await sb
    .from('schedule_blocks')
    .delete()
    .eq('clinic_id', clinicId)

  if (delErr) {
    warn(`Could not clean existing schedule blocks: ${delErr.message}`)
  }

  const blocks: ScheduleBlockInsert[] = []

  // day_of_week: 0=Monday ... 6=Sunday
  // Monday-Friday (0-4): 08:00-12:00 and 13:00-18:00 for all dentists
  for (let day = 0; day <= 4; day++) {
    for (const dentistId of dentistIds) {
      blocks.push({
        clinic_id: clinicId,
        dentist_id: dentistId,
        day_of_week: day,
        start_time: '08:00:00',
        end_time: '12:00:00',
        is_available: true,
      })
      blocks.push({
        clinic_id: clinicId,
        dentist_id: dentistId,
        day_of_week: day,
        start_time: '13:00:00',
        end_time: '18:00:00',
        is_available: true,
      })
    }
  }

  // Saturday (5): 08:00-12:00 for first 2 dentists only
  for (const dentistId of dentistIds.slice(0, 2)) {
    blocks.push({
      clinic_id: clinicId,
      dentist_id: dentistId,
      day_of_week: 5,
      start_time: '08:00:00',
      end_time: '12:00:00',
      is_available: true,
    })
  }

  const { error } = await sb.from('schedule_blocks').insert(blocks)

  if (error) {
    fail(`Failed to insert schedule blocks: ${error.message}`)
    process.exit(1)
  }

  ok(`Created ${blocks.length} schedule blocks`)
}

// ---------------------------------------------------------------------------
// 8. seedAppointments
// ---------------------------------------------------------------------------

/** Generate all valid 30-minute time slots for a working day. */
function generateTimeSlots(): string[] {
  const slots: string[] = []
  // Morning block: 08:00 - 12:00
  for (let h = 8; h < 12; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  // Afternoon block: 13:00 - 17:30 (last slot allows a 30-min appointment ending at 18:00)
  for (let h = 13; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

/** Determine appointment status based on timing context. */
function pickStatus(
  dayOffset: number,
  timeSlot: string,
): 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' {
  const roll = Math.random()
  const now = new Date()
  const [hour, minute] = timeSlot.split(':').map(Number)
  const slotMinutes = hour * 60 + minute
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  if (dayOffset < 0) {
    // Past appointments: 80% completed, 10% cancelled, 10% no_show
    if (roll < 0.80) return 'completed'
    if (roll < 0.90) return 'cancelled'
    return 'no_show'
  }

  if (dayOffset === 0) {
    // Today: before current time = mostly completed, after = future status
    if (slotMinutes < nowMinutes) {
      // Already passed today
      if (roll < 0.70) return 'completed'
      if (roll < 0.85) return 'cancelled'
      return 'no_show'
    }
    // Still upcoming today
    if (roll < 0.40) return 'in_progress'
    if (roll < 0.70) return 'confirmed'
    return 'scheduled'
  }

  // Future appointments: 60% scheduled, 40% confirmed
  if (roll < 0.60) return 'scheduled'
  return 'confirmed'
}

async function seedAppointments(
  sb: any,
  clinicId: string,
  dentistIds: string[],
  procedureIds: string[],
  patientIds: string[],
): Promise<void> {
  log('appointments', 'Seeding ~80 appointments across 3 weeks...')

  // Clean slate — delete all existing appointments for this clinic
  const { error: delErr } = await sb
    .from('appointments')
    .delete()
    .eq('clinic_id', clinicId)

  if (delErr) {
    warn(`Could not clean existing appointments: ${delErr.message}`)
  }

  // Fetch procedure durations for mapping
  const { data: procedures } = await sb
    .from('procedures')
    .select('id, duration_minutes')
    .eq('clinic_id', clinicId)

  const procDurationMap = new Map<string, number>()
  for (const p of procedures ?? []) {
    procDurationMap.set(p.id, p.duration_minutes ?? 30)
  }

  const timeSlots = generateTimeSlots()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Track occupied 15-min granules per dentist per day to avoid overlaps
  // Key format: "dentistId:dayOffset:granule" where granule = total minutes / 15
  const occupied = new Set<string>()

  const allAppointments: AppointmentInsert[] = []

  // April 2026: iterate April 1-30
  const aprilStart = new Date(2026, 3, 1) // month is 0-indexed
  const aprilEnd = new Date(2026, 3, 30)
  const now = new Date()

  for (let day = 1; day <= 30; day++) {
    const date = new Date(2026, 3, day)
    const jsDay = date.getDay()
    const dateKey = `2026-04-${String(day).padStart(2, '0')}`

    // Skip Sundays
    if (jsDay === 0) continue

    const isSaturday = jsDay === 6
    const availableDentists = isSaturday ? dentistIds.slice(0, 2) : dentistIds
    const isWeekday = jsDay >= 1 && jsDay <= 5
    const targetPerDay = isWeekday ? 7 : 3

    let dayCount = 0
    let attempts = 0
    const maxAttempts = targetPerDay * 10

    while (dayCount < targetPerDay && attempts < maxAttempts) {
      attempts++

      const dentistId = randomPick(availableDentists)
      const timeSlot = randomPick(timeSlots)
      const patientId = randomPick(patientIds)
      const procedureId = randomPick(procedureIds)

      const durationMinutes = procDurationMap.get(procedureId) ?? 30
      const scheduledAt = makeTimestampFromDate(date, timeSlot)

      // Check for overlaps using 15-min granules
      const [slotHour, slotMin] = timeSlot.split(':').map(Number)
      const startGranule = (slotHour * 60 + slotMin) / 15
      const endGranule = startGranule + Math.ceil(durationMinutes / 15)
      let hasOverlap = false

      for (let g = startGranule; g < endGranule; g++) {
        const key = `${dentistId}:${dateKey}:${g}`
        if (occupied.has(key)) {
          hasOverlap = true
          break
        }
      }

      if (hasOverlap) continue

      // Mark granules as occupied
      for (let g = startGranule; g < endGranule; g++) {
        occupied.add(`${dentistId}:${dateKey}:${g}`)
      }

      // Status based on date relative to now
      const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const isToday = date.toDateString() === now.toDateString()
      let status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
      const roll = Math.random()

      if (isPast) {
        if (roll < 0.80) status = 'completed'
        else if (roll < 0.90) status = 'cancelled'
        else status = 'no_show'
      } else if (isToday) {
        const [h, m] = timeSlot.split(':').map(Number)
        const slotMin2 = h * 60 + m
        const nowMin = now.getHours() * 60 + now.getMinutes()
        if (slotMin2 < nowMin) {
          status = roll < 0.70 ? 'completed' : (roll < 0.85 ? 'cancelled' : 'no_show')
        } else {
          status = roll < 0.40 ? 'in_progress' : (roll < 0.70 ? 'confirmed' : 'scheduled')
        }
      } else {
        status = roll < 0.60 ? 'scheduled' : 'confirmed'
      }

      allAppointments.push({
        clinic_id: clinicId,
        patient_id: patientId,
        dentist_id: dentistId,
        procedure_id: procedureId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        status,
        notes: null,
      })

      dayCount++
    }
  }

  // Insert in batches of 20
  const batchSize = 20
  let totalInserted = 0

  for (let i = 0; i < allAppointments.length; i += batchSize) {
    const batch = allAppointments.slice(i, i + batchSize)
    const { data: inserted, error } = await sb
      .from('appointments')
      .insert(batch)
      .select('id')

    if (error) {
      fail(`Failed to insert appointment batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      continue
    }

    totalInserted += inserted?.length ?? 0
  }

  ok(`Created ${totalInserted} appointments`)

  // Print status distribution
  const statusCounts: Record<string, number> = {}
  for (const a of allAppointments) {
    const s = a.status ?? 'unknown'
    statusCounts[s] = (statusCounts[s] ?? 0) + 1
  }
  console.log(`    Status distribution: ${Object.entries(statusCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`)
}

// ---------------------------------------------------------------------------
// 9. printSummary
// ---------------------------------------------------------------------------

function printSummary(): void {
  console.log(`
${CLR.bold}${CLR.green}========================================
  Seed completed successfully!
========================================${CLR.reset}

${CLR.bold}Demo Clinic${CLR.reset}
  Name: Clinica Odonto Demo
  Slug: odonto-demo

${CLR.bold}Admin Credentials${CLR.reset}
  Email:    admin@odontodemo.com.br
  Password: demo123456

${CLR.bold}Dentists${CLR.reset}
  Dr. Maria Silva    — Ortodontia
  Dr. Joao Santos    — Implantodontia
  Dr. Ana Oliveira   — Endodontia
  Dr. Carlos Pereira — Clinico Geral

${CLR.bold}Data Summary${CLR.reset}
  12 procedures
  30 patients
  ~80 appointments (3-week range)

${CLR.bold}Next Steps${CLR.reset}
  1. Start the dev server:  ${CLR.cyan}npm run dev${CLR.reset}
  2. Open:                  ${CLR.cyan}http://localhost:3000${CLR.reset}
  3. Login with the admin credentials above
  4. Navigate to the calendar to see appointments

${CLR.yellow}Note:${CLR.reset} Run this script again to reset seed data.
`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n${CLR.bold}Synkroo Database Seed${CLR.reset}\n`)

  // 1. Load / prompt for environment variables
  await loadEnv()

  // Create Drizzle-backed Supabase-compatible client
  const sb = createClient()
  log('connection', 'Verifying database connection...')
  try {
    const { error: healthErr } = await sb.from('clinics').select('id').limit(1)
    if (healthErr) throw new Error(healthErr.message)
    log('success', 'Connected')
  } catch (err: any) {
    fail(`Cannot connect to database: ${err.message}`)
    process.exit(1)
  }
  ok('Connection verified\n')

  // 2. Seed clinic
  const clinicId = await seedClinic(sb)
  console.log()

  // 3. Seed admin user
  await seedAdminUser(sb, clinicId)
  console.log()

  // 4. Seed dentists
  const dentistIds = await seedDentists(sb, clinicId)
  console.log()

  // 5. Seed procedures
  const procedureIds = await seedProcedures(sb, clinicId)
  console.log()

  // 6. Seed patients
  const patientIds = await seedPatients(sb, clinicId)
  console.log()

  // 7. Seed schedule blocks
  await seedScheduleBlocks(sb, clinicId, dentistIds)
  console.log()

  // 8. Seed appointments
  await seedAppointments(sb, clinicId, dentistIds, procedureIds, patientIds)
  console.log()

  // 9. Summary
  printSummary()
}

main().catch((err) => {
  fail(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
