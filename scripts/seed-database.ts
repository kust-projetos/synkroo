/**
 * Seed script for Synkroo — populates PostgreSQL with realistic Brazilian dental clinic data.
 *
 * Usage:  npx tsx scripts/seed-database.ts
 *
 * Tables seeded: clinics, users, dentists, procedures,
 *                patients, schedule_blocks, appointments
 *
 * Idempotent: safe to re-run. Existing seed data is replaced on each run.
 * Uses Drizzle ORM + DATABASE_URL.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'
import { getDb } from '../src/lib/db/client'
import { clinics, users } from '../src/lib/db/schema/core'
import { dentists, procedures, patients } from '../src/lib/db/schema/core'
import { scheduleBlocks, appointments } from '../src/lib/db/schema/appointments'
import { eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
}

const ok = (msg: string) => console.log(`  ${CLR.green}✓${CLR.reset} ${msg}`)
const warn = (msg: string) => console.log(`  ${CLR.yellow}⚠${CLR.reset} ${msg}`)
const fail = (msg: string) => console.log(`  ${CLR.red}✗${CLR.reset} ${msg}`)
const log = (section: string, msg: string) => console.log(`\n${CLR.bold}[${section}]${CLR.reset} ${msg}`)

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const fakePhone = (): string => {
  const ddd = randomInt(11, 99)
  const prefix = 9
  const part1 = randomInt(1000, 9999)
  const part2 = randomInt(1000, 9999)
  return `(${ddd}) ${prefix}${part1}-${part2}`
}

const fakeCpf = (): string => {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 9))
  // simplified CPF generation
  return digits.join('').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3-00')
}

const fakeBirthDate = (): string => {
  const year = randomInt(1950, 2005)
  const month = String(randomInt(1, 12)).padStart(2, '0')
  const day = String(randomInt(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const ask = (rl: readline.Interface, question: string): Promise<string> =>
  new Promise((resolve) => {
    rl.question(`  ${CLR.yellow}?${CLR.reset} ${question}: `, (answer) => {
      resolve(answer.trim())
    })
  })

// ---------------------------------------------------------------------------
// 1. Environment setup
// ---------------------------------------------------------------------------

async function loadEnv(): Promise<string> {
  const envPath = path.resolve(process.cwd(), '.env.local')

  let envContent = ''
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
  }

  const getVar = (name: string): string | undefined => {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : process.env[name]
  }

  let databaseUrl = getVar('DATABASE_URL')

  if (!databaseUrl) {
    console.log(`\n${CLR.bold}DATABASE_URL not set.${CLR.reset}`)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    databaseUrl = await ask(rl, 'DATABASE_URL (postgresql://...)')
    rl.close()

    const lines = envContent ? envContent.split('\n') : []
    const idx = lines.findIndex((l) => l.startsWith('DATABASE_URL='))
    if (idx >= 0) {
      lines[idx] = `DATABASE_URL=${databaseUrl}`
    } else {
      lines.push(`DATABASE_URL=${databaseUrl}`)
    }
    fs.writeFileSync(envPath, lines.join('\n') + '\n')
    ok(`Saved DATABASE_URL to ${envPath}`)
  }

  if (!databaseUrl) {
    fail('DATABASE_URL is required. Aborting.')
    process.exit(1)
  }

  process.env.DATABASE_URL = databaseUrl
  return databaseUrl
}

// ---------------------------------------------------------------------------
// 2. seedClinic
// ---------------------------------------------------------------------------

async function seedClinic(): Promise<string> {
  log('clinic', 'Seeding demo clinic...')

  const slug = 'odonto-demo'
  const db = getDb()

  const existing = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.slug, slug))
    .limit(1)

  if (existing.length > 0) {
    ok(`Clinic already exists (id: ${existing[0].id})`)
    return existing[0].id
  }

  const [result] = await db
    .insert(clinics)
    .values({
      name: 'Registro Demo 15',
      slug,
      phone: '(11) 3456-7890',
      email: 'contato@odontodemo.com.br',
      settings: {
        business_hours: { start: '08:00', end: '18:00' },
        appointment_interval: 30,
        timezone: 'America/Sao_Paulo',
      },
    })
    .returning({ id: clinics.id })

  ok(`Created clinic: Clinica Odonto Demo (id: ${result.id})`)
  return result.id
}

// ---------------------------------------------------------------------------
// 3. seedAdminUser
// ---------------------------------------------------------------------------

async function seedAdminUser(clinicId: string): Promise<string> {
  log('auth', 'Seeding admin user...')

  const email = 'admin@odontodemo.com.br'
  const db = getDb()

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing.length > 0) {
    ok(`User already exists (id: ${existing[0].id})`)
    return existing[0].id
  }

  const [result] = await db
    .insert(users)
    .values({
      clinicId,
      email,
      name: 'Registro Demo 2',
      role: 'owner',
      phone: '(11) 99999-0000',
      isActive: true,
    })
    .returning({ id: users.id })

  ok(`Created user: Admin Demo (role: owner, id: ${result.id})`)
  return result.id
}

// ---------------------------------------------------------------------------
// 4. seedDentists
// ---------------------------------------------------------------------------

const DENTIST_SEED = [
  { name: 'Registro Demo 24', phone: '(11) 99999-0001', email: 'maria.silva@odontodemo.com.br', cro: 'CRO-SP 12345', specialty: 'Ortodontia' },
  { name: 'Registro Demo 23', phone: '(11) 99999-0002', email: 'joao.santos@odontodemo.com.br', cro: 'CRO-SP 54321', specialty: 'Implantodontia' },
  { name: 'Registro Demo 21', phone: '(11) 99999-0003', email: 'ana.oliveira@odontodemo.com.br', cro: 'CRO-SP 67890', specialty: 'Endodontia' },
  { name: 'Registro Demo 22', phone: '(11) 99999-0004', email: 'carlos.pereira@odontodemo.com.br', cro: 'CRO-SP 11111', specialty: 'Clinico Geral' },
] as const

async function seedDentists(clinicId: string): Promise<string[]> {
  log('dentists', 'Seeding 4 dentists...')

  const db = getDb()
  await db.delete(dentists).where(eq(dentists.clinicId, clinicId))

  const values = DENTIST_SEED.map((d) => ({
    clinicId,
    name: d.name,
    phone: d.phone,
    email: d.email,
    cro: d.cro,
    specialty: d.specialty,
    isActive: true,
  }))

  const result = await db.insert(dentists).values(values).returning({ id: dentists.id, name: dentists.name })

  for (const d of result) {
    ok(`Dentist: ${d.name} (id: ${d.id})`)
  }

  return result.map((d) => d.id)
}

// ---------------------------------------------------------------------------
// 5. seedProcedures
// ---------------------------------------------------------------------------

const PROCEDURE_SEED = [
  { name: 'Registro Demo 42', description: 'Limpeza profissional dos dentes', durationMinutes: 30, price: 150, category: 'Preventiva' },
  { name: 'Registro Demo 51', description: 'Restauracao de dente cariado', durationMinutes: 45, price: 200, category: 'Restauradora' },
  { name: 'Registro Demo 63', description: 'Tratamento endodontico completo', durationMinutes: 60, price: 500, category: 'Endodontia' },
  { name: 'Registro Demo 26', description: 'Extracao de dente sem complexidade', durationMinutes: 30, price: 180, category: 'Cirurgica' },
  { name: 'Registro Demo 27', description: 'Extracao de dente do siso', durationMinutes: 60, price: 400, category: 'Cirurgica' },
  { name: 'Registro Demo 14', description: 'Clareamento profissional', durationMinutes: 45, price: 800, category: 'Estetica' },
  { name: 'Registro Demo 6', description: 'Avaliacao inicial ortodontica', durationMinutes: 30, price: 300, category: 'Ortodontia' },
  { name: 'Registro Demo 45', description: 'Ajuste periodico de aparelho', durationMinutes: 30, price: 150, category: 'Ortodontia' },
  { name: 'Registro Demo 17', description: 'Avaliacao para implante', durationMinutes: 45, price: 350, category: 'Implantodontia' },
  { name: 'Registro Demo 18', description: 'Colocacao de coroa provisoria', durationMinutes: 45, price: 400, category: 'Restauradora' },
  { name: 'Registro Demo 56', description: 'Exame radiografico panoramico', durationMinutes: 15, price: 80, category: 'Diagnostica' },
  { name: 'Registro Demo 16', description: 'Consulta de retorno pos-procedimento', durationMinutes: 15, price: 0, category: 'Consulta' },
] as const

async function seedProcedures(clinicId: string): Promise<string[]> {
  log('procedures', 'Seeding 12 procedures...')

  const db = getDb()
  await db.delete(procedures).where(eq(procedures.clinicId, clinicId))

  const values = PROCEDURE_SEED.map((p) => ({
    clinicId,
    name: p.name,
    description: p.description,
    durationMinutes: p.durationMinutes,
    price: String(p.price),
    category: p.category,
    isActive: true,
  }))

  const result = await db.insert(procedures).values(values).returning({ id: procedures.id, name: procedures.name })
  ok(`Created ${result.length} procedures`)
  return result.map((p) => p.id)
}

// ---------------------------------------------------------------------------
// 6. seedPatients
// ---------------------------------------------------------------------------

const PATIENT_SEED = [
  { name: 'Registro Demo 44', gender: 'F', email: 'luciana.ferreira@example.com', notes: 'Alergica a latex' },
  { name: 'Registro Demo 58', gender: 'M', email: 'roberto.almeida@example.com' },
  { name: 'Registro Demo 30', gender: 'F', email: 'fernanda.costa@example.com', notes: 'Paciente ansiosa' },
  { name: 'Registro Demo 12', gender: 'M' },
  { name: 'Registro Demo 54', gender: 'F', email: 'patricia.rocha@example.com' },
  { name: 'Registro Demo 47', gender: 'M' },
  { name: 'Registro Demo 39', gender: 'F', email: 'juliana.martins@example.com', notes: 'Prefere manha' },
  { name: 'Registro Demo 5', gender: 'M' },
  { name: 'Registro Demo 10', gender: 'F' },
  { name: 'Registro Demo 9', gender: 'M', email: 'bruno.gomes@example.com' },
  { name: 'Registro Demo 36', gender: 'F' },
  { name: 'Registro Demo 61', gender: 'M', notes: 'Hipertenso' },
  { name: 'Registro Demo 4', gender: 'F', email: 'amanda.lopes@example.com' },
  { name: 'Registro Demo 55', gender: 'M' },
  { name: 'Registro Demo 7', gender: 'F' },
  { name: 'Registro Demo 43', gender: 'M', email: 'lucas.araujo@example.com' },
  { name: 'Registro Demo 32', gender: 'F', notes: 'Gestante' },
  { name: 'Registro Demo 20', gender: 'M' },
  { name: 'Registro Demo 48', gender: 'F', email: 'mariana.dias@example.com' },
  { name: 'Registro Demo 28', gender: 'M' },
] as const

async function seedPatients(clinicId: string): Promise<string[]> {
  log('patients', `Seeding ${PATIENT_SEED.length} patients...`)

  const db = getDb()
  await db.delete(patients).where(eq(patients.clinicId, clinicId))

  const values = PATIENT_SEED.map((p) => ({
    clinicId,
    name: p.name,
    phone: fakePhone(),
    email: 'email' in p ? p.email : null,
    cpf: fakeCpf(),
    birthDate: fakeBirthDate(),
    gender: p.gender,
    notes: 'notes' in p ? p.notes : null,
  }))

  const result = await db.insert(patients).values(values).returning({ id: patients.id, name: patients.name })
  ok(`Created ${result.length} patients`)
  return result.map((p) => p.id)
}

// ---------------------------------------------------------------------------
// 7. seedScheduleBlocks
// ---------------------------------------------------------------------------

async function seedScheduleBlocks(clinicId: string, dentistIds: string[]): Promise<void> {
  log('schedule', 'Seeding schedule blocks...')

  const db = getDb()
  await db.delete(scheduleBlocks).where(eq(scheduleBlocks.clinicId, clinicId))

  const values: Array<typeof scheduleBlocks.$inferInsert> = []

  for (let day = 0; day <= 4; day++) {
    for (const dentistId of dentistIds) {
      values.push({ clinicId, dentistId, dayOfWeek: day, startTime: '08:00:00', endTime: '12:00:00', isAvailable: true })
      values.push({ clinicId, dentistId, dayOfWeek: day, startTime: '13:00:00', endTime: '18:00:00', isAvailable: true })
    }
  }

  for (const dentistId of dentistIds.slice(0, 2)) {
    values.push({ clinicId, dentistId, dayOfWeek: 5, startTime: '08:00:00', endTime: '12:00:00', isAvailable: true })
  }

  await db.insert(scheduleBlocks).values(values)
  ok(`Created ${values.length} schedule blocks`)
}

// ---------------------------------------------------------------------------
// 8. seedAppointments
// ---------------------------------------------------------------------------

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 8; h < 12; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  for (let h = 13; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

function pickStatus(dayOffset: number, timeSlot: string): string {
  const roll = Math.random()
  if (dayOffset < 0) {
    if (roll < 0.80) return 'completed'
    if (roll < 0.90) return 'cancelled'
    return 'no_show'
  }
  if (dayOffset === 0) {
    const [hour, minute] = timeSlot.split(':').map(Number)
    const now = new Date()
    const slotMinutes = hour * 60 + minute
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    if (slotMinutes < nowMinutes) {
      if (roll < 0.70) return 'completed'
      if (roll < 0.85) return 'cancelled'
      return 'no_show'
    }
    if (roll < 0.40) return 'in_progress'
    if (roll < 0.70) return 'confirmed'
    return 'scheduled'
  }
  if (roll < 0.60) return 'scheduled'
  return 'confirmed'
}

function buildISO(baseDate: Date, dayOffset: number, timeSlot: string): Date {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + dayOffset)
  const [h, m] = timeSlot.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

async function seedAppointments(
  clinicId: string,
  dentistIds: string[],
  procedureIds: string[],
  patientIds: string[],
): Promise<void> {
  log('appointments', 'Seeding ~80 appointments across 3 weeks...')

  const db = getDb()
  await db.delete(appointments).where(eq(appointments.clinicId, clinicId))

  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() - 14)
  const slots = generateTimeSlots()
  const values: Array<typeof appointments.$inferInsert> = []

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const dayOfWeek = (baseDate.getDay() + dayOffset) % 7
    if (dayOfWeek === 6) continue // Sunday

    const dentistId = dentistIds[dayOffset % dentistIds.length]
    const availableSlots = slots.filter(() => Math.random() > 0.4)

    for (const slot of availableSlots.slice(0, 2)) {
      const procedureId = procedureIds[randomInt(0, procedureIds.length - 1)]
      const patientId = patientIds[randomInt(0, patientIds.length - 1)]
      const status = pickStatus(dayOffset - 14, slot) as string
      const scheduledAt = buildISO(baseDate, dayOffset, slot)

      values.push({
        clinicId,
        patientId,
        dentistId,
        procedureId,
        scheduledAt,
        durationMinutes: randomInt(15, 60),
        status: status as 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
        notes: null,
      })
    }
  }

  if (values.length > 0) {
    await db.insert(appointments).values(values)
    ok(`Created ${values.length} appointments`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`${CLR.bold}Synkroo — Database Seed (Drizzle)${CLR.reset}\n`)

  await loadEnv()

  try {
    const clinicId = await seedClinic()
    await seedAdminUser(clinicId)
    const dentistIds = await seedDentists(clinicId)
    const procedureIds = await seedProcedures(clinicId)
    const patientIds = await seedPatients(clinicId)
    await seedScheduleBlocks(clinicId, dentistIds)
    await seedAppointments(clinicId, dentistIds, procedureIds, patientIds)

    console.log(`\n${CLR.green}${CLR.bold}✓ Seed complete!${CLR.reset}`)
    console.log(`  Login: admin@odontodemo.com.br / demo123456\n`)
    process.exit(0)
  } catch (err) {
    fail(`Seed failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

main()
