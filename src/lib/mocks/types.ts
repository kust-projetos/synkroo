/**
 * Mock system types — mirrors API response shapes used by dashboard hooks.
 * All types are stable and cross-page consistent.
 */

// ── Core entity IDs (stable across pages) ──
export const MOCK_IDS = {
  clinic: 'mock-clinic-synkroo-001',
  patients: {
    maria: 'mock-patient-maria-001',
    joao: 'mock-patient-joao-002',
    ana: 'mock-patient-ana-003',
    carlos: 'mock-patient-carlos-004',
  },
  dentists: {
    silva: 'mock-dentist-silva-001',
    souza: 'mock-dentist-souza-002',
  },
  procedures: {
    limpeza: 'mock-proc-limpeza-001',
    canal: 'mock-proc-canal-002',
    implante: 'mock-proc-implante-003',
    avaliacao: 'mock-proc-avaliacao-004',
  },
  leads: {
    laura: 'mock-lead-laura-001',
    felipe: 'mock-lead-felipe-002',
    beatriz: 'mock-lead-beatriz-003',
  },
  campaigns: {
    promoSorriso: 'mock-campaign-sorriso-001',
    lembreteRetorno: 'mock-campaign-retorno-002',
  },
} as const

// ── Patient ──
export interface MockPatient {
  id: string
  clinic_id: string
  name: string
  phone: string
  email: string | null
  birth_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  appointments?: MockAppointmentSummary[]
}

export interface MockAppointmentSummary {
  id: string
  scheduled_at: string
  status: string
}

// ── Dentist ──
export interface MockDentist {
  id: string
  clinic_id: string
  name: string
  cro: string | null
  specialty: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Procedure ──
export interface MockProcedure {
  id: string
  clinic_id: string
  name: string
  duration_minutes: number
  price: number | null
  color: string | null
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Appointment ──
export interface MockAppointment {
  id: string
  clinic_id: string
  patient_id: string
  patient_name?: string
  patient_phone?: string
  dentist_id: string
  dentist_name?: string
  procedure_id: string | null
  procedure_name?: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Lead ──
export interface MockLead {
  id: string
  clinic_id: string
  name: string
  phone: string
  email: string | null
  source: string
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'lost'
  temperature: 'cold' | 'warm' | 'hot'
  score: number
  interest: string | null
  notes: string | null
  created_at: string
  next_followup_at: string | null
}

export interface MockLeadStats {
  total: number
  byStatus: Record<string, number>
  byTemperature: Record<string, number>
  conversionRate: number
  avgScore: number
}

export interface MockLeadNotification {
  id: string
  lead_id: string
  clinic_id: string
  type: string
  channel: string
  sent_at: string
  acknowledged: boolean
  lead_name?: string
  lead_phone?: string
  lead_score?: number
  lead_source?: string
  lead_interest?: string
}

// ── Campaign ──
export interface MockCampaign {
  id: string
  clinic_id: string
  name: string
  description: string | null
  type: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  target_audience: string | null
  channel: string | null
  sent_count: number
  open_count: number
  response_count: number
  created_at: string
  start_at: string | null
  end_at: string | null
}

// ── Conversation ──
export interface MockConversation {
  id: string
  clinic_id: string
  contact_id: string
  contact_name?: string
  contact_phone?: string
  last_message: string | null
  last_message_at: string | null
  unread: number
  status: 'active' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  messages?: MockMessage[]
}

export interface MockMessage {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  created_at: string
  metadata?: Record<string, unknown>
}

// ── Task ──
export interface MockTask {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  lead_id: string | null
  lead_name?: string
  created_at: string
  updated_at: string
}

// ── Contact ──
export interface MockContact {
  id: string
  clinic_id: string
  name: string
  phone: string
  email: string | null
  type: 'patient' | 'lead'
  source?: string
  status?: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MockContactNote {
  id: string
  contact_id: string
  content: string
  author: string
  created_at: string
}

// ── Waitlist ──
export interface MockWaitlistEntry {
  id: string
  clinicId: string
  patientId: string
  patientName: string
  patientPhone: string
  preferredDate: string
  preferredTimeStart: string
  preferredTimeEnd: string
  procedureId?: string
  procedureName?: string
  dentistId?: string
  dentistName?: string
  priority: number
  status: 'waiting' | 'notified' | 'scheduled' | 'expired' | 'cancelled'
  notes?: string
  createdAt: string
  notifiedAt?: string
  scheduledAppointmentId?: string
}

export interface MockWaitlistStats {
  total: number
  waiting: number
  notified: number
  scheduled: number
  avgWaitDays: number
}

// ── Dashboard stats ──
export interface MockDashboardStats {
  today: {
    appointments: number
    pending: number
    confirmed: number
    completed: number
  }
  metrics: {
    confirmationRate: number
    totalPatients: number
    activeCampaigns: number
    openConversations: number
  }
  inactivePatients: {
    totalInactive: number
    last30Days: number
    last90Days: number
  }
}

// ── CRM stats ──
export interface MockCrmStats {
  totalPatients: number
  activePatients: number
  totalLeads: number
  conversionRate: number
  openTasks: number
  upcomingAppointments: number
  recentActivityCount: number
}

// ── Calendar event ──
export interface MockCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  patientName: string
  patientId: string
  dentistName: string
  dentistId: string
  procedureName: string | null
  status: string
  color: string | null
}

// ── Pipeline / Kanban ──
export interface MockPipelineStage {
  id: string
  clinic_id: string
  name: string
  order_index: number
  color: string | null
  leads: MockKanbanLead[]
}

export interface MockKanbanLead {
  id: string
  name: string
  phone: string
  status: string
  temperature: string
  score: number
  stage_id?: string
  interest?: string
}

// ── Custom fields ──
export interface MockCustomFieldDefinition {
  id: string
  clinic_id: string
  name: string
  field_type: string
  options: string[] | null
  required: boolean
  created_at: string
}

export interface MockCustomFieldValue {
  id: string
  definition_id: string
  contact_id: string
  value: string
  definition_name?: string
}

// ── Consent ──
export interface MockConsent {
  id: string
  contact_id: string
  contact_type: 'patient' | 'lead'
  purpose: string
  channel: string | null
  granted: boolean
  granted_at: string
  revoked_at: string | null
  notes: string | null
}

// ── Activity ──
export interface MockActivity {
  id: string
  contact_id: string
  contact_name?: string
  type: string
  source: string
  description: string
  created_at: string
}

// ── Settings ──
export interface MockClinicSettings {
  id: string
  name: string
  logo_url: string | null
  timezone: string
  businessHours: {
    start: string
    end: string
  }
  workingDays: number[]
  appointmentDuration: number
  whatsappConfigured: boolean
  notificationsEnabled: boolean
}

// ── WhatsApp messages ──
export interface MockWhatsAppMessage {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  created_at: string
  metadata?: {
    delivery_status?: 'sent' | 'delivered' | 'read'
  }
}

// ── Router result type ──
export type MockRouterResult = Record<string, unknown> | { tasks: MockTask[] } | { leads: MockLead[] } | { patients: MockPatient[]; pagination: PaginationMeta } | { conversations: MockConversation[]; pagination: PaginationMeta } | { contacts: MockContact[]; pagination: PaginationMeta } | { data: unknown } | { messages: MockMessage[] } | unknown

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
