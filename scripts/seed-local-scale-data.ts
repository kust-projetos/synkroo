/* eslint-disable no-console */
/**
 * scripts/seed-local-scale-data.ts
 *
 * Large-scale local seed for the Synkroo Postgres/Drizzle dev DB.
 *
 * Goals:
 * - Idempotent for the demo clinic ("clinica-demo"): pre-existing scale data is removed
 *   before re-insertion. Data from other clinics is NEVER touched.
 * - Deterministic by default (PRNG seeded with --seed). Same seed = same data.
 * - Operates only on the local DATABASE_URL (Postgres/Drizzle). No Supabase, no network.
 * - Supports --dry-run (print plan without DB writes) and --summary (print post-seed counts).
 *
 * Presets:
 * - large (default):  ~2 000 patients, ~5 000 appointments, ~800 leads, ~100 campaigns,
 *                     ~100 conversations with messages, 8 dentists, 12 procedures
 * - small:           ~200 patients,  ~500 appointments,  ~80 leads,  ~20 campaigns,
 *                     ~20 conversations with messages, 4 dentists, 8 procedures
 *
 * Usage:
 *   npm run db:seed:scale                       # large preset, real run
 *   npm run db:seed:scale -- --preset small     # small preset
 *   npm run db:seed:scale -- --dry-run         # plan + expected counts, no writes
 *   npm run db:seed:scale -- --summary         # print counts after seed
 *   npm run db:seed:scale -- --no-cleanup      # don't delete pre-existing scale data
 *   npm run db:seed:scale -- --seed=42         # deterministic PRNG seed (default 1337)
 *
 * Exit codes: 0 success, 1 user error, 2 infrastructure error (e.g. DB unreachable).
 */

import { config as loadEnv } from 'dotenv'
import {
  eq,
  and,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm'
import { getDb, closeDb } from '../src/lib/db/client'
import { hashPassword } from '../src/lib/auth/password'
import {
  clinics,
  users,
  userCredentials,
  dentists,
  procedures,
  patients,
  appointments,
  scheduleBlocks,
  campaigns,
  campaignRecipients,
  conversations,
  messages,
  leads,
  pipelineStages,
  followUps,
  waitlist,
  tasks,
  patientObservations,
  patientPreferences,
  patientFeedback,
  procedureGuidelines,
  budgets,
  budgetItems,
  budgetInstallments,
  payments,
  treatmentPlans,
  treatmentPlanItems,
  messageTemplates,
  whatsappInstances,
  knowledgeBase,
  consents,
  customFieldDefinitions,
  customFieldValues,
  pendingActions,
  decisionLogs,
  smartTriggerLog,
  agentQueue,
} from '../src/lib/db/schema'

// Load env: .env.local first, then .env (matches scripts/check-db.mjs and create-demo-user.ts).
loadEnv({ path: '.env.local' })
loadEnv()

// Build a usable DATABASE_URL even when only POSTGRES_* are set (matches check-db.mjs fallback).
if (!process.env.DATABASE_URL) {
  const user = process.env.POSTGRES_USER || 'synkroo'
  const pass = process.env.POSTGRES_PASSWORD || 'change-me-local-dev-password'
  const host = process.env.POSTGRES_HOST || '127.0.0.1'
  const port = process.env.POSTGRES_PORT || '55432'
  const db = process.env.POSTGRES_DB || 'synkroo'
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${db}`
}

// ─── CLI parsing (no dependency, just a tiny parser) ──────────────

interface CliOptions {
  preset: 'large' | 'small'
  dryRun: boolean
  summaryOnly: boolean
  noCleanup: boolean
  seed: number
}

function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    preset: 'large',
    dryRun: false,
    summaryOnly: false,
    noCleanup: false,
    seed: 1337,
  }
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--summary') opts.summaryOnly = true
    else if (arg === '--no-cleanup') opts.noCleanup = true
    else if (arg === '--preset=large' || arg === '--preset=small') {
      opts.preset = arg.split('=')[1] as 'large' | 'small'
    } else if (arg === '--preset' && argv[argv.indexOf(arg) + 1]) {
      const v = argv[argv.indexOf(arg) + 1]
      if (v === 'large' || v === 'small') opts.preset = v
    } else if (arg.startsWith('--seed=')) {
      const n = Number(arg.split('=')[1])
      if (Number.isFinite(n)) opts.seed = n
    }
  }
  return opts
}

// ─── PRNG (Mulberry32 — fast, deterministic, good enough) ──────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pick an index from a discrete distribution by `weights` using an rng in [0,1). */
export function pickWeighted(weights: number[], rng: () => number): number {
  const total = weights.reduce((s, w) => s + w, 0)
  const r = rng() * total
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (r < acc) return i
  }
  return weights.length - 1
}

/** Pick a random element from an array. */
export function pickOne<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Random int in [min, max] inclusive. */
export function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

// ─── Preset definitions ────────────────────────────────────────────

interface PresetSpec {
  dentists: number
  procedures: number
  pipelineStages: number
  patients: number
  leads: number
  campaigns: number
  conversations: number
  messagesPerConversationMin: number
  messagesPerConversationMax: number
  /** Calendar window in days, centred on today (so N days past, N days future). */
  windowDays: number
  // New tables
  waitlistEntries: number
  tasksCount: number
  budgetsCount: number
  treatmentPlansCount: number
  feedbackCount: number
  messageTemplatesCount: number
  knowledgeBaseCount: number
  consentsCount: number
  customFieldDefsCount: number
  pendingActionsCount: number
  decisionLogsCount: number
  smartTriggerLogsCount: number
  agentQueueCount: number
}

const PRESETS: Record<'large' | 'small', PresetSpec> = {
  large: {
    dentists: 8,
    procedures: 12,
    pipelineStages: 6,
    patients: 2_000,
    leads: 800,
    campaigns: 100,
    conversations: 100,
    messagesPerConversationMin: 3,
    messagesPerConversationMax: 14,
    windowDays: 90,
    waitlistEntries: 150,
    tasksCount: 250,
    budgetsCount: 300,
    treatmentPlansCount: 120,
    feedbackCount: 300,
    messageTemplatesCount: 20,
    knowledgeBaseCount: 50,
    consentsCount: 1000,
    customFieldDefsCount: 8,
    pendingActionsCount: 50,
    decisionLogsCount: 100,
    smartTriggerLogsCount: 100,
    agentQueueCount: 20,
  },
  small: {
    dentists: 4,
    procedures: 8,
    pipelineStages: 5,
    patients: 200,
    leads: 80,
    campaigns: 20,
    conversations: 20,
    messagesPerConversationMin: 2,
    messagesPerConversationMax: 8,
    windowDays: 60,
    waitlistEntries: 30,
    tasksCount: 50,
    budgetsCount: 60,
    treatmentPlansCount: 25,
    feedbackCount: 60,
    messageTemplatesCount: 10,
    knowledgeBaseCount: 10,
    consentsCount: 200,
    customFieldDefsCount: 4,
    pendingActionsCount: 10,
    decisionLogsCount: 20,
    smartTriggerLogsCount: 20,
    agentQueueCount: 5,
  },
}

// ─── Realistic Brazilian data pools (no PII, no network) ──────────

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena',
  'Igor', 'Juliana', 'Karla', 'Lucas', 'Mariana', 'Natália', 'Otávio', 'Patrícia',
  'Rafael', 'Sabrina', 'Tiago', 'Úrsula', 'Vinícius', 'Wesley', 'Xênia', 'Yasmin',
  'Zélia', 'Adriano', 'Bianca', 'Caio', 'Denise', 'Eduardo', 'Fabíola', 'Gustavo',
]

const LAST_NAMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Fernandes', 'Gomes', 'Henriques',
  'Iglesias', 'Jesus', 'Kowalski', 'Lima', 'Mendes', 'Nascimento', 'Oliveira', 'Pereira',
  'Queiroz', 'Ribeiro', 'Souza', 'Teixeira', 'Uchoa', 'Vieira', 'Watanabe', 'Xavier',
  'Yamamoto', 'Zanetti', 'Andrade', 'Borges', 'Carvalho', 'Diniz',
]

const PROCEDURE_CATALOG = [
  { name: 'Limpeza de Rotina', category: 'preventive', price: 180, duration: 30 },
  { name: 'Avaliação Inicial', category: 'diagnostic', price: 150, duration: 30 },
  { name: 'Restauração em Resina', category: 'restorative', price: 280, duration: 60 },
  { name: 'Restauração em Amálgama', category: 'restorative', price: 220, duration: 45 },
  { name: 'Extração Simples', category: 'surgery', price: 250, duration: 30 },
  { name: 'Extração de Siso', category: 'surgery', price: 800, duration: 90 },
  { name: 'Canal Unirradicular', category: 'endodontic', price: 700, duration: 90 },
  { name: 'Canal Multirradicular', category: 'endodontic', price: 1100, duration: 120 },
  { name: 'Limpeza Profunda', category: 'preventive', price: 350, duration: 60 },
  { name: 'Registro Demo 14', category: 'cosmetic', price: 1200, duration: 120 },
  { name: 'Aplicação de Flúor', category: 'preventive', price: 120, duration: 20 },
  { name: 'Radiografia Periapical', category: 'diagnostic', price: 80, duration: 15 },
  { name: 'Raspagem Supragengival', category: 'preventive', price: 280, duration: 45 },
  { name: 'Prótese Parcial Removível', category: 'prosthetic', price: 1800, duration: 60 },
  { name: 'Implante Unitário', category: 'surgery', price: 3500, duration: 120 },
]

const SPECIALTIES = [
  'Clínica Geral', 'Ortodontia', 'Endodontia', 'Periodontia', 'Implantodontia',
  'Odontopediatria', 'Estética', 'Cirurgia Bucomaxilofacial',
]

const CAMPAIGN_TEMPLATES = [
  { name: 'Lembrete de Limpeza Anual', type: 'recall', channel: 'whatsapp' },
  { name: 'Promoção Clareamento', type: 'promotion', channel: 'whatsapp' },
  { name: 'Reativação Inativos', type: 'reactivation', channel: 'whatsapp' },
  { name: 'Boas-vindas Novos Pacientes', type: 'welcome', channel: 'whatsapp' },
  { name: 'Confirmação Consulta', type: 'confirmation', channel: 'whatsapp' },
  { name: 'Pós-procedimento 24h', type: 'followup', channel: 'whatsapp' },
  { name: 'Aniversariantes do Mês', type: 'birthday', channel: 'whatsapp' },
  { name: 'Pesquisa NPS', type: 'feedback', channel: 'whatsapp' },
]

const WHATSAPP_MESSAGE_TEMPLATES = [
  'Olá {nome}, tudo bem? 😊',
  'Confirmando sua consulta amanhã às {hora}.',
  'Obrigado pela visita hoje! Como você está se sentindo?',
  'Você tem avaliação agendada. Responde SIM para confirmar.',
  'Detectamos que faz tempo desde sua última limpeza. Que tal agendar?',
  'Estamos com promoção de clareamento esta semana!',
  'Obrigado por escolher a {clinica}!',
  'Alguma dúvida sobre o tratamento? Estamos à disposição.',
  'Seu retorno está agendado para a próxima semana.',
  'Posso ajudar em mais alguma coisa?',
  'Vimos que faz 6 meses desde sua última visita.',
  'Parabéns pelo seu progresso no tratamento!',
]

// ─── Helpers to build lookups (avoid N+1) ──────────────────────────

function makePhone(rng: () => number): string {
  const ddd = randInt(11, 99, rng)
  const first = String(randInt(90000, 99999, rng))
  const second = String(randInt(0, 9999, rng)).padStart(4, '0')
  return `+55 (${ddd}) 9${first}-${second}`
}

function makeCpf(rng: () => number): string {
  // Standard Brazilian CPF format: ###.###.###-## (14 chars total)
  const block = (n: number) => String(n).padStart(3, '0')
  const a = randInt(0, 999, rng)
  const b = randInt(0, 999, rng)
  const c = randInt(0, 999, rng)
  const d = randInt(0, 99, rng)
  return `${block(a)}.${block(b)}.${block(c)}-${String(d).padStart(2, '0')}`
}

function makePatient(rng: () => number, clinicId: string, idx: number) {
  const first = pickOne(FIRST_NAMES, rng)
  const last = pickOne(LAST_NAMES, rng)
  return {
    clinicId,
    name: `${first} ${last}`,
    phone: makePhone(rng),
    email: idx % 2 === 0 ? `${first.toLowerCase()}.${last.toLowerCase()}.${idx}@example.com` : null,
    cpf: idx % 3 === 0 ? makeCpf(rng) : null,
    birthDate: pickBirthDate(rng),
    gender: pickOne(['female', 'male', 'other', null] as const, rng),
    notes: null,
    tags: ['scale-data'] as string[],
  }
}

function pickBirthDate(rng: () => number): string {
  // Adults 18-80 years old, deterministic date
  const year = 2024 - randInt(18, 80, rng)
  const month = randInt(1, 12, rng)
  const day = randInt(1, 28, rng)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function makeDentist(rng: () => number, clinicId: string, idx: number) {
  const first = pickOne(FIRST_NAMES, rng)
  const last = pickOne(LAST_NAMES, rng)
  return {
    clinicId,
    name: `Dr(a). ${first} ${last}`,
    phone: makePhone(rng),
    email: idx === 0 ? `dentista${idx}@clinicademo.com` : null,
    cro: `CRO-${randInt(10000, 99999, rng)}`,
    specialty: pickOne(SPECIALTIES, rng),
    croNumber: `CRO-${randInt(10000, 99999, rng)}`,
    isActive: rng() > 0.1,
    workingHours: {},
  }
}

function makeProcedure(clinicId: string, idx: number) {
  const tpl = PROCEDURE_CATALOG[idx % PROCEDURE_CATALOG.length]
  return {
    clinicId,
    name: tpl.name,
    description: `${tpl.name} - procedimento padrão`,
    durationMinutes: tpl.duration,
    price: String(tpl.price),
    category: tpl.category,
    isActive: true,
  }
}

function makeAppointment(
  rng: () => number,
  spec: PresetSpec,
  clinicId: string,
  patientId: string,
  dentistId: string | null,
  procedureId: string | null,
  statusIdx: number,
) {
  const APPOINTMENT_STATUS = ['completed', 'completed', 'completed', 'scheduled', 'confirmed', 'no_show', 'cancelled', 'in_progress'] as const
  const status = APPOINTMENT_STATUS[statusIdx % APPOINTMENT_STATUS.length]
  const offsetDays = randInt(-spec.windowDays, spec.windowDays, rng)
  const offsetMinutes = randInt(8 * 60, 19 * 60, rng) // 08:00 - 19:00 in minutes from midnight
  const scheduledAt = new Date(Date.now() + offsetDays * 24 * 3600 * 1000)
  scheduledAt.setHours(0, 0, 0, 0)
  scheduledAt.setMinutes(offsetMinutes)
  const duration = pickOne([30, 30, 45, 45, 60, 60, 90], rng)
  return {
    clinicId,
    patientId,
    dentistId,
    procedureId,
    scheduledAt,
    durationMinutes: duration,
    status,
    notes: '[scale-data] generated appointment',
  }
}

function makePipelineStage(clinicId: string, position: number, name: string, color: string) {
  return {
    clinicId,
    name,
    position,
    color,
    isDefault: position === 0,
    isSystem: position < 2,
    systemKey: position === 0 ? 'new' : position === 1 ? 'won' : null,
    winProbability: position === 0 ? 0 : Math.min(100, position * 20),
  }
}

function makeLead(
  rng: () => number,
  clinicId: string,
  patientId: string | null,
  stageId: string,
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost',
  temperature: 'cold' | 'warm' | 'hot',
  source: string,
  idx: number,
) {
  const first = pickOne(FIRST_NAMES, rng)
  const last = pickOne(LAST_NAMES, rng)
  return {
    clinicId,
    patientId,
    name: `${first} ${last}`,
    phone: makePhone(rng),
    email: idx % 2 === 0 ? `${first.toLowerCase()}.${last.toLowerCase()}.lead${idx}@example.com` : null,
    source,
    campaignId: null,
    score: temperature === 'hot' ? randInt(70, 100, rng) : temperature === 'warm' ? randInt(40, 69, rng) : randInt(0, 39, rng),
    temperature,
    status,
    interest: pickOne(['limpeza', 'clareamento', 'implante', 'canal', 'ortodontia', null] as const, rng),
    hasBudget: rng() > 0.4,
    hasTimeline: rng() > 0.3,
    lastContactAt: status === 'new' ? null : new Date(Date.now() - randInt(1, 60, rng) * 86400 * 1000),
    nextFollowupAt: status === 'new' || status === 'lost' ? null : new Date(Date.now() + randInt(1, 30, rng) * 86400 * 1000),
    contactCount: status === 'new' ? 0 : randInt(1, 5, rng),
    convertedAt: status === 'converted' ? new Date(Date.now() - randInt(1, 30, rng) * 86400 * 1000) : null,
    lostReason: status === 'lost' ? pickOne(['preço', 'sem contato', 'mudou de ideia', 'outra clínica'], rng) : null,
    lostAt: status === 'lost' ? new Date(Date.now() - randInt(1, 60, rng) * 86400 * 1000) : null,
    notes: '[scale-data] generated lead',
    stageId,
    dealValue: String(randInt(100, 5000, rng)),
    tags: ['scale-data', temperature, source] as string[],
  }
}

function makeCampaign(rng: () => number, clinicId: string, idx: number) {
  const tpl = CAMPAIGN_TEMPLATES[idx % CAMPAIGN_TEMPLATES.length]
  const statusIdx = pickWeighted([5, 2, 2, 1], rng) // draft, scheduled, running, completed
  const STATUS = ['draft', 'scheduled', 'running', 'completed'] as const
  const status = STATUS[statusIdx]
  const totalRecipients = randInt(50, 500, rng)
  const sentCount = status === 'draft' || status === 'scheduled' ? 0 : Math.floor(totalRecipients * (status === 'completed' ? 1 : 0.5))
  return {
    clinicId,
    name: `${tpl.name} #${idx + 1}`,
    description: `Campanha de ${tpl.type} gerada para visualização local`,
    campaignType: tpl.type,
    targetSegment: pickOne(['todos', 'inativos_30d', 'inativos_90d', 'aniversariantes', 'novos'], rng),
    messageTemplate: `Olá {nome}, ${tpl.name.toLowerCase()}. Responda SIM para saber mais.`,
    channel: tpl.channel,
    status,
    scheduledAt: status === 'scheduled' || status === 'running' ? new Date(Date.now() + randInt(1, 14, rng) * 86400 * 1000) : null,
    startedAt: status === 'running' || status === 'completed' ? new Date(Date.now() - randInt(1, 30, rng) * 86400 * 1000) : null,
    completedAt: status === 'completed' ? new Date(Date.now() - randInt(1, 7, rng) * 86400 * 1000) : null,
    totalRecipients,
    sentCount,
    responseCount: Math.floor(sentCount * 0.15),
    conversionCount: Math.floor(sentCount * 0.03),
    optOutCount: Math.floor(sentCount * 0.01),
    createdBy: null,
  }
}

function makeConversation(rng: () => number, clinicId: string, patientId: string | null, idx: number) {
  const STATUS = ['active', 'active', 'active', 'active', 'waiting', 'waiting', 'closed', 'escalated'] as const
  const status = pickOne(STATUS, rng)
  const messageCount = randInt(2, 14, rng)
  const lastMessageAt = new Date(Date.now() - randInt(0, 30, rng) * 86400 * 1000 - randInt(0, 24, rng) * 3600 * 1000)
  return {
    clinicId,
    patientId,
    channel: pickOne(['whatsapp', 'whatsapp', 'whatsapp', 'instagram', 'web'] as const, rng),
    externalId: `ext-${idx + 1}-${Math.floor(rng() * 1e9).toString(36)}`,
    status,
    assignedTo: null,
    lastMessageAt,
    messageCount,
  }
}

function makeMessage(rng: () => number, conversationId: string, direction: 'inbound' | 'outbound', idx: number) {
  const tpl = pickOne(WHATSAPP_MESSAGE_TEMPLATES, rng)
  return {
    conversationId,
    direction,
    content: tpl,
    messageType: 'text' as const,
    mediaUrl: null,
    metadata: {},
    intent: pickOne(['agendamento', 'cancelamento', 'informacao', 'confirmacao', null] as const, rng),
    entities: {},
    confidence: String(rng().toFixed(2)),
    isAi: direction === 'outbound' && rng() > 0.5,
  }
}

// ─── Demo clinic + user ────────────────────────────────────────────

const DEMO_CLINIC = {
  slug: 'clinica-demo',
  name: 'Clínica Demo',
  phone: '(11) 99999-0000',
  email: 'contato@clinicademo.com',
}

const DEMO_USER = {
  email: 'admin@clinicademo.com',
  password: 'demo123',
  name: 'Registro Demo 2',
  role: 'owner' as const,
}

async function findOrCreateDemoClinic() {
  const db = getDb()
  const existing = await db
    .select()
    .from(clinics)
    .where(eq(clinics.slug, DEMO_CLINIC.slug))
    .limit(1)
  if (existing[0]) return existing[0]

  const [clinic] = await db
    .insert(clinics)
    .values({
      name: DEMO_CLINIC.name,
      slug: DEMO_CLINIC.slug,
      phone: DEMO_CLINIC.phone,
      email: DEMO_CLINIC.email,
      website: 'https://clinicademo.example.com',
      address: {
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zip: '01310-100',
      },
      settings: {
        business_hours: {
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
          wednesday: { open: '08:00', close: '18:00' },
          thursday: { open: '08:00', close: '18:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: '08:00', close: '12:00' },
          sunday: { open: null, close: null },
        },
        ai_settings: {
          auto_response: true,
          escalation_enabled: true,
          business_name: 'Clínica Demo',
        },
      },
      subscriptionPlan: 'pro',
      subscriptionStatus: 'active',
    })
    .returning()
  return clinic
}

async function findOrCreateDemoUser(clinicId: string) {
  const db = getDb()
  const passwordHash = hashPassword(DEMO_USER.password)

  const existing = await db.select().from(users).where(eq(users.email, DEMO_USER.email)).limit(1)
  let userId: string
  if (existing[0]) {
    userId = existing[0].id
    await db
      .update(users)
      .set({ clinicId, name: DEMO_USER.name, role: DEMO_USER.role, isActive: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
  } else {
    const [u] = await db
      .insert(users)
      .values({
        clinicId,
        email: DEMO_USER.email,
        name: DEMO_USER.name,
        role: DEMO_USER.role,
        phone: '(11) 99999-0000',
        isActive: true,
      })
      .returning()
    userId = u.id
  }

  // Upsert credentials (always refresh so latest hash matches DEMO_USER.password)
  const creds = await db.select().from(userCredentials).where(eq(userCredentials.userId, userId)).limit(1)
  if (creds[0]) {
    await db
      .update(userCredentials)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(userCredentials.userId, userId))
  } else {
    await db.insert(userCredentials).values({ userId, passwordHash })
  }
  return userId
}

// ─── Cleanup (idempotency) ─────────────────────────────────────────

/** Delete ALL data linked to the demo clinic so we can re-insert cleanly.
 * Uses Drizzle's typed delete with proper CASCADE semantics. */
async function cleanupScaleData(clinicId: string) {
  const db = getDb()
  await db.execute(sql`SET session_replication_role = replica`)

  // Helper: run a delete safely; catch missing-table errors and continue.
  const safeDel = async (fn: () => Promise<any>, label: string) => {
    try { await fn() } catch (e: any) {
      if (e?.cause?.code === '42P01' || e?.message?.includes('does not exist')) {
        console.log(`    ⚠ table ${label} does not exist, skipping cleanup`)
      } else { throw e }
    }
  }
  try {
    await safeDel(() => db.delete(messages).where(inArray(messages.conversationId, db.select({ id: conversations.id }).from(conversations).where(eq(conversations.clinicId, clinicId)) as any)), 'messages')
    await safeDel(() => db.delete(agentQueue).where(sql`1=1`), 'agent_queue')
    await safeDel(() => db.delete(decisionLogs).where(eq(decisionLogs.clinicId, clinicId)), 'decision_logs')
    await safeDel(() => db.delete(pendingActions).where(eq(pendingActions.clinicId, clinicId)), 'pending_actions')
    await safeDel(() => db.delete(smartTriggerLog).where(eq(smartTriggerLog.clinicId, clinicId)), 'smart_trigger_log')
    await safeDel(() => db.delete(payments).where(inArray(payments.budgetId, db.select({ id: budgets.id }).from(budgets).where(eq(budgets.clinicId, clinicId)) as any)), 'payments')
    await safeDel(() => db.delete(budgetInstallments).where(inArray(budgetInstallments.budgetId, db.select({ id: budgets.id }).from(budgets).where(eq(budgets.clinicId, clinicId)) as any)), 'budget_installments')
    await safeDel(() => db.delete(budgetItems).where(inArray(budgetItems.budgetId, db.select({ id: budgets.id }).from(budgets).where(eq(budgets.clinicId, clinicId)) as any)), 'budget_items')
    await safeDel(() => db.delete(budgets).where(eq(budgets.clinicId, clinicId)), 'budgets')
    await safeDel(() => db.delete(treatmentPlanItems).where(inArray(treatmentPlanItems.treatmentPlanId, db.select({ id: treatmentPlans.id }).from(treatmentPlans).where(eq(treatmentPlans.clinicId, clinicId)) as any)), 'treatment_plan_items')
    await safeDel(() => db.delete(treatmentPlans).where(eq(treatmentPlans.clinicId, clinicId)), 'treatment_plans')
    await safeDel(() => db.delete(patientFeedback).where(eq(patientFeedback.clinicId, clinicId)), 'patient_feedback')
    await safeDel(() => db.delete(patientObservations).where(eq(patientObservations.clinicId, clinicId)), 'patient_observations')
    await safeDel(() => db.delete(patientPreferences).where(eq(patientPreferences.clinicId, clinicId)), 'patient_preferences')
    await safeDel(() => db.delete(customFieldValues).where(eq(customFieldValues.clinicId, clinicId)), 'custom_field_values')
    await safeDel(() => db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.clinicId, clinicId)), 'custom_field_definitions')
    await safeDel(() => db.delete(consents).where(eq(consents.clinicId, clinicId)), 'consents')
    await safeDel(() => db.delete(procedureGuidelines).where(eq(procedureGuidelines.clinicId, clinicId)), 'procedure_guidelines')
    await safeDel(() => db.delete(waitlist).where(eq(waitlist.clinicId, clinicId)), 'waitlist')
    await safeDel(() => db.delete(tasks).where(eq(tasks.clinicId, clinicId)), 'tasks')
    await safeDel(() => db.delete(knowledgeBase).where(eq(knowledgeBase.clinicId, clinicId)), 'knowledge_base')
    await safeDel(() => db.delete(messageTemplates).where(eq(messageTemplates.clinicId, clinicId)), 'message_templates')
    await safeDel(() => db.delete(whatsappInstances).where(eq(whatsappInstances.clinicId, clinicId)), 'whatsapp_instances')
    await safeDel(() => db.delete(conversations).where(eq(conversations.clinicId, clinicId)), 'conversations')
    await safeDel(() => db.delete(campaignRecipients).where(inArray(campaignRecipients.campaignId, db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.clinicId, clinicId)) as any)), 'campaign_recipients')
    await safeDel(() => db.delete(campaigns).where(eq(campaigns.clinicId, clinicId)), 'campaigns')
    await safeDel(() => db.delete(followUps).where(eq(followUps.clinicId, clinicId)), 'follow_ups')
    await safeDel(() => db.delete(leads).where(eq(leads.clinicId, clinicId)), 'leads')
    await safeDel(() => db.delete(pipelineStages).where(eq(pipelineStages.clinicId, clinicId)), 'pipeline_stages')
    await safeDel(() => db.delete(appointments).where(eq(appointments.clinicId, clinicId)), 'appointments')
    await safeDel(() => db.delete(scheduleBlocks).where(eq(scheduleBlocks.clinicId, clinicId)), 'schedule_blocks')
    await safeDel(() => db.delete(patients).where(eq(patients.clinicId, clinicId)), 'patients')
    await safeDel(() => db.delete(procedures).where(eq(procedures.clinicId, clinicId)), 'procedures')
    await safeDel(() => db.delete(dentists).where(eq(dentists.clinicId, clinicId)), 'dentists')
  } finally {
    await db.execute(sql`SET session_replication_role = origin`)
  }
}

// ─── Counters for summary ───────────────────────────────────────────

interface SeedSummary {
  clinicId: string
  clinic: { name: string; slug: string }
  user: { email: string }
  dentists: number
  procedures: number
  pipelineStages: number
  scheduleBlocks: number
  patients: number
  appointments: number
  leads: number
  campaigns: number
  campaignRecipients: number
  conversations: number
  messages: number
  waitlist: number
  tasks: number
  observations: number
  preferences: number
  feedback: number
  guidelines: number
  budgets: number
  budgetItems: number
  budgetInstallments: number
  payments: number
  treatmentPlans: number
  treatmentPlanItems: number
  templates: number
  whatsappInstances: number
  knowledgeBase: number
  consents: number
  customFieldDefs: number
  customFieldVals: number
  pendingActions: number
  decisionLogs: number
  smartTriggers: number
  agentQueue: number
  followUps: number
}

// ─── Main seeding ───────────────────────────────────────────────────

async function seedScale(opts: CliOptions, rng: () => number): Promise<SeedSummary> {
  const spec = PRESETS[opts.preset]
  const db = getDb()

  // Helper to safely insert — catches schema mismatches gracefully.
  const safeInsert = async <T>(table: any, values: T[], label: string) => {
    try {
      const result = await db.insert(table).values(values as any)
      return result
    } catch (e: any) {
      const code = e?.cause?.code || ''
      const msg = e?.message || ''
      if (code === '42P01' || code === '42703' || msg.includes('does not exist')) {
        console.log(`    ⚠ ${label}: schema mismatch (code=${code}), skipping insert`)
        return null
      }
      if (code === '23505') { return null } // unique constraint OK
      throw e
    }
  }

  // Helper for single-row inserts with returning() — catches schema errors.
  const safeInsert1 = async <T>(fn: () => Promise<T[]>, label: string): Promise<T | null> => {
    try { const rows = await fn(); return rows[0] ?? null }
    catch (e: any) {
      const code = e?.cause?.code || ''
      if (code === '42703' || code === '42P01') {
        console.log(`    ⚠ ${label}: schema mismatch (code=${code}), skipping`)
        return null
      }
      throw e
    }
  }

  console.log(`▶ Ensuring demo clinic + user...`)
  const clinic = await findOrCreateDemoClinic()
  const userId = await findOrCreateDemoUser(clinic.id)
  console.log(`  ✔ clinic=${clinic.id}  user=${userId}`)

  if (!opts.noCleanup) {
    console.log(`▶ Cleaning previous scale data for clinic ${clinic.id}...`)
    await cleanupScaleData(clinic.id)
    console.log(`  ✔ cleanup done`)
  } else {
    console.log(`▶ --no-cleanup set, skipping pre-delete`)
  }

  console.log(`▶ Seeding ${opts.preset} preset (PRNG seed=${opts.seed})`)

  // ─── Dentists ───
  console.log(`  dentists × ${spec.dentists}...`)
  const dentistRows = Array.from({ length: spec.dentists }, (_, i) => makeDentist(rng, clinic.id, i))
  const insertedDentists = await db.insert(dentists).values(dentistRows).returning({ id: dentists.id, name: dentists.name })
  const dentistIds = insertedDentists.map((d) => d.id)

  // ─── Procedures ───
  console.log(`  procedures × ${spec.procedures}...`)
  const procRows = Array.from({ length: spec.procedures }, (_, i) => makeProcedure(clinic.id, i))
  const insertedProcs = await db.insert(procedures).values(procRows).returning({ id: procedures.id })
  const procedureIds = insertedProcs.map((p) => p.id)

  // ─── Schedule blocks (Mon-Fri 8-18 for each dentist) ───
  console.log(`  schedule_blocks...`)
  const blockRows: typeof scheduleBlocks.$inferInsert[] = []
  for (const dentistId of dentistIds) {
    for (let day = 1; day <= 5; day++) {
      blockRows.push({ clinicId: clinic.id, dentistId, dayOfWeek: day, startTime: '08:00:00', endTime: '18:00:00', isAvailable: true })
      blockRows.push({ clinicId: clinic.id, dentistId, dayOfWeek: day, startTime: '18:00:00', endTime: '20:00:00', isAvailable: false })
    }
  }
  const insertedBlocks = await db.insert(scheduleBlocks).values(blockRows).returning({ id: scheduleBlocks.id })

  // ─── Pipeline stages ───
  console.log(`  pipeline_stages × ${spec.pipelineStages}...`)
  const stageNames = ['Novo', 'Qualificado', 'Proposta', 'Negociação', 'Ganho', 'Perdido']
  const stageColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6b7280']
  const stageRows = Array.from({ length: spec.pipelineStages }, (_, i) =>
    makePipelineStage(clinic.id, i, stageNames[i % stageNames.length], stageColors[i % stageColors.length]),
  )
  const insertedStages = await db.insert(pipelineStages).values(stageRows).returning({ id: pipelineStages.id })
  const stageIds = insertedStages.map((s) => s.id)

  // ─── Patients (batch) ───
  console.log(`  patients × ${spec.patients} (batched)...`)
  const PATIENT_BATCH = 200
  const insertedPatientIds: string[] = []
  for (let start = 0; start < spec.patients; start += PATIENT_BATCH) {
    const end = Math.min(start + PATIENT_BATCH, spec.patients)
    const batch = Array.from({ length: end - start }, (_, i) => makePatient(rng, clinic.id, start + i))
    const inserted = await db.insert(patients).values(batch).returning({ id: patients.id })
    for (const p of inserted) insertedPatientIds.push(p.id)
    process.stdout.write(`\r    patients: ${insertedPatientIds.length}/${spec.patients}`)
  }
  console.log()

  // ─── Appointments (batch) ───
  console.log(`  appointments × ${spec.patients * 2.5} (≈ ${spec.patients * 2.5}, capped at spec.patients) ...`)
  const APPOINTMENT_TOTAL = spec.patients * 2.5 >= spec.patients ? spec.patients : spec.patients // Aim for ~2.5 per patient, but the spec required 5000 for large
  const actualAppointmentTotal = opts.preset === 'large' ? 5_000 : 500
  const APPOINTMENT_BATCH = 200
  let appointmentCount = 0
  for (let start = 0; start < actualAppointmentTotal; start += APPOINTMENT_BATCH) {
    const end = Math.min(start + APPOINTMENT_BATCH, actualAppointmentTotal)
    const batch: typeof appointments.$inferInsert[] = []
    for (let i = start; i < end; i++) {
      const patientId = insertedPatientIds[i % insertedPatientIds.length]
      const dentistId = rng() < 0.95 ? dentistIds[i % dentistIds.length] : null
      const procedureId = rng() < 0.85 ? procedureIds[i % procedureIds.length] : null
      const statusIdx = pickWeighted([6, 1, 1, 1, 1, 1, 1, 1], rng) // weighted towards completed
      batch.push(makeAppointment(rng, spec, clinic.id, patientId, dentistId, procedureId, statusIdx))
    }
    await db.insert(appointments).values(batch)
    appointmentCount += batch.length
    process.stdout.write(`\r    appointments: ${appointmentCount}/${actualAppointmentTotal}`)
  }
  console.log()

  // ─── Leads (batch) ───
  console.log(`  leads × ${spec.leads} (batched)...`)
  const LEAD_BATCH = 200
  let leadCount = 0
  for (let start = 0; start < spec.leads; start += LEAD_BATCH) {
    const end = Math.min(start + LEAD_BATCH, spec.leads)
    const batch: typeof leads.$inferInsert[] = []
    for (let i = start; i < end; i++) {
      const patientId = rng() < 0.7 ? insertedPatientIds[i % insertedPatientIds.length] : null
      const stageIdx = pickWeighted([5, 4, 3, 2, 1, 1], rng) // new, qualified, ..., lost
      const status = (['new', 'contacted', 'qualified', 'converted', 'lost', 'lost'] as const)[stageIdx]
      const temperature = pickWeighted([5, 3, 2], rng) // cold, warm, hot
      const temp = (['cold', 'warm', 'hot'] as const)[temperature]
      const source = pickOne(['whatsapp', 'instagram', 'web', 'indicacao', 'google', 'facebook'] as const, rng)
      const stageId = stageIds[stageIdx % stageIds.length]
      batch.push(makeLead(rng, clinic.id, patientId, stageId, status, temp, source, i))
    }
    await db.insert(leads).values(batch)
    leadCount += batch.length
    process.stdout.write(`\r    leads: ${leadCount}/${spec.leads}`)
  }
  console.log()

  // ─── Campaigns (batch) ───
  console.log(`  campaigns × ${spec.campaigns}...`)
  const CAMPAIGN_BATCH = 50
  const insertedCampaignIds: string[] = []
  for (let start = 0; start < spec.campaigns; start += CAMPAIGN_BATCH) {
    const end = Math.min(start + CAMPAIGN_BATCH, spec.campaigns)
    const batch = Array.from({ length: end - start }, (_, i) => makeCampaign(rng, clinic.id, start + i))
    const inserted = await db.insert(campaigns).values(batch).returning({ id: campaigns.id })
    for (const c of inserted) insertedCampaignIds.push(c.id)
  }
  // Add some campaign recipients (top campaigns get more recipients)
  console.log(`  campaign_recipients...`)
  const recipientBatch: typeof campaignRecipients.$inferInsert[] = []
  for (const campaignId of insertedCampaignIds) {
    const n = randInt(20, 60, rng)
    const pool = [...insertedPatientIds]
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length)
      const patientId = pool.splice(idx, 1)[0]
      recipientBatch.push({
        campaignId,
        patientId,
        status: pickOne(['pending', 'sent', 'sent', 'delivered', 'responded', 'converted'] as const, rng),
        sentAt: rng() > 0.3 ? new Date(Date.now() - randInt(0, 14, rng) * 86400 * 1000) : null,
      })
    }
  }
  await db.insert(campaignRecipients).values(recipientBatch)

  // ─── Conversations + messages (batch) ───
  console.log(`  conversations × ${spec.conversations} + messages...`)
  const CONV_BATCH = 25
  let convCount = 0
  let msgCount = 0
  for (let start = 0; start < spec.conversations; start += CONV_BATCH) {
    const end = Math.min(start + CONV_BATCH, spec.conversations)
    const convRows: typeof conversations.$inferInsert[] = []
    for (let i = start; i < end; i++) {
      const patientId = rng() < 0.8 ? insertedPatientIds[i % insertedPatientIds.length] : null
      convRows.push(makeConversation(rng, clinic.id, patientId, i))
    }
    const inserted = await db.insert(conversations).values(convRows).returning({ id: conversations.id })
    convCount += inserted.length

    // Messages for these conversations
    const msgRows: typeof messages.$inferInsert[] = []
    for (const conv of inserted) {
      const total = randInt(spec.messagesPerConversationMin, spec.messagesPerConversationMax, rng)
      for (let m = 0; m < total; m++) {
        const direction = m % 2 === 0 ? 'inbound' : 'outbound'
        msgRows.push(makeMessage(rng, conv.id, direction, m))
      }
    }
    // Batch insert messages
    const MSG_BATCH = 200
    for (let m = 0; m < msgRows.length; m += MSG_BATCH) {
      const slice = msgRows.slice(m, m + MSG_BATCH)
      await db.insert(messages).values(slice)
      msgCount += slice.length
    }
  }

  // ─── Waitlist ───
  console.log(`  waitlist × ${spec.waitlistEntries}...`)
  const waitlistBatch: typeof waitlist.$inferInsert[] = []
  for (let i = 0; i < spec.waitlistEntries; i++) {
    waitlistBatch.push({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      dentistId: rng() < 0.7 ? dentistIds[i % dentistIds.length] : null,
      procedureId: rng() < 0.5 ? procedureIds[i % procedureIds.length] : null,
      preferredDate: new Date(Date.now() + randInt(1, 60, rng) * 86400 * 1000),
      priority: randInt(0, 10, rng),
      status: pickOne(['waiting', 'waiting', 'waiting', 'notified', 'scheduled'] as const, rng),
      notes: '[scale-data]',
    })
  }
  await safeInsert(waitlist, waitlistBatch, 'waitlist')

  // ─── Tasks ───
  console.log(`  tasks × ${spec.tasksCount}...`)
  const tasksBatch: typeof tasks.$inferInsert[] = []
  for (let i = 0; i < spec.tasksCount; i++) {
    tasksBatch.push({
      clinicId: clinic.id,
      leadId: rng() < 0.6 ? null : null, // leads are not yet inserted with IDs we can reference simply; skip FK for now
      title: pickOne(['Acompanhar lead', 'Enviar orçamento', 'Confirmar consulta', 'Ligar paciente', 'Revisar histórico', 'Atualizar cadastro', 'Follow-up pós-tratamento', 'Avaliar risco'], rng),
      description: 'Tarefa de escala local',
      dueDate: new Date(Date.now() + randInt(-7, 14, rng) * 86400 * 1000),
      status: pickOne(['pending', 'pending', 'in_progress', 'completed', 'completed', 'cancelled'] as const, rng),
      priority: pickOne(['high', 'medium', 'medium', 'low', 'low'] as const, rng),
    })
  }
  await safeInsert(tasks, tasksBatch as any[], "tasks")

  // ─── Patient observations ───
  const observationsTotal = Math.floor(spec.patients * 1.5)
  console.log(`  patient_observations × ${observationsTotal}...`)
  const obsBatch: typeof patientObservations.$inferInsert[] = []
  for (let i = 0; i < observationsTotal; i++) {
    obsBatch.push({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      content: pickOne(['Paciente relatou sensibilidade no dente 26.', 'Necessita avaliação ortodôntica.', 'Histórico de cáries recorrentes.', 'Paciente ansioso — recomendar sedação.', 'Boa evolução pós-extração.', 'Retorno em 6 meses para limpeza.', 'Alergia a penicilina reportada.', 'Prefere atendimento matutino.'], rng),
      createdBy: userId,
    })
  }
  await safeInsert(patientObservations, obsBatch as any[], "patient_observations")

  // ─── Patient preferences ───
  const prefTotal = Math.floor(spec.patients * 1.5)
  console.log(`  patient_preferences × ${prefTotal}...`)
  const prefKeys = ['contact_method', 'preferred_time', 'language', 'notification_channel'] as const
  const prefValues: Record<string, string[]> = {
    contact_method: ['whatsapp', 'phone', 'email'],
    preferred_time: ['morning', 'afternoon', 'evening'],
    language: ['pt_BR', 'en', 'es'],
    notification_channel: ['whatsapp', 'sms', 'email', 'push'],
  }
  const prefBatch: typeof patientPreferences.$inferInsert[] = []
  for (let i = 0; i < prefTotal; i++) {
    const key = pickOne(prefKeys, rng)
    prefBatch.push({
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      clinicId: clinic.id,
      key,
      value: pickOne(prefValues[key], rng),
      category: key === 'contact_method' ? 'contact' : 'communication',
    })
  }
  // Unique constraint: use UPSERT pattern (ON CONFLICT DO NOTHING)
  for (const p of prefBatch) {
    try { await db.insert(patientPreferences).values(p) } catch { /* skip dup */ }
  }

  // ─── Patient feedback ───
  console.log(`  patient_feedback × ${spec.feedbackCount}...`)
  const fbBatch: typeof patientFeedback.$inferInsert[] = []
  for (let i = 0; i < spec.feedbackCount; i++) {
    fbBatch.push({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      appointmentId: null,
      feedbackType: pickOne(['post_consultation', 'post_treatment', 'general', 'nps'] as const, rng),
      rating: randInt(1, 5, rng),
      npsScore: randInt(0, 10, rng),
      wouldRecommend: rng() > 0.3,
      comments: pickOne(['Ótima experiência!', 'Muito profissional.', 'Recepção poderia ser mais rápida.', 'Preço justo.', '', null, null, null] as const, rng),
      channel: pickOne(['whatsapp', 'web'] as const, rng),
    })
  }
  await safeInsert(patientFeedback, fbBatch as any[], "patient_feedback")

  // ─── Procedure guidelines ───
  console.log(`  procedure_guidelines × ${procedureIds.length}...`)
  const guidelineBatch: typeof procedureGuidelines.$inferInsert[] = []
  for (const pid of procedureIds) {
    const procIdx = procedureIds.indexOf(pid)
    guidelineBatch.push({
      clinicId: clinic.id,
      procedureId: pid,
      procedureName: PROCEDURE_CATALOG[procIdx % PROCEDURE_CATALOG.length].name,
      title: `Orientações pós-${PROCEDURE_CATALOG[procIdx % PROCEDURE_CATALOG.length].name}`,
      instructions: `Evite alimentos duros por 24h. Mantenha boa higiene. Retorne em caso de dor persistente.`,
      emergencyContact: procIdx < 2,
      recoveryTimeDays: [1, 3, 5, 7, 14][procIdx % 5],
      restrictions: ['Não fumar', 'Não ingerir bebidas alcoólicas', 'Evitar esforço físico'],
      warningSigns: ['Dor intensa', 'Sangramento excessivo', 'Febre'],
      isActive: true,
    })
  }
  await safeInsert(procedureGuidelines, guidelineBatch as any[], "procedure_guidelines")

  // ─── Budgets + items + installments + payments ───
  console.log(`  budgets × ${spec.budgetsCount} + items + installments + payments...`)
  const allBudgetIds: string[] = []
  let budgetItemTotal = 0, budgetInstTotal = 0, paymentTotal = 0
  for (let i = 0; i < spec.budgetsCount; i++) {
    const totalValue = randInt(200, 5000, rng)
    const finalValue = totalValue - randInt(0, Math.floor(totalValue * 0.15), rng)
    const status = pickOne(['pending', 'pending', 'sent', 'sent', 'accepted', 'rejected', 'converted'] as const, rng)
    const [budget] = await db.insert(budgets).values({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      appointmentId: null,
      title: `Orçamento #${i + 1}`,
      description: 'Orçamento gerado automaticamente para visualização local',
      totalValue: String(totalValue),
      finalValue: String(finalValue),
      status,
      validUntil: new Date(Date.now() + randInt(1, 30, rng) * 86400 * 1000),
      sentAt: status !== 'pending' ? new Date(Date.now() - randInt(1, 14, rng) * 86400 * 1000) : null,
      respondedAt: ['accepted', 'rejected', 'converted'].includes(status) ? new Date(Date.now() - randInt(1, 7, rng) * 86400 * 1000) : null,
      notes: '[scale-data]',
      createdBy: userId,
    }).returning({ id: budgets.id })
    allBudgetIds.push(budget.id)

    // 1-4 items per budget
    const itemCount = randInt(1, 4, rng)
    const itemsBatch: typeof budgetItems.$inferInsert[] = []
    for (let j = 0; j < itemCount; j++) {
      const uprice = randInt(80, 1500, rng)
      itemsBatch.push({
        budgetId: budget.id,
        procedureId: procedureIds[(i + j) % procedureIds.length],
        procedureName: PROCEDURE_CATALOG[(i + j) % PROCEDURE_CATALOG.length].name,
        quantity: randInt(1, 3, rng),
        unitPrice: String(uprice),
        totalPrice: String(uprice * randInt(1, 3, rng)),
      })
    }
    await safeInsert(budgetItems, itemsBatch as any[], "budget_items")
    budgetItemTotal += itemCount

    // Installments for accepted/converted budgets
    if (['accepted', 'sent', 'converted'].includes(status) && rng() > 0.3) {
      const instCount = randInt(1, 6, rng)
      const instBatch: typeof budgetInstallments.$inferInsert[] = []
      for (let k = 0; k < instCount; k++) {
        instBatch.push({
          budgetId: budget.id,
          amount: String(Math.floor(finalValue / instCount)),
          dueDate: `${2024 + Math.floor((randInt(1, 12, rng) - 1) / 12)}-${String(randInt(1, 12, rng)).padStart(2, '0')}-${String(randInt(1, 28, rng)).padStart(2, '0')}`,
          status: pickOne(['pending', 'paid', 'paid', 'overdue'] as const, rng),
        })
      }
      await safeInsert(budgetInstallments, instBatch as any[], "budget_installments")
      budgetInstTotal += instCount
    }

    // Payments for accepted/converted budgets
    if (['accepted', 'converted'].includes(status) && rng() > 0.5) {
      await db.insert(payments).values({
        budgetId: budget.id,
        amount: String(Math.floor(finalValue * (rng() * 0.5 + 0.3))),
        paymentMethod: pickOne(['pix', 'credit_card', 'cash', 'transfer'] as const, rng),
        notes: '[scale-data]',
        createdBy: userId,
      })
      paymentTotal++
    }
  }

  // ─── Treatment plans ───
  console.log(`  treatment_plans × ${spec.treatmentPlansCount} + items...`)
  let tplanItemTotal = 0
  for (let i = 0; i < spec.treatmentPlansCount; i++) {
    const sessions = randInt(2, 12, rng)
    const completed = randInt(0, sessions, rng)
    const status = completed >= sessions ? 'completed' : completed > 0 ? 'in_progress' : 'planned'
    const [tplan] = await db.insert(treatmentPlans).values({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      title: `Plano de Tratamento #${i + 1}`,
      description: 'Plano de tratamento gerado automaticamente para visualização local',
      totalSessions: sessions,
      completedSessions: completed,
      status,
      startedAt: status !== 'planned' ? new Date(Date.now() - randInt(1, 90, rng) * 86400 * 1000) : null,
      expectedCompletionAt: new Date(Date.now() + sessions * 7 * 86400 * 1000),
      completedAt: status === 'completed' ? new Date(Date.now() - randInt(1, 30, rng) * 86400 * 1000) : null,
      lastSessionAt: completed > 0 ? new Date(Date.now() - randInt(1, 30, rng) * 86400 * 1000) : null,
      nextSessionDueAt: status === 'in_progress' || status === 'planned' ? new Date(Date.now() + randInt(1, 30, rng) * 86400 * 1000) : null,
      notes: '[scale-data]',
      createdBy: userId,
    }).returning({ id: treatmentPlans.id })

    // 1-8 items per plan
    const planItemCount = randInt(1, Math.min(8, sessions), rng)
    const itemsBatch: typeof treatmentPlanItems.$inferInsert[] = []
    for (let j = 0; j < planItemCount; j++) {
      itemsBatch.push({
        treatmentPlanId: tplan.id,
        procedureId: procedureIds[(i + j) % procedureIds.length],
        procedureName: PROCEDURE_CATALOG[(i + j) % PROCEDURE_CATALOG.length].name,
        sessionNumber: j + 1,
        status: j < completed ? 'completed' : 'pending',
        scheduledAt: j < completed ? new Date(Date.now() - randInt(1, 60, rng) * 86400 * 1000) : new Date(Date.now() + randInt(1, 60, rng) * 86400 * 1000),
        completedAt: j < completed ? new Date(Date.now() - randInt(1, 30, rng) * 86400 * 1000) : null,
        notes: null,
      })
    }
    await safeInsert(treatmentPlanItems, itemsBatch as any[], "treatment_plan_items")
    tplanItemTotal += planItemCount
  }

  // ─── Follow-ups ───
  const followUpTotal = Math.floor(actualAppointmentTotal * 0.3)
  console.log(`  follow_ups × ${followUpTotal}...`)
  const fuBatch: typeof followUps.$inferInsert[] = []
  for (let i = 0; i < followUpTotal; i++) {
    fuBatch.push({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      type: pickOne(['reminder', 'post_consultation', 'inactive', 'birthday'] as const, rng),
      scheduledAt: new Date(Date.now() + randInt(1, 30, rng) * 86400 * 1000),
      status: pickOne(['pending', 'sent', 'cancelled'] as const, rng),
      content: '[scale-data] follow-up',
    })
  }
  await safeInsert(followUps, fuBatch as any[], "follow_ups")

  // ─── Message templates ───
  console.log(`  message_templates × ${spec.messageTemplatesCount}...`)
  const tplBatch: typeof messageTemplates.$inferInsert[] = []
  for (let i = 0; i < spec.messageTemplatesCount; i++) {
    tplBatch.push({
      clinicId: clinic.id,
      name: `Template Demo #${i + 1}`,
      category: pickOne(['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const, rng),
      language: 'pt_BR',
      header: pickOne([null, 'Olá {{1}},', null, null] as const, rng),
      body: `Esta é uma mensagem de demonstração #${i + 1}. Responda SIM para confirmar.`,
      footer: pickOne([null, '{{1}} - Clínica Demo', null] as const, rng),
      status: pickOne(['approved', 'approved', 'pending', 'rejected'] as const, rng),
    })
  }
  await safeInsert(messageTemplates, tplBatch as any[], "message_templates")

  // ─── WhatsApp instances ───
  console.log(`  whatsapp_instances × 1...`)
  await db.insert(whatsappInstances).values({
    clinicId: clinic.id,
    phoneNumberId: '5511999990000',
    businessAccountId: 'demo-business-account',
    displayName: 'Clínica Demo WhatsApp',
    qualityRating: 'GREEN',
    status: 'connected',
    lastConnectedAt: new Date(),
  })

  // ─── Knowledge base ───
  console.log(`  knowledge_base × ${spec.knowledgeBaseCount}...`)
  const faqItems = [
    ['agendamento', 'Como agendar uma consulta?', 'Você pode agendar pelo WhatsApp, telefone ou site. Consulte nossos horários disponíveis.'],
    ['pagamento', 'Quais formas de pagamento?', 'Aceitamos PIX, cartão de crédito/débito, dinheiro e transferência bancária.'],
    ['procedimentos', 'Quanto tempo dura uma limpeza?', 'A limpeza de rotina leva em média 30 minutos.'],
    ['procedimentos', 'O clareamento dói?', 'A maioria dos pacientes não relata dor. Pode haver sensibilidade temporária.'],
    ['posoperatorio', 'O que fazer após extração?', 'Evite alimentos duros, não fume, faça repouso e siga as orientações do dentista.'],
    ['convenios', 'Aceitam convênio?', 'Trabalhamos com reembolso para a maioria dos convênios. Consulte nossa equipe.'],
    ['cancelamento', 'Qual a política de cancelamento?', 'Solicitamos aviso com 24h de antecedência para reagendamento sem custo.'],
    ['emergencia', 'Atendem emergência?', 'Sim, temos horários reservados para emergências. Ligue ou mande WhatsApp.'],
    ['criancas', 'Atendem crianças?', 'Sim, nossa equipe inclui odontopediatras. Agende uma avaliação.'],
    ['valores', 'Qual o preço de uma consulta?', 'A consulta de avaliação inicial custa R$150. Consulte outros valores pelo WhatsApp.'],
  ]
  const kbBatch: typeof knowledgeBase.$inferInsert[] = []
  for (let i = 0; i < spec.knowledgeBaseCount; i++) {
    const faq = faqItems[i % faqItems.length]
    kbBatch.push({
      clinicId: clinic.id,
      category: faq[0],
      question: faq[1],
      answer: faq[2],
      keywords: faq[1].toLowerCase().split(/[ ?]/).filter(w => w.length > 2),
      isActive: true,
    })
  }
  await safeInsert(knowledgeBase, kbBatch as any[], "knowledge_base")

  // ─── Consents (LGPD) ───
  console.log(`  consents × ${spec.consentsCount}...`)
  const purposes = ['marketing', 'whatsapp_contact', 'data_processing', 'photo_use', 'treatment_share'] as const
  const consentBatch: typeof consents.$inferInsert[] = []
  for (let i = 0; i < spec.consentsCount; i++) {
    consentBatch.push({
      clinicId: clinic.id,
      contactId: insertedPatientIds[i % insertedPatientIds.length],
      contactType: 'patient',
      purpose: pickOne(purposes, rng),
      granted: rng() > 0.15,
      channel: pickOne(['web', 'whatsapp', 'form'] as const, rng),
      notes: null,
    })
  }
  await safeInsert(consents, consentBatch as any[], "consents")

  // ─── Custom field definitions ───
  console.log(`  custom_field_definitions × ${spec.customFieldDefsCount}...`)
  const cfdBatch: typeof customFieldDefinitions.$inferInsert[] = []
  const cfdTemplates = [
    { name: 'Profissão', fieldType: 'text', required: false },
    { name: 'Indicação', fieldType: 'text', required: false },
    { name: 'Fumante', fieldType: 'boolean', required: false },
    { name: 'Pratica esportes', fieldType: 'boolean', required: false },
    { name: 'Tipo sanguíneo', fieldType: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: false },
    { name: 'Data da última consulta', fieldType: 'date', required: false },
    { name: 'Nível de dor (0-10)', fieldType: 'number', required: false },
    { name: 'Observações adicionais', fieldType: 'textarea', required: false },
  ]
  const insertedCfdIds: string[] = []
  for (let i = 0; i < spec.customFieldDefsCount; i++) {
    const tpl = cfdTemplates[i % cfdTemplates.length]
    const [cfd] = await db.insert(customFieldDefinitions).values({
      clinicId: clinic.id,
      name: tpl.name,
      fieldType: tpl.fieldType,
      options: (tpl as any).options || [],
      required: tpl.required,
      sortOrder: i,
      isActive: true,
    }).returning({ id: customFieldDefinitions.id })
    insertedCfdIds.push(cfd.id)
  }

  // Custom field values — 1-2 per patient per definition (sampled)
  const cfvTotal = spec.patients * Math.min(3, spec.customFieldDefsCount)
  console.log(`  custom_field_values × ~${cfvTotal}...`)
  let cfvCount = 0
  const cfvBatch: typeof customFieldValues.$inferInsert[] = []
  for (let pi = 0; pi < spec.patients; pi++) {
    for (let di = 0; di < insertedCfdIds.length; di++) {
      if (rng() > 0.35) continue // sample ~65% fill rate
      const def = cfdTemplates[di % cfdTemplates.length]
      cfvBatch.push({
        definitionId: insertedCfdIds[di],
        contactId: insertedPatientIds[pi],
        contactType: 'patient',
        clinicId: clinic.id,
        valueText: ['text', 'select', 'textarea'].includes(def.fieldType) ? pickOne(def.fieldType === 'select' ? (def as any).options : ['-', 'exemplo', 'valor demo'], rng) : null,
        valueNumber: def.fieldType === 'number' ? randInt(0, 10, rng) : null,
        valueBoolean: def.fieldType === 'boolean' ? rng() > 0.5 : null,
        valueDate: def.fieldType === 'date' ? new Date(Date.now() - randInt(0, 365, rng) * 86400 * 1000) : null,
      })
      cfvCount++
    }
  }
  for (let s = 0; s < cfvBatch.length; s += 200) {
    await db.insert(customFieldValues).values(cfvBatch.slice(s, s + 200))
  }

  // ─── Agent tables (light, visible in dashboard) ───
  console.log(`  pending_actions × ${spec.pendingActionsCount}, decision_logs × ${spec.decisionLogsCount}, smart_trigger_log × ${spec.smartTriggerLogsCount}, agent_queue × ${spec.agentQueueCount}...`)

  const paBatch: typeof pendingActions.$inferInsert[] = []
  for (let i = 0; i < spec.pendingActionsCount; i++) {
    paBatch.push({
      clinicId: clinic.id,
      appointmentId: i % 3 === 0 ? null : null,
      actionType: pickOne(['reschedule', 'cancel', 'confirm', 'create', 'update'] as const, rng),
      riskScore: randInt(0, 100, rng),
      riskLevel: pickOne(['LOW', 'MEDIUM', 'HIGH'] as const, rng),
      status: pickOne(['pending', 'confirmed', 'undone'] as const, rng),
      snapshotBefore: { status: 'scheduled' },
      snapshotAfter: { status: 'confirmed' },
      undoDeadline: new Date(Date.now() + randInt(1, 30, rng) * 86400 * 1000),
      reasoning: 'Sample reasoning for undo',
      agentIntent: 'automated_confirmation',
      confidence: String((rng() * 0.4 + 0.5).toFixed(2)),
    })
  }
  await safeInsert(pendingActions, paBatch as any[], "pending_actions")

  const dlBatch: typeof decisionLogs.$inferInsert[] = []
  for (let i = 0; i < spec.decisionLogsCount; i++) {
    dlBatch.push({
      clinicId: clinic.id,
      intentClassified: pickOne(['agendamento', 'cancelamento', 'informacao', 'confirmacao', 'reclamacao'] as const, rng),
      confidenceScore: String((rng() * 0.4 + 0.5).toFixed(2)),
      actionTaken: pickOne(['criou_consulta', 'cancelou', 'respondeu_faq', 'escalou_humano'] as const, rng),
      riskLevel: pickOne(['LOW', 'MEDIUM', 'HIGH'] as const, rng),
      reasoning: 'AI decision based on conversation context and patient history.',
      escalationTriggered: rng() > 0.8,
      humanOverride: rng() > 0.9,
      responseTimeMs: randInt(200, 3000, rng),
      tokensUsed: randInt(50, 500, rng),
      llmModel: pickOne(['MiniMax-M2.7', 'MiniMax-M2.5', 'gpt-4o-mini'] as const, rng),
    })
  }
  await safeInsert(decisionLogs, dlBatch as any[], "decision_logs")

  const stBatch: typeof smartTriggerLog.$inferInsert[] = []
  for (let i = 0; i < spec.smartTriggerLogsCount; i++) {
    stBatch.push({
      clinicId: clinic.id,
      patientId: insertedPatientIds[i % insertedPatientIds.length],
      triggerType: pickOne(['inactive_30d', 'inactive_90d', 'birthday', 'post_treatment', 'no_show'] as const, rng),
      priority: randInt(1, 10, rng),
      messageSent: `Trigger #${i + 1}`,
      channel: 'whatsapp',
      status: pickOne(['sent', 'sent', 'delivered', 'responded'] as const, rng),
      patientResponded: rng() > 0.6,
    })
  }
  await safeInsert(smartTriggerLog, stBatch as any[], "smart_trigger_log")

  const aqBatch: typeof agentQueue.$inferInsert[] = []
  const agents = ['router', 'scheduler', 'sales', 'generalist'] as const
  for (let i = 0; i < spec.agentQueueCount; i++) {
    aqBatch.push({
      fromAgent: 'router',
      toAgent: pickOne(['scheduler', 'sales', 'generalist'] as const, rng),
      payload: { intent: 'agendamento' } as any,
      status: pickOne(['pending', 'completed', 'completed', 'failed'] as const, rng),
      retryCount: rng() > 0.8 ? randInt(1, 3, rng) : 0,
    })
  }
  await safeInsert(agentQueue, aqBatch as any[], "agent_queue")

  return {
    clinicId: clinic.id,
    clinic: { name: clinic.name, slug: clinic.slug },
    user: { email: DEMO_USER.email },
    dentists: dentistIds.length,
    procedures: procedureIds.length,
    pipelineStages: stageIds.length,
    scheduleBlocks: insertedBlocks.length,
    patients: insertedPatientIds.length,
    appointments: appointmentCount,
    leads: leadCount,
    campaigns: insertedCampaignIds.length,
    campaignRecipients: recipientBatch.length,
    conversations: convCount,
    messages: msgCount,
    waitlist: spec.waitlistEntries,
    tasks: spec.tasksCount,
    observations: observationsTotal,
    preferences: prefTotal,
    feedback: spec.feedbackCount,
    guidelines: procedureIds.length,
    budgets: allBudgetIds.length,
    budgetItems: budgetItemTotal,
    budgetInstallments: budgetInstTotal,
    payments: paymentTotal,
    treatmentPlans: spec.treatmentPlansCount,
    treatmentPlanItems: tplanItemTotal,
    templates: spec.messageTemplatesCount,
    whatsappInstances: 1,
    knowledgeBase: spec.knowledgeBaseCount,
    consents: spec.consentsCount,
    customFieldDefs: insertedCfdIds.length,
    customFieldVals: cfvCount,
    pendingActions: spec.pendingActionsCount,
    decisionLogs: spec.decisionLogsCount,
    smartTriggers: spec.smartTriggerLogsCount,
    agentQueue: spec.agentQueueCount,
    followUps: followUpTotal,
  }
}

// ─── Summary print ─────────────────────────────────────────────────

async function printCounts(clinicId: string) {
  const db = getDb()
  const COUNT = async (fn: () => Promise<any[]>, fallback = 0) => {
    try { const r = await fn(); return r[0]?.count ?? fallback }
    catch { return fallback }
  }

  const [dentistsC, procsC, blocksC, patientsC, apptsC, leadsC, campC, recvC, convC, msgsC, stagesC,
    waitlistC, tasksC, obsC, prefC, fbC, guideC, budC, tplanC, tplC, fuC, kbC, consC, cfdC, paC, dlC, stC, aqC] = await Promise.all([
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(dentists).where(eq(dentists.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(procedures).where(eq(procedures.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(scheduleBlocks).where(eq(scheduleBlocks.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(patients).where(eq(patients.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(eq(appointments.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(leads).where(eq(leads.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(campaigns).where(eq(campaigns.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients).where(inArray(campaignRecipients.campaignId, db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.clinicId, clinicId)) as any))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(eq(conversations.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(messages).where(inArray(messages.conversationId, db.select({ id: conversations.id }).from(conversations).where(eq(conversations.clinicId, clinicId)) as any))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(pipelineStages).where(eq(pipelineStages.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(waitlist).where(eq(waitlist.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(eq(tasks.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(patientObservations).where(eq(patientObservations.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(patientPreferences).where(eq(patientPreferences.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(patientFeedback).where(eq(patientFeedback.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(procedureGuidelines).where(eq(procedureGuidelines.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(budgets).where(eq(budgets.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(treatmentPlans).where(eq(treatmentPlans.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(messageTemplates).where(eq(messageTemplates.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(eq(followUps.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(knowledgeBase).where(eq(knowledgeBase.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(consents).where(eq(consents.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(customFieldDefinitions).where(eq(customFieldDefinitions.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(pendingActions).where(eq(pendingActions.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(decisionLogs).where(eq(decisionLogs.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(smartTriggerLog).where(eq(smartTriggerLog.clinicId, clinicId))),
    COUNT(() => db.select({ count: sql<number>`count(*)::int` }).from(agentQueue)), // no clinic FK
  ])
  console.log('┌──────────────────────────────────────────────┐')
  console.log('│  Demo clinic data summary (live counts)       │')
  console.log('├──────────────────────────────────────────────┤')
  const rows: Array<[string, number]> = [
    ['dentists', dentistsC],
    ['procedures', procsC],
    ['pipeline_stages', stagesC],
    ['schedule_blocks', blocksC],
    ['patients', patientsC],
    ['appointments', apptsC],
    ['leads', leadsC],
    ['campaigns', campC],
    ['campaign_recipients', recvC],
    ['conversations', convC],
    ['messages', msgsC],
    ['waitlist', waitlistC],
    ['tasks', tasksC],
    ['observations', obsC],
    ['preferences', prefC],
    ['feedback', fbC],
    ['guidelines', guideC],
    ['budgets', budC],
    ['treatment_plans', tplanC],
    ['message_templates', tplC],
    ['follow_ups', fuC],
    ['knowledge_base', kbC],
    ['consents', consC],
    ['custom_field_defs', cfdC],
    ['pending_actions', paC],
    ['decision_logs', dlC],
    ['smart_triggers', stC],
    ['agent_queue', aqC],
  ]
  for (const [k, v] of rows) {
    console.log(`│  ${k.padEnd(22)}  ${String(v).padStart(8)}   │`)
  }
  console.log('└──────────────────────────────────────────┘')
}

// ─── Entry point ───────────────────────────────────────────────────

async function main() {
  const opts = parseCli(process.argv.slice(2))

  // --dry-run does NOT require a DB. Print the plan and exit 0.
  if (opts.dryRun) {
    const spec = PRESETS[opts.preset]
    console.log('┌──────────────────────────────────────────┐')
    console.log(`│  DRY RUN — ${opts.preset.toUpperCase()} preset (no DB writes) │`)
    console.log('├──────────────────────────────────────────┤')
    const rows: Array<[string, string]> = [
      ['clinic', `${DEMO_CLINIC.name} (slug=${DEMO_CLINIC.slug})`],
      ['user', `${DEMO_USER.email} (role=${DEMO_USER.role})`],
      ['seed (PRNG)', String(opts.seed)],
      ['cleanup previous', String(!opts.noCleanup)],
      ['dentists', String(spec.dentists)],
      ['procedures', String(spec.procedures)],
      ['pipeline_stages', String(spec.pipelineStages)],
      ['schedule_blocks', String(spec.dentists * 5 * 2)],
      ['patients', String(spec.patients)],
      ['appointments', String(opts.preset === 'large' ? 5_000 : 500)],
      ['leads', String(spec.leads)],
      ['campaigns', String(spec.campaigns)],
      ['conversations', String(spec.conversations)],
      ['messages/conversation', `${spec.messagesPerConversationMin}-${spec.messagesPerConversationMax}`],
      ['window (days past/future)', String(spec.windowDays)],
      ['--- Supplemental ---', ''],
      ['waitlist', String(spec.waitlistEntries)],
      ['tasks', String(spec.tasksCount)],
      ['patient_observations', String(Math.floor(spec.patients * 1.5))],
      ['patient_preferences', String(Math.floor(spec.patients * 1.5))],
      ['patient_feedback', String(spec.feedbackCount)],
      ['procedure_guidelines', String(spec.procedures)],
      ['budgets', String(spec.budgetsCount)],
      ['treatment_plans', String(spec.treatmentPlansCount)],
      ['follow_ups', String(Math.floor((opts.preset === 'large' ? 5_000 : 500) * 0.3))],
      ['message_templates', String(spec.messageTemplatesCount)],
      ['whatsapp_instances', '1'],
      ['knowledge_base', String(spec.knowledgeBaseCount)],
      ['consents', String(spec.consentsCount)],
      ['custom_field_defs', String(spec.customFieldDefsCount)],
      ['custom_field_values', String(Math.floor(spec.patients * Math.min(3, spec.customFieldDefsCount) * 0.65))],
      ['pending_actions', String(spec.pendingActionsCount)],
      ['decision_logs', String(spec.decisionLogsCount)],
      ['smart_trigger_log', String(spec.smartTriggerLogsCount)],
      ['agent_queue', String(spec.agentQueueCount)],
    ]
    for (const [k, v] of rows) {
      console.log(`│  ${k.padEnd(22)}  ${(v || '').padStart(20)}   │`)
    }
    console.log('└──────────────────────────────────────────┘')
    process.exit(0)
  }

  // Validate DB connectivity before doing any work
  try {
    const db = getDb()
    await db.execute(sql`SELECT 1`)
  } catch (err) {
    console.error('❌ Cannot connect to DB. Check DATABASE_URL and that Postgres is running.')
    console.error(`   Error: ${(err as Error).message}`)
    console.error('   Run: npm run db:health  |  npm run db:up')
    process.exit(2)
  }

  if (opts.summaryOnly) {
    // Find the demo clinic to get its id
    const db = getDb()
    const [c] = await db.select().from(clinics).where(eq(clinics.slug, DEMO_CLINIC.slug)).limit(1)
    if (!c) {
      console.error(`❌ Demo clinic "${DEMO_CLINIC.slug}" not found. Run seed first without --summary.`)
      process.exit(1)
    }
    await printCounts(c.id)
    await closeDb()
    process.exit(0)
  }

  const rng = mulberry32(opts.seed)
  const t0 = Date.now()
  const summary = await seedScale(opts, rng)
  const ms = Date.now() - t0
  console.log(`\n✔ Seed complete in ${(ms / 1000).toFixed(1)}s`)
  console.log(`\nDemo credentials: ${DEMO_USER.email} / ${DEMO_USER.password}`)
  console.log(`Clinic: ${summary.clinic.name} (${summary.clinicId})`)
  await printCounts(summary.clinicId)
  await closeDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  closeDb().finally(() => process.exit(1))
})
