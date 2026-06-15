/**
 * Mock barrel + URL router.
 * Maps API endpoints to deterministic mock data generators.
 */
export { isMockMode } from './use-mock'
export * from './types'
export { installMockFetch, restoreMockFetch } from './fetch-interceptor'

import { isMockMode } from './use-mock'
import {
  createPatient,
  createAppointmentSummary,
  createDentist,
  createProcedure,
  createAppointment,
  createLead,
  createLeadStats,
  createLeadNotifications,
  createCampaign,
  createConversation,
  createTask,
  createContact,
  createContactNote,
  createWaitlistEntry,
  createWaitlistStats,
  createDashboardStats,
  createCrmStats,
  createCalendarEvent,
  createPipelineStages,
  createCustomFieldDefinitions,
  createCustomFieldValues,
  createConsents,
  createActivity,
  createClinicSettings,
  createWhatsAppMessages,
  createPaginationMeta,
  paginate,
  generateArray,
} from './utils'
import { MOCK_IDS } from './types'

// ── URL → Mock Function Router ──

type MockFn = (url: string, params?: URLSearchParams, body?: unknown) => unknown

const router: Map<string, MockFn> = new Map()

function match(pattern: string, fn: MockFn) {
  router.set(pattern, fn)
}

// ── Dashboard ──
match('/api/dashboard/stats', () => createDashboardStats())

// ── Patients ──
match('/api/patients', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const page = parseInt(params.get('page') || '1', 10)
  const limit = parseInt(params.get('limit') || '20', 10)
  const search = params.get('search') || ''

  let all = [
    { ...createPatient(MOCK_IDS.patients.maria, 'Maria Silva', 0), appointments: [createAppointmentSummary(MOCK_IDS.patients.maria, 0, 'completed')] },
    { ...createPatient(MOCK_IDS.patients.joao, 'João Santos', 1), appointments: [] },
    { ...createPatient(MOCK_IDS.patients.ana, 'Ana Costa', 2), appointments: [createAppointmentSummary(MOCK_IDS.patients.ana, 0, 'scheduled')] },
    { ...createPatient(MOCK_IDS.patients.carlos, 'Carlos Lima', 3), appointments: [] },
    ...generateArray(16, (s) => {
      const id = `mock-patient-extra-${String(s + 1).padStart(3, '0')}`
      return { ...createPatient(id, `Paciente Extra ${s + 1}`, s + 10), appointments: s % 3 === 0 ? [createAppointmentSummary(id, s, 'completed')] : [] }
    }),
  ]

  if (search) {
    all = all.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  }

  const total = all.length
  const patients = paginate(all, page, limit)
  return { patients, pagination: createPaginationMeta(page, limit, total) }
})

match('/api/patients/inactive', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const statsOnly = params.get('stats_only') === 'true'
  const minDays = parseInt(params.get('min_days') || '30', 10)

  if (statsOnly) {
    return {
      totalInactive: 34,
      last30Days: minDays <= 30 ? 8 : 0,
      last90Days: 22,
      last180Days: 54,
      avgDaysSinceLastVisit: 67,
    }
  }

  return {
    patients: generateArray(Math.min(minDays, 10), (s) =>
      createPatient(
        `mock-inactive-${String(s + 1).padStart(3, '0')}`,
        `Paciente Inativo ${s + 1}`,
        s + 20,
      ),
    ),
    pagination: createPaginationMeta(1, 20, Math.min(minDays, 10)),
  }
})

// ── Single patient ──
match('/api/patients/', (url) => {
  const id = url.replace('/api/patients/', '').split('?')[0]
  const patientMap: Record<string, ReturnType<typeof createPatient>> = {
    [MOCK_IDS.patients.maria]: createPatient(MOCK_IDS.patients.maria, 'Maria Silva', 0),
    [MOCK_IDS.patients.joao]: createPatient(MOCK_IDS.patients.joao, 'João Santos', 1),
    [MOCK_IDS.patients.ana]: createPatient(MOCK_IDS.patients.ana, 'Ana Costa', 2),
    [MOCK_IDS.patients.carlos]: createPatient(MOCK_IDS.patients.carlos, 'Carlos Lima', 3),
  }
  return patientMap[id] || createPatient(id, `Paciente ${id}`, 42)
})

// ── Dentists ──
match('/api/dentists', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const clinicId = params.get('clinic_id')
  const all = [
    createDentist(MOCK_IDS.dentists.silva, 'Dr. Silva', 'Ortodontia', 'CRO-SP-12345'),
    createDentist(MOCK_IDS.dentists.souza, 'Dra. Souza', 'Implantodontia', 'CRO-RJ-67890'),
    ...generateArray(3, (s) =>
      createDentist(`mock-dentist-extra-${s}`, `Dr. Extra ${s}`, 'Clínico Geral', `CRO-SP-${10000 + s}`),
    ),
  ]
  return { dentists: all, clinic_id: clinicId || MOCK_IDS.clinic }
})

match('/api/dentists/', (url) => {
  const id = url.replace('/api/dentists/', '').split('?')[0]
  const map: Record<string, ReturnType<typeof createDentist>> = {
    [MOCK_IDS.dentists.silva]: createDentist(MOCK_IDS.dentists.silva, 'Dr. Silva', 'Ortodontia', 'CRO-SP-12345'),
    [MOCK_IDS.dentists.souza]: createDentist(MOCK_IDS.dentists.souza, 'Dra. Souza', 'Implantodontia', 'CRO-RJ-67890'),
  }
  return map[id] || createDentist(id, `Dentista ${id}`, 'Clínico Geral', 'CRO-SP-00000')
})

// ── Procedures ──
match('/api/procedures', () => {
  const all = [
    createProcedure(MOCK_IDS.procedures.limpeza, 'Limpeza', 30, 120, 'Preventivo', '#0d9488'),
    createProcedure(MOCK_IDS.procedures.canal, 'Canal', 90, 800, 'Endodontia', '#f59e0b'),
    createProcedure(MOCK_IDS.procedures.implante, 'Implante', 120, 3500, 'Implantodontia', '#8b5cf6'),
    createProcedure(MOCK_IDS.procedures.avaliacao, 'Avaliação', 20, 0, 'Diagnóstico', '#6366f1'),
    ...generateArray(4, (s) =>
      createProcedure(
        `mock-proc-extra-${s}`,
        `Procedimento Extra ${s}`,
        45,
        200 + s * 50,
        'Geral',
        '#3b82f6',
      ),
    ),
  ]
  return { procedures: all, procedure_types: all }
})

match('/api/procedures/', (url) => {
  const id = url.replace('/api/procedures/', '').split('?')[0]
  const map: Record<string, ReturnType<typeof createProcedure>> = {
    [MOCK_IDS.procedures.limpeza]: createProcedure(MOCK_IDS.procedures.limpeza, 'Limpeza', 30, 120, 'Preventivo', '#0d9488'),
    [MOCK_IDS.procedures.canal]: createProcedure(MOCK_IDS.procedures.canal, 'Canal', 90, 800, 'Endodontia', '#f59e0b'),
    [MOCK_IDS.procedures.implante]: createProcedure(MOCK_IDS.procedures.implante, 'Implante', 120, 3500, 'Implantodontia', '#8b5cf6'),
    [MOCK_IDS.procedures.avaliacao]: createProcedure(MOCK_IDS.procedures.avaliacao, 'Avaliação', 20, 0, 'Diagnóstico', '#6366f1'),
  }
  return map[id] || createProcedure(id, `Procedimento ${id}`, 30, 100, 'Geral', '#3b82f6')
})

// ── Appointments ──
match('/api/appointments', (url) => {
  const appointments = [
    createAppointment(MOCK_IDS.patients.maria, 'Maria Silva', MOCK_IDS.dentists.silva, 'Dr. Silva', MOCK_IDS.procedures.limpeza, 'Limpeza', 0),
    createAppointment(MOCK_IDS.patients.joao, 'João Santos', MOCK_IDS.dentists.souza, 'Dra. Souza', MOCK_IDS.procedures.canal, 'Canal', 1),
    createAppointment(MOCK_IDS.patients.ana, 'Ana Costa', MOCK_IDS.dentists.silva, 'Dr. Silva', MOCK_IDS.procedures.avaliacao, 'Avaliação', 2),
    ...generateArray(12, (s) =>
      createAppointment(
        `mock-patient-extra-${String((s % 16) + 1).padStart(3, '0')}`,
        `Paciente ${s + 1}`,
        s % 2 === 0 ? MOCK_IDS.dentists.silva : MOCK_IDS.dentists.souza,
        s % 2 === 0 ? 'Dr. Silva' : 'Dra. Souza',
        s % 2 === 0 ? MOCK_IDS.procedures.limpeza : MOCK_IDS.procedures.implante,
        s % 2 === 0 ? 'Limpeza' : 'Implante',
        s + 3,
      ),
    ),
  ]
  return { appointments }
})

match('/api/appointments/', (url) => {
  const id = url.replace('/api/appointments/', '').split('?')[0]
  return createAppointment(
    MOCK_IDS.patients.maria,
    'Maria Silva',
    MOCK_IDS.dentists.silva,
    'Dr. Silva',
    MOCK_IDS.procedures.limpeza,
    'Limpeza',
    0,
  )
})

// ── Leads ──
match('/api/leads', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const page = parseInt(params.get('page') || '1', 10)
  const limit = parseInt(params.get('limit') || '20', 10)
  const all = [
    createLead(MOCK_IDS.leads.laura, 'Laura Oliveira', 10, 0),
    createLead(MOCK_IDS.leads.felipe, 'Felipe Costa', 11, 1),
    createLead(MOCK_IDS.leads.beatriz, 'Beatriz Lima', 12, 2),
    ...generateArray(17, (s) => createLead(`mock-lead-extra-${s}`, `Lead Extra ${s}`, s + 20, s + 3)),
  ]
  const leads = paginate(all, page, limit)
  return { leads, pagination: createPaginationMeta(page, limit, all.length) }
})

match('/api/leads/stats', () => createLeadStats())
match('/api/leads/notifications', () => createLeadNotifications(5))

match('/api/leads/kanban', () => {
  const stages = createPipelineStages()
  const allLeads = stages.flatMap((s) => s.leads)
  return { leads: allLeads }
})

match('/api/leads/', (url) => {
  const id = url.replace('/api/leads/', '').split('?')[0]
  const map: Record<string, ReturnType<typeof createLead>> = {
    [MOCK_IDS.leads.laura]: createLead(MOCK_IDS.leads.laura, 'Laura Oliveira', 10, 0),
    [MOCK_IDS.leads.felipe]: createLead(MOCK_IDS.leads.felipe, 'Felipe Costa', 11, 1),
    [MOCK_IDS.leads.beatriz]: createLead(MOCK_IDS.leads.beatriz, 'Beatriz Lima', 12, 2),
  }
  return map[id] || createLead(id, `Lead ${id}`, 42, 5)
})

// ── Pipeline ──
match('/api/pipeline/stages', () => {
  const stages = createPipelineStages()
  return { data: stages }
})

// ── Campaigns ──
match('/api/campaigns', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const page = parseInt(params.get('page') || '1', 10)
  const limit = parseInt(params.get('limit') || '20', 10)
  const all = [
    createCampaign(MOCK_IDS.campaigns.promoSorriso, 'Promoção Sorriso Saudável', 0),
    createCampaign(MOCK_IDS.campaigns.lembreteRetorno, 'Lembrete de Retorno', 1),
    createCampaign('mock-campaign-inverno-003', 'Campanha de Inverno', 2),
    ...generateArray(7, (s) => createCampaign(`mock-campaign-extra-${s}`, `Campanha Extra ${s}`, s + 3)),
  ]
  const campaigns = paginate(all, page, limit)
  return { campaigns, pagination: createPaginationMeta(page, limit, all.length) }
})

match('/api/campaigns/', (url) => {
  const id = url.replace('/api/campaigns/', '').split('?')[0]
  const map: Record<string, ReturnType<typeof createCampaign>> = {
    [MOCK_IDS.campaigns.promoSorriso]: createCampaign(MOCK_IDS.campaigns.promoSorriso, 'Promoção Sorriso Saudável', 0),
    [MOCK_IDS.campaigns.lembreteRetorno]: createCampaign(MOCK_IDS.campaigns.lembreteRetorno, 'Lembrete de Retorno', 1),
  }
  return map[id] || createCampaign(id, `Campanha ${id}`, 4)
})

// ── Conversations ──
match('/api/conversations', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const page = parseInt(params.get('page') || '1', 10)
  const limit = parseInt(params.get('limit') || '20', 10)
  const all = generateArray(12, (s) => createConversation(s))
  const conversations = paginate(all, page, limit)
  return { conversations, pagination: createPaginationMeta(page, limit, all.length) }
})

match('/api/conversations/', (url) => {
  const id = url.replace('/api/conversations/', '').split('?')[0]
  const seed = parseInt(id.replace('mock-conv-', ''), 10) || 0
  return createConversation(seed)
})

// ── CRM ──
match('/api/crm/stats', () => createCrmStats())

// ── Tasks ──
match('/api/tasks', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const statusFilter = params.get('status')
  const priorityFilter = params.get('priority')
  let tasks = generateArray(12, (s) => createTask(s))
  if (statusFilter && statusFilter !== 'all') {
    tasks = tasks.filter((t) => t.status === statusFilter)
  }
  if (priorityFilter && priorityFilter !== 'all') {
    tasks = tasks.filter((t) => t.priority === priorityFilter)
  }
  return { tasks }
})

// ── Contacts ──
match('/api/contacts', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const page = parseInt(params.get('page') || '1', 10)
  const limit = parseInt(params.get('limit') || '20', 10)
  const all = generateArray(15, (s) => createContact(s))
  const contacts = paginate(all, page, limit)
  return { contacts, pagination: createPaginationMeta(page, limit, all.length) }
})

match('/api/contacts/', (url) => {
  const remaining = url.replace('/api/contacts/', '')
  // Check if it's a sub-resource: /api/contacts/:id/timeline, /notes, etc.
  const parts = remaining.split('?')[0].split('/')
  const id = parts[0]
  const params = new URLSearchParams(remaining.split('?')[1] || '')
  const type = params.get('type') || 'patient'
  const subResource = parts[1]

  if (subResource === 'timeline') {
    const activities = generateArray(10, (s) => createActivity(s))
    return { items: activities, next_cursor: null }
  }
  if (subResource === 'notes') {
    return { notes: generateArray(3, (s) => createContactNote(id, s)) }
  }
  // Plain contact
  return createContact(parseInt(id.replace(/\D/g, ''), 10) % 15 || 0)
})

// ── Custom fields ──
match('/api/custom-fields/definitions', () => {
  return { definitions: createCustomFieldDefinitions() }
})

match('/api/custom-fields/values', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const contactId = params.get('contact_id') || 'mock-contact-001'
  return { values: createCustomFieldValues(contactId) }
})

// ── Consents ──
match('/api/consents', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const contactId = params.get('contact_id') || 'mock-contact-001'
  const contactType = (params.get('contact_type') || 'patient') as 'patient' | 'lead'
  return { consents: createConsents(contactId, contactType) }
})

// ── Waitlist ──
match('/api/waitlist', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const statsOnly = params.get('stats_only') === 'true'
  if (statsOnly) {
    return createWaitlistStats()
  }
  const entries = generateArray(12, (s) => createWaitlistEntry(s))
  return { entries, stats: createWaitlistStats() }
})

// ── Activities ──
match('/api/activities', (url) => {
  const params = new URLSearchParams(url.split('?')[1] || '')
  const cursor = params.get('cursor')
  const startIndex = cursor ? parseInt(cursor, 10) : 0
  const pageSize = 10
  const all = generateArray(30, (s) => createActivity(s))
  const items = all.slice(startIndex, startIndex + pageSize)
  const nextCursor = startIndex + pageSize < all.length ? String(startIndex + pageSize) : null
  return { items, next_cursor: nextCursor }
})

// ── Settings ──
match('/api/clinics/settings', () => {
  return createClinicSettings()
})

// ── WhatsApp messages ──
match('/api/messages/whatsapp', () => {
  return { messages: createWhatsAppMessages() }
})

// ── Analytics (used by analytics-charts.tsx raw fetch) ──
match('/api/analytics/insights', () => {
  return {
    appointmentTrends: generateArray(30, (s) => ({
      date: new Date(Date.now() - (29 - s) * 86400000).toISOString().slice(0, 10),
      total: 5 + (s % 5),
      confirmed: 3 + (s % 4),
      cancelled: 1 + (s % 3),
      no_show: s % 7 === 0 ? 1 : 0,
      completed: 3 + (s % 4),
    })),
    hourlyDistribution: generateArray(10, (s) => ({
      hour: 8 + s,
      count: 3 + (s % 6),
      percentage: (3 + (s % 6)) * 2.5,
    })),
    dayOfWeekDistribution: [
      { day: 'Segunda', dayIndex: 1, count: 14, percentage: 20 },
      { day: 'Terça', dayIndex: 2, count: 16, percentage: 23 },
      { day: 'Quarta', dayIndex: 3, count: 13, percentage: 19 },
      { day: 'Quinta', dayIndex: 4, count: 15, percentage: 21 },
      { day: 'Sexta', dayIndex: 5, count: 12, percentage: 17 },
    ],
    metrics: {
      avgAppointmentsPerDay: 8.5,
      peakHour: 10,
      peakDay: 'Terça',
      cancellationRate: 12,
      noShowRate: 5,
      avgConfirmationTime: 4.2,
    },
  }
})

match('/api/analytics/roi', () => {
  return {
    totalRevenue: 45200,
    totalCost: 12500,
    roi: 261.6,
    monthlyRevenue: generateArray(12, (s) => ({
      month: `2026-${String(s + 1).padStart(2, '0')}`,
      revenue: 3000 + s * 500,
      cost: 800 + s * 100,
    })),
    channelBreakdown: [
      { channel: 'WhatsApp', revenue: 18000, percentage: 40 },
      { channel: 'Instagram', revenue: 12000, percentage: 27 },
      { channel: 'Website', revenue: 9000, percentage: 20 },
      { channel: 'Indicação', revenue: 6200, percentage: 13 },
    ],
  }
})

match('/api/analytics/noshow-prediction', () => {
  return {
    predictions: [
      {
        patient_id: MOCK_IDS.patients.carlos,
        patient_name: 'Carlos Lima',
        appointment_id: 'mock-appt-noshow-1',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        risk_score: 0.78,
        riskLevel: 'high',
        factors: [
          { name: 'Histórico de faltas', impact: 0.6, description: '2 faltas nos últimos 6 meses' },
          { name: 'Distância da clínica', impact: 0.3, description: 'Reside a 25km' },
        ],
        recommendations: ['Enviar lembrete 48h antes', 'Oferecer teleconsulta como alternativa'],
      },
      {
        patient_id: MOCK_IDS.patients.ana,
        patient_name: 'Ana Costa',
        scheduled_at: new Date(Date.now() + 172800000).toISOString(),
        risk_score: 0.45,
        riskLevel: 'medium',
        factors: [
          { name: 'Consulta anterior reagendada', impact: 0.5, description: 'Reagendou 2 vezes' },
        ],
        recommendations: ['Confirmar por WhatsApp 24h antes'],
      },
    ],
  }
})

// ── Reminders config (used by configuracao page) ──
match('/api/reminders/config', () => {
  return {
    configs: [
      {
        procedure_type_id: MOCK_IDS.procedures.limpeza,
        procedure_type_name: 'Limpeza',
        hours_before: 24,
        message_template: 'Olá {nome}, lembrete da sua consulta de {procedimento} amanhã às {hora}.',
        enabled: true,
      },
      {
        procedure_type_id: MOCK_IDS.procedures.canal,
        procedure_type_name: 'Canal',
        hours_before: 48,
        message_template: 'Olá {nome}, lembrete da sua consulta de {procedimento} em 2 dias.',
        enabled: true,
      },
    ],
  }
})

// ── Mutation endpoints are handled at hook level (use-queries.ts checks isMockMode()) ──
// No router entries needed for POST/PUT/DELETE — hooks return fake success directly.

// ── Router entry point ──

/**
 * Get mock data for a given URL.
 * Uses longest-prefix match to handle nested routes correctly.
 */
export function getMockForUrl(url: string, params?: URLSearchParams, body?: unknown): unknown {
  const path = extractPath(url)

  // Find all matching patterns and pick the longest (most specific)
  let bestMatch: { pattern: string; fn: MockFn } | null = null

  for (const [pattern, fn] of router.entries()) {
    if (path === pattern) {
      // Exact match wins immediately
      return fn(path, params, body)
    }
    if (path.startsWith(pattern) && (!bestMatch || pattern.length > bestMatch.pattern.length)) {
      bestMatch = { pattern, fn }
    }
  }

  if (bestMatch) {
    return bestMatch.fn(path, params, body)
  }

  console.warn(`[mocks] No mock found for URL: ${url}, returning null`)
  return null
}

/** Extract path from full URL (strip origin/protocol) */
function extractPath(url: string): string {
  if (url.startsWith('http')) {
    try {
      const u = new URL(url)
      return u.pathname + (u.search || '')
    } catch {
      return url
    }
  }
  return url
}

/**
 * List all registered mock URL patterns.
 */
export function getRegisteredUrls(): string[] {
  return Array.from(router.keys())
}
