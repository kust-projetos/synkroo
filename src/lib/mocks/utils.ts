/**
 * Deterministic mock factories — dates relative to "today",
 * consistent counts, stable IDs across pages.
 */
import type {
  MockPatient,
  MockAppointmentSummary,
  MockDentist,
  MockProcedure,
  MockAppointment,
  MockLead,
  MockLeadStats,
  MockLeadNotification,
  MockCampaign,
  MockConversation,
  MockMessage,
  MockTask,
  MockContact,
  MockContactNote,
  MockWaitlistEntry,
  MockWaitlistStats,
  MockDashboardStats,
  MockCrmStats,
  MockCalendarEvent,
  MockPipelineStage,
  MockKanbanLead,
  MockCustomFieldDefinition,
  MockCustomFieldValue,
  MockConsent,
  MockActivity,
  MockClinicSettings,
  MockWhatsAppMessage,
  PaginationMeta,
} from './types'
import { MOCK_IDS } from './types'

// ── Helpers ──

/** Today at midnight UTC */
export function today(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Relative date in ISO string */
export function daysFromNow(offset: number): string {
  const d = today()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString()
}

/** Stable hash for deterministic ID generation */
function hashStr(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Deterministic index from URL-like string */
export function deterministicIndex(seed: string, max: number): number {
  return hashStr(seed) % max
}

/** Brazilian phone formatter */
export function fakePhone(seed: number): string {
  const ddd = ['11', '21', '31', '41', '51', '61', '71'][seed % 7]
  const n1 = 90000 + (seed % 10000)
  const n2 = 1000 + ((seed * 7) % 9000)
  return `(${ddd}) 9${n1}-${n2}`
}

// ── Patient factories ──

export function createPatient(id: string, name: string, seed: number): MockPatient {
  return {
    id,
    clinic_id: MOCK_IDS.clinic,
    name,
    phone: fakePhone(seed),
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    birth_date: daysFromNow(-365 * 25 - seed * 100),
    notes: seed % 3 === 0 ? 'Paciente com histórico de sensibilidade' : null,
    is_active: seed % 5 !== 0,
    created_at: daysFromNow(-365 - seed * 10),
    updated_at: daysFromNow(-seed),
  }
}

export function createAppointmentSummary(
  patientId: string,
  seed: number,
  status: string,
): MockAppointmentSummary {
  return {
    id: `mock-appt-${patientId}-${seed}`,
    scheduled_at: daysFromNow(seed % 30 - 5),
    status,
  }
}

// ── Dentist factories ──

export function createDentist(id: string, name: string, specialty: string, cro: string): MockDentist {
  return {
    id,
    clinic_id: MOCK_IDS.clinic,
    name,
    cro,
    specialty,
    phone: fakePhone(100 + name.length),
    email: `dr.${name.toLowerCase().replace(' ', '.')}@clinic.com`,
    is_active: true,
    created_at: daysFromNow(-730),
    updated_at: daysFromNow(-30),
  }
}

// ── Procedure factories ──

export function createProcedure(
  id: string,
  name: string,
  duration: number,
  price: number | null,
  category: string,
  color: string,
): MockProcedure {
  return {
    id,
    clinic_id: MOCK_IDS.clinic,
    name,
    duration_minutes: duration,
    price,
    color,
    category,
    is_active: true,
    created_at: daysFromNow(-365),
    updated_at: daysFromNow(-30),
  }
}

// ── Appointment factories ──

export function createAppointment(
  patientId: string,
  patientName: string,
  dentistId: string,
  dentistName: string,
  procedureId: string,
  procedureName: string,
  seed: number,
  /** Override day offset (default: seed < 3 ? seed : -seed) */
  dayOffsetOverride?: number,
  /** Override hour (default: 8 + (seed % 9)) */
  hourOverride?: number,
): MockAppointment {
  const statuses: Array<MockAppointment['status']> = [
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
  ]
  const status = statuses[seed % statuses.length]
  const dayOffset = dayOffsetOverride ?? (seed < 3 ? seed : -seed)
  const hour = hourOverride ?? (8 + (seed % 9))
  const dateStr = daysFromNow(dayOffset)
  return {
    id: `mock-appt-full-${patientId.slice(-4)}-${seed}`,
    clinic_id: MOCK_IDS.clinic,
    patient_id: patientId,
    patient_name: patientName,
    dentist_id: dentistId,
    dentist_name: dentistName,
    procedure_id: procedureId,
    procedure_name: procedureName,
    scheduled_at: `${dateStr.slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00.000Z`,
    duration_minutes: 30 + (seed % 3) * 30,
    status,
    notes: status === 'cancelled' ? 'Cancelado pelo paciente' : null,
    created_at: daysFromNow(-seed - 7),
    updated_at: daysFromNow(-seed),
  }
}

// ── Lead factories ──

const leadStatuses: Array<MockLead['status']> = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'converted',
  'lost',
]
const leadTemps: Array<MockLead['temperature']> = ['cold', 'warm', 'hot']
const leadSources = ['whatsapp', 'instagram', 'web', 'referral', 'campaign', 'other']

export function createLead(
  id: string,
  name: string,
  phoneSeed: number,
  seed: number,
): MockLead {
  return {
    id,
    clinic_id: MOCK_IDS.clinic,
    name,
    phone: fakePhone(phoneSeed),
    email: seed % 2 === 0 ? `${name.toLowerCase().replace(' ', '.')}@example.com` : null,
    source: leadSources[seed % leadSources.length],
    status: leadStatuses[seed % leadStatuses.length],
    temperature: leadTemps[seed % leadTemps.length],
    score: 30 + (seed * 13) % 70,
    interest: seed % 4 === 0 ? 'Clareamento dental' : seed % 3 === 0 ? 'Implante' : 'Ortodontia',
    notes: seed % 2 === 0 ? 'Indicado por paciente existente' : null,
    created_at: daysFromNow(-seed * 5 - 10),
    next_followup_at: seed % 3 === 0 ? null : daysFromNow(seed % 7),
  }
}

export function createLeadStats(): MockLeadStats {
  return {
    total: 45,
    byStatus: {
      new: 12,
      contacted: 10,
      qualified: 8,
      proposal: 6,
      negotiation: 4,
      converted: 3,
      lost: 2,
    },
    byTemperature: { cold: 15, warm: 20, hot: 10 },
    conversionRate: 28,
    avgScore: 62,
  }
}

export function createLeadNotifications(count: number): MockLeadNotification[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-notif-${i + 1}`,
    lead_id: `mock-lead-${String(i + 1).padStart(3, '0')}`,
    clinic_id: MOCK_IDS.clinic,
    type: i % 2 === 0 ? 'followup_reminder' : 'new_lead_alert',
    channel: i % 3 === 0 ? 'whatsapp' : 'email',
    sent_at: daysFromNow(-i),
    acknowledged: i > 2,
    lead_name: `Lead ${i + 1}`,
    lead_phone: fakePhone(200 + i),
    lead_score: 40 + (i * 7) % 60,
    lead_source: leadSources[i % leadSources.length],
    lead_interest: i % 2 === 0 ? 'Ortodontia' : 'Implante',
  }))
}

// ── Campaign factories ──

export function createCampaign(
  id: string,
  name: string,
  seed: number,
): MockCampaign {
  const statuses: Array<MockCampaign['status']> = ['draft', 'active', 'paused', 'completed']
  return {
    id,
    clinic_id: MOCK_IDS.clinic,
    name,
    description: `Campanha de ${name.toLowerCase()} para pacientes`,
    type: seed % 2 === 0 ? 'sms' : 'whatsapp',
    status: statuses[seed % statuses.length],
    target_audience: seed % 2 === 0 ? 'Pacientes inativos há 6 meses' : 'Todos os pacientes',
    channel: seed % 2 === 0 ? 'whatsapp' : 'sms',
    sent_count: 50 + seed * 20,
    open_count: 30 + seed * 12,
    response_count: 5 + seed * 3,
    created_at: daysFromNow(-30 - seed * 10),
    start_at: daysFromNow(-20 - seed * 10),
    end_at: seed % 3 === 0 ? daysFromNow(-5) : null,
  }
}

// ── Conversation factories ──

const convoContacts = [
  { id: MOCK_IDS.patients.maria, name: 'Maria Silva' },
  { id: MOCK_IDS.patients.joao, name: 'João Santos' },
  { id: MOCK_IDS.leads.laura, name: 'Laura Oliveira' },
  { id: MOCK_IDS.leads.felipe, name: 'Felipe Costa' },
]

const convoLastMessages = [
  'Olá, gostaria de confirmar minha consulta para amanhã',
  'Qual o valor do procedimento de limpeza?',
  'Tem horário disponível na sexta?',
  'Já realizei o pagamento, podem confirmar?',
  'Preciso reagendar minha consulta',
]

export function createConversation(seed: number): MockConversation {
  const contact = convoContacts[seed % convoContacts.length]
  const statuses: Array<MockConversation['status']> = ['active', 'closed', 'archived']
  const msgCount = 2 + (seed % 5)
  const messages: MockMessage[] = Array.from({ length: msgCount }, (_, i) => ({
    id: `mock-msg-${seed}-${i}`,
    conversation_id: `mock-conv-${seed}`,
    direction: i % 2 === 0 ? 'inbound' : 'outbound',
    content: i % 2 === 0
      ? convoLastMessages[seed % convoLastMessages.length]
      : 'Olá! Sua consulta está confirmada. Qualquer dúvida estamos à disposição.',
    created_at: daysFromNow(-(msgCount - i)),
    metadata: {},
  }))

  return {
    id: `mock-conv-${seed}`,
    clinic_id: MOCK_IDS.clinic,
    contact_id: contact.id,
    contact_name: contact.name,
    contact_phone: fakePhone(300 + seed),
    last_message: messages[messages.length - 1].content,
    last_message_at: messages[messages.length - 1].created_at,
    unread: seed % 3,
    status: statuses[seed % statuses.length],
    created_at: daysFromNow(-seed * 3 - 5),
    updated_at: daysFromNow(-seed),
    messages,
  }
}

// ── Task factories ──

const taskTitles = [
  'Ligar para lead novo',
  'Enviar proposta de implante',
  'Confirmar agendamento de amanhã',
  'Fazer follow-up pós-consulta',
  'Atualizar cadastro do paciente',
  'Enviar lembrete de campanha',
  'Revisar pipeline de vendas',
  'Preparar relatório semanal',
]

export function createTask(seed: number): MockTask {
  const statuses: Array<MockTask['status']> = ['pending', 'in_progress', 'completed', 'cancelled']
  const priorities: Array<MockTask['priority']> = ['low', 'medium', 'high', 'urgent']
  return {
    id: `mock-task-${String(seed + 1).padStart(3, '0')}`,
    title: taskTitles[seed % taskTitles.length],
    description: seed % 3 === 0 ? 'Detalhes adicionais da tarefa' : null,
    due_date: seed % 4 === 0 ? null : daysFromNow(seed % 7),
    status: statuses[seed % statuses.length],
    priority: priorities[seed % priorities.length],
    lead_id: seed % 3 === 0 ? `mock-lead-${String(seed + 1).padStart(3, '0')}` : null,
    lead_name: seed % 3 === 0 ? `Lead ${seed + 1}` : undefined,
    created_at: daysFromNow(-seed - 3),
    updated_at: daysFromNow(-seed % 2),
  }
}

// ── Contact factories ──

export function createContact(seed: number): MockContact {
  const names = ['Maria Silva', 'João Santos', 'Ana Costa', 'Carlos Lima', 'Laura Oliveira']
  const types: Array<MockContact['type']> = ['patient', 'lead']
  return {
    id: `mock-contact-${String(seed + 1).padStart(3, '0')}`,
    clinic_id: MOCK_IDS.clinic,
    name: names[seed % names.length],
    phone: fakePhone(400 + seed),
    email: seed % 3 === 0 ? `contact${seed}@example.com` : null,
    type: types[seed % 2],
    source: seed % 2 === 0 ? 'whatsapp' : 'web',
    status: 'active',
    notes: seed % 2 === 0 ? 'Contato frequente' : null,
    created_at: daysFromNow(-100 - seed * 5),
    updated_at: daysFromNow(-seed),
  }
}

export function createContactNote(contactId: string, seed: number): MockContactNote {
  return {
    id: `mock-note-${seed}`,
    contact_id: contactId,
    content: seed % 2 === 0
      ? 'Paciente ligou confirmando endereço'
      : 'Enviar orçamento por WhatsApp',
    author: 'Dr. Silva',
    created_at: daysFromNow(-seed - 1),
  }
}

// ── Waitlist factories ──

export function createWaitlistEntry(seed: number): MockWaitlistEntry {
  const names = ['Maria Silva', 'João Santos', 'Ana Costa', 'Carlos Lima']
  const statuses: Array<MockWaitlistEntry['status']> = ['waiting', 'notified', 'scheduled', 'expired', 'cancelled']
  return {
    id: `mock-wl-${String(seed + 1).padStart(3, '0')}`,
    clinicId: MOCK_IDS.clinic,
    patientId: `mock-patient-${names[seed % names.length].toLowerCase().replace(' ', '-')}`,
    patientName: names[seed % names.length],
    patientPhone: fakePhone(500 + seed),
    preferredDate: daysFromNow(seed * 3 + 2).slice(0, 10),
    preferredTimeStart: '09:00',
    preferredTimeEnd: '12:00',
    procedureId: seed % 2 === 0 ? MOCK_IDS.procedures.limpeza : MOCK_IDS.procedures.implante,
    procedureName: seed % 2 === 0 ? 'Limpeza' : 'Implante',
    dentistId: seed % 2 === 0 ? MOCK_IDS.dentists.silva : MOCK_IDS.dentists.souza,
    dentistName: seed % 2 === 0 ? 'Dr. Silva' : 'Dra. Souza',
    priority: seed % 5 + 1,
    status: statuses[seed % statuses.length],
    notes: seed % 3 === 0 ? 'Preferência por horário matutino' : undefined,
    createdAt: daysFromNow(-seed * 3 - 5),
    notifiedAt: seed > 2 ? daysFromNow(-seed) : undefined,
    scheduledAppointmentId: seed % 3 === 0 ? `mock-appt-${seed}` : undefined,
  }
}

export function createWaitlistStats(): MockWaitlistStats {
  return {
    total: 12,
    waiting: 6,
    notified: 3,
    scheduled: 2,
    avgWaitDays: 7.5,
  }
}

// ── Dashboard stats ──

export function createDashboardStats(): MockDashboardStats {
  return {
    today: {
      appointments: 8,
      pending: 2,
      confirmed: 4,
      completed: 2,
    },
    metrics: {
      confirmationRate: 85,
      totalPatients: 156,
      activeCampaigns: 3,
      openConversations: 12,
    },
    inactivePatients: {
      totalInactive: 34,
      last30Days: 8,
      last90Days: 22,
    },
  }
}

// ── CRM stats ──

export function createCrmStats(): MockCrmStats {
  return {
    totalPatients: 156,
    activePatients: 122,
    totalLeads: 45,
    conversionRate: 28,
    openTasks: 12,
    upcomingAppointments: 8,
    recentActivityCount: 34,
  }
}

// ── Calendar events ──

export function createCalendarEvent(seed: number): MockCalendarEvent {
  const patients = [
    { id: MOCK_IDS.patients.maria, name: 'Maria Silva' },
    { id: MOCK_IDS.patients.joao, name: 'João Santos' },
    { id: MOCK_IDS.patients.ana, name: 'Ana Costa' },
  ]
  const dentists = [
    { id: MOCK_IDS.dentists.silva, name: 'Dr. Silva' },
    { id: MOCK_IDS.dentists.souza, name: 'Dra. Souza' },
  ]
  const p = patients[seed % patients.length]
  const d = dentists[seed % dentists.length]
  const hour = 8 + (seed % 10)
  const dateStr = daysFromNow(seed - 1)
  return {
    id: `mock-event-${seed}`,
    title: `${p.name} - ${d.name}`,
    start: `${dateStr.slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00`,
    end: `${dateStr.slice(0, 10)}T${String(hour + 1).padStart(2, '0')}:00:00`,
    patientName: p.name,
    patientId: p.id,
    dentistName: d.name,
    dentistId: d.id,
    procedureName: seed % 2 === 0 ? 'Limpeza' : 'Avaliação',
    status: seed % 3 === 0 ? 'confirmed' : 'scheduled',
    color: seed % 2 === 0 ? '#0d9488' : '#f59e0b',
  }
}

// ── Pipeline / Kanban ──

export function createPipelineStages(): MockPipelineStage[] {
  const stages = ['Novos', 'Contatados', 'Qualificados', 'Proposta', 'Negociação']
  return stages.map((name, i) => ({
    id: `mock-stage-${i + 1}`,
    clinic_id: MOCK_IDS.clinic,
    name,
    order_index: i,
    color: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'][i],
    leads: Array.from({ length: 2 + i }, (_, j) => createKanbanLead(i * 5 + j)),
  }))
}

export function createKanbanLead(seed: number): MockKanbanLead {
  return {
    id: `mock-kanban-lead-${seed}`,
    name: `Lead ${seed + 1}`,
    phone: fakePhone(600 + seed),
    status: leadStatuses[seed % leadStatuses.length],
    temperature: leadTemps[seed % leadTemps.length],
    score: 35 + (seed * 11) % 65,
    interest: 'Ortodontia',
  }
}

// ── Custom fields ──

const fieldDefs: Omit<MockCustomFieldDefinition, 'id' | 'clinic_id' | 'created_at'>[] = [
  { name: 'Alergias', field_type: 'text', options: null, required: false },
  { name: 'Plano de saúde', field_type: 'select', options: ['Unimed', 'Bradesco', 'Sulamérica', 'Nenhum'], required: false },
  { name: 'Como conheceu', field_type: 'select', options: ['Indicação', 'Instagram', 'Google', 'Outro'], required: true },
]

export function createCustomFieldDefinitions(): MockCustomFieldDefinition[] {
  return fieldDefs.map((def, i) => ({
    ...def,
    id: `mock-field-def-${i + 1}`,
    clinic_id: MOCK_IDS.clinic,
    created_at: daysFromNow(-180),
  }))
}

export function createCustomFieldValues(contactId: string): MockCustomFieldValue[] {
  return [
    {
      id: `mock-field-val-1-${contactId}`,
      definition_id: 'mock-field-def-1',
      contact_id: contactId,
      value: 'Nenhuma',
      definition_name: 'Alergias',
    },
    {
      id: `mock-field-val-2-${contactId}`,
      definition_id: 'mock-field-def-2',
      contact_id: contactId,
      value: 'Unimed',
      definition_name: 'Plano de saúde',
    },
    {
      id: `mock-field-val-3-${contactId}`,
      definition_id: 'mock-field-def-3',
      contact_id: contactId,
      value: 'Indicação',
      definition_name: 'Como conheceu',
    },
  ]
}

// ── Consents ──

const consentPurposes = ['marketing', 'whatsapp', 'email', 'sms']

export function createConsents(contactId: string, contactType: 'patient' | 'lead'): MockConsent[] {
  return consentPurposes.map((purpose, i) => ({
    id: `mock-consent-${contactId}-${i}`,
    contact_id: contactId,
    contact_type: contactType,
    purpose,
    channel: purpose === 'whatsapp' ? 'whatsapp' : purpose === 'sms' ? 'sms' : 'email',
    granted: i < 3,
    granted_at: daysFromNow(-90 + i * 10),
    revoked_at: i >= 3 ? daysFromNow(-10) : null,
    notes: null,
  }))
}

// ── Activities ──

export function createActivity(seed: number): MockActivity {
  const contactNames = ['Maria Silva', 'João Santos', 'Laura Oliveira']
  const types = [
    'appointment_scheduled',
    'appointment_completed',
    'message_sent',
    'note_added',
    'lead_created',
    'campaign_sent',
  ]
  return {
    id: `mock-activity-${seed}`,
    contact_id: `mock-contact-${String((seed % 5) + 1).padStart(3, '0')}`,
    contact_name: contactNames[seed % contactNames.length],
    type: types[seed % types.length],
    source: seed % 2 === 0 ? 'whatsapp' : 'web',
    description: seed % 2 === 0
      ? 'Agendamento confirmado via WhatsApp'
      : 'Novo lead criado via formulário do site',
    created_at: daysFromNow(-seed),
  }
}

// ── Settings ──

export function createClinicSettings(): MockClinicSettings {
  return {
    id: MOCK_IDS.clinic,
    name: 'Clínica Synkroo',
    logo_url: null,
    timezone: 'America/Sao_Paulo',
    businessHours: { start: '08:00', end: '18:00' },
    workingDays: [1, 2, 3, 4, 5],
    appointmentDuration: 30,
    whatsappConfigured: true,
    notificationsEnabled: true,
  }
}

// ── WhatsApp messages ──

export function createWhatsAppMessages(): MockWhatsAppMessage[] {
  return [
    {
      id: 'mock-wa-1',
      direction: 'inbound',
      content: 'Olá! Gostaria de confirmar meu horário de amanhã',
      created_at: daysFromNow(-1),
      metadata: { delivery_status: 'read' },
    },
    {
      id: 'mock-wa-2',
      direction: 'outbound',
      content: 'Seu horário está confirmado para amanhã às 10h. Até lá!',
      created_at: daysFromNow(-1),
      metadata: { delivery_status: 'delivered' },
    },
    {
      id: 'mock-wa-3',
      direction: 'inbound',
      content: 'Obrigada!',
      created_at: daysFromNow(-1),
      metadata: { delivery_status: 'read' },
    },
    {
      id: 'mock-wa-4',
      direction: 'outbound',
      content: 'Lembrete: sua consulta de limpeza é amanhã às 10h.',
      created_at: daysFromNow(0),
      metadata: { delivery_status: 'sent' },
    },
  ]
}

// ── Pagination helper ──

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

// ── Array paginator ──

export function paginate<T>(items: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit
  return items.slice(start, start + limit)
}

// ── Seeded array generator ──

export function generateArray<T>(count: number, factory: (seed: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}
