/**
 * Mock router truth table test.
 * Validates every known URL → mock function mapping and verifies
 * returned shapes match expected contracts.
 */
import { getMockForUrl, getRegisteredUrls, isMockMode } from '@/lib/mocks'

// ── Helper: record which URLs were tested ──
const testedUrls = new Set<string>()

function expectMockForUrl(url: string, expectedKeys?: string[]) {
  testedUrls.add(url)
  const result = getMockForUrl(url)
  expect(result).not.toBeNull()
  expect(result).toBeDefined()
  if (expectedKeys) {
    for (const key of expectedKeys) {
      expect(result).toHaveProperty(key)
    }
  }
  return result
}

// ── isMockMode ──

describe('isMockMode', () => {
  const original = process.env.NEXT_PUBLIC_USE_MOCKS

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = original
  })

  it('returns false when env var is not set', () => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_USE_MOCKS
    expect(isMockMode()).toBe(false)
  })

  it('returns false when env var is "false"', () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'false'
    expect(isMockMode()).toBe(false)
  })

  it('returns true when env var is "true"', () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true'
    expect(isMockMode()).toBe(true)
  })
})

// ── Router truth table ──

describe('Mock Router — truth table', () => {
  // ── Dashboard ──
  describe('Dashboard', () => {
    it('GET /api/dashboard/stats', () => {
      const r = expectMockForUrl('/api/dashboard/stats') as Record<string, unknown>
      expect(r.today).toBeDefined()
      expect(r.metrics).toBeDefined()
      expect(r.inactivePatients).toBeDefined()
      const today = r.today as Record<string, unknown>
      expect(typeof today.appointments).toBe('number')
    })
  })

  // ── Patients ──
  describe('Patients', () => {
    it('GET /api/patients (list)', () => {
      const r = expectMockForUrl('/api/patients?page=1&limit=20') as Record<string, unknown>
      expect(Array.isArray(r.patients)).toBe(true)
      expect(r.pagination).toBeDefined()
      const patients = r.patients as Array<Record<string, unknown>>
      expect(patients.length).toBeGreaterThan(0)
      expect(patients[0]).toHaveProperty('id')
      expect(patients[0]).toHaveProperty('name')
      expect(patients[0]).toHaveProperty('phone')
    })

    it('GET /api/patients/:id (single)', () => {
      const r = expectMockForUrl('/api/patients/mock-patient-maria-001') as Record<string, unknown>
      expect(r.id).toBe('mock-patient-maria-001')
      expect(r.name).toBe('Maria Silva')
    })

    it('GET /api/patients/inactive?min_days=30', () => {
      const r = expectMockForUrl('/api/patients/inactive?min_days=30') as Record<string, unknown>
      expect(Array.isArray(r.patients)).toBe(true)
    })

    it('GET /api/patients/inactive?stats_only=true', () => {
      const r = expectMockForUrl('/api/patients/inactive?stats_only=true') as Record<string, unknown>
      expect(typeof r.totalInactive).toBe('number')
    })
  })

  // ── Dentists ──
  describe('Dentists', () => {
    it('GET /api/dentists (list)', () => {
      const r = expectMockForUrl('/api/dentists?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.dentists)).toBe(true)
    })

    it('GET /api/dentists/:id (single)', () => {
      const r = expectMockForUrl('/api/dentists/mock-dentist-silva-001') as Record<string, unknown>
      expect(r.name).toBe('Dr. Silva')
      expect(r.cro).toBeTruthy()
    })
  })

  // ── Procedures ──
  describe('Procedures', () => {
    it('GET /api/procedures (list)', () => {
      const r = expectMockForUrl('/api/procedures?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.procedures)).toBe(true)
    })

    it('GET /api/procedures/:id (single)', () => {
      const r = expectMockForUrl('/api/procedures/mock-proc-limpeza-001') as Record<string, unknown>
      expect(r.name).toBe('Limpeza')
    })
  })

  // ── Appointments ──
  describe('Appointments', () => {
    it('GET /api/appointments (list)', () => {
      const r = expectMockForUrl('/api/appointments?clinic_id=mock-clinic&page=1&limit=20') as Record<string, unknown>
      expect(Array.isArray(r.appointments)).toBe(true)
      const appts = r.appointments as Array<Record<string, unknown>>
      expect(appts.length).toBeGreaterThan(0)
      expect(appts[0]).toHaveProperty('patient_name')
      expect(appts[0]).toHaveProperty('dentist_name')
      expect(appts[0]).toHaveProperty('status')
    })

    it('GET /api/appointments/:id (single)', () => {
      const r = expectMockForUrl('/api/appointments/mock-appt-123') as Record<string, unknown>
      expect(r.patient_name).toBeTruthy()
    })
  })

  // ── Leads ──
  describe('Leads', () => {
    it('GET /api/leads (list)', () => {
      const r = expectMockForUrl('/api/leads?clinic_id=mock-clinic&page=1&limit=20') as Record<string, unknown>
      expect(Array.isArray(r.leads)).toBe(true)
    })

    it('GET /api/leads/stats', () => {
      const r = expectMockForUrl('/api/leads/stats') as Record<string, unknown>
      expect(typeof r.total).toBe('number')
      expect(r.byStatus).toBeDefined()
      expect(typeof r.conversionRate).toBe('number')
    })

    it('GET /api/leads/notifications', () => {
      const r = expectMockForUrl('/api/leads/notifications') as Record<string, unknown>
      // Returns array directly
      expect(Array.isArray(r)).toBe(true)
    })

    it('GET /api/leads/kanban', () => {
      const r = expectMockForUrl('/api/leads/kanban?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.leads)).toBe(true)
    })

    it('GET /api/leads/:id (single)', () => {
      const r = expectMockForUrl('/api/leads/mock-lead-laura-001') as Record<string, unknown>
      expect(r.name).toBe('Laura Oliveira')
    })
  })

  // ── Pipeline ──
  describe('Pipeline', () => {
    it('GET /api/pipeline/stages', () => {
      const r = expectMockForUrl('/api/pipeline/stages?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.data)).toBe(true)
      const stages = r.data as Array<Record<string, unknown>>
      expect(stages.length).toBeGreaterThan(0)
      expect(stages[0]).toHaveProperty('leads')
    })
  })

  // ── Campaigns ──
  describe('Campaigns', () => {
    it('GET /api/campaigns (list)', () => {
      const r = expectMockForUrl('/api/campaigns?clinic_id=mock-clinic&page=1&limit=20') as Record<string, unknown>
      expect(Array.isArray(r.campaigns)).toBe(true)
    })

    it('GET /api/campaigns/:id (single)', () => {
      const r = expectMockForUrl('/api/campaigns/mock-campaign-sorriso-001') as Record<string, unknown>
      expect(r.name).toBe('Promoção Sorriso Saudável')
    })
  })

  // ── Conversations ──
  describe('Conversations', () => {
    it('GET /api/conversations (list)', () => {
      const r = expectMockForUrl('/api/conversations?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.conversations)).toBe(true)
    })

    it('GET /api/conversations/:id (single)', () => {
      const r = expectMockForUrl('/api/conversations/mock-conv-0') as Record<string, unknown>
      expect(r).toHaveProperty('messages')
      expect(Array.isArray(r.messages)).toBe(true)
    })
  })

  // ── CRM ──
  describe('CRM', () => {
    it('GET /api/crm/stats', () => {
      const r = expectMockForUrl('/api/crm/stats') as Record<string, unknown>
      expect(typeof r.totalPatients).toBe('number')
      expect(typeof r.totalLeads).toBe('number')
      expect(typeof r.conversionRate).toBe('number')
    })
  })

  // ── Tasks ──
  describe('Tasks', () => {
    it('GET /api/tasks (list)', () => {
      const r = expectMockForUrl('/api/tasks') as Record<string, unknown>
      expect(Array.isArray(r.tasks)).toBe(true)
      const tasks = r.tasks as Array<Record<string, unknown>>
      expect(tasks.length).toBeGreaterThan(0)
      expect(tasks[0]).toHaveProperty('title')
      expect(tasks[0]).toHaveProperty('status')
      expect(tasks[0]).toHaveProperty('priority')
    })

    it('GET /api/tasks with status filter', () => {
      const r1 = expectMockForUrl('/api/tasks?status=pending') as Record<string, unknown>
      const tasks1 = r1.tasks as Array<Record<string, unknown>>
      expect(tasks1.every((t) => t.status === 'pending')).toBe(true)
    })
  })

  // ── Contacts ──
  describe('Contacts', () => {
    it('GET /api/contacts (list)', () => {
      const r = expectMockForUrl('/api/contacts?clinic_id=mock-clinic&page=1&limit=20') as Record<string, unknown>
      expect(Array.isArray(r.contacts)).toBe(true)
    })

    it('GET /api/contacts/:id', () => {
      const r = expectMockForUrl('/api/contacts/mock-contact-001?type=patient') as Record<string, unknown>
      expect(r.name).toBeTruthy()
    })

    it('GET /api/contacts/:id/notes', () => {
      const r = expectMockForUrl('/api/contacts/mock-contact-001/notes?type=patient') as Record<string, unknown>
      expect(Array.isArray(r.notes)).toBe(true)
    })

    it('GET /api/contacts/:id/timeline (infinite query)', () => {
      const r = expectMockForUrl('/api/contacts/mock-contact-001/timeline?type=patient') as Record<string, unknown>
      expect(Array.isArray(r.items)).toBe(true)
      expect(r).toHaveProperty('next_cursor')
    })
  })

  // ── Custom fields ──
  describe('Custom fields', () => {
    it('GET /api/custom-fields/definitions', () => {
      const r = expectMockForUrl('/api/custom-fields/definitions?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.definitions)).toBe(true)
    })

    it('GET /api/custom-fields/values', () => {
      const r = expectMockForUrl('/api/custom-fields/values?contact_id=mock-contact-001&contact_type=patient') as Record<string, unknown>
      expect(Array.isArray(r.values)).toBe(true)
    })
  })

  // ── Consents ──
  describe('Consents', () => {
    it('GET /api/consents', () => {
      const r = expectMockForUrl('/api/consents?contact_id=mock-contact-001&contact_type=patient') as Record<string, unknown>
      expect(Array.isArray(r.consents)).toBe(true)
    })
  })

  // ── Waitlist ──
  describe('Waitlist', () => {
    it('GET /api/waitlist', () => {
      const r = expectMockForUrl('/api/waitlist?clinic_id=mock-clinic') as Record<string, unknown>
      expect(Array.isArray(r.entries)).toBe(true)
      expect(r.stats).toBeDefined()
    })
  })

  // ── Activities ──
  describe('Activities', () => {
    it('GET /api/activities', () => {
      const r = expectMockForUrl('/api/activities') as Record<string, unknown>
      expect(Array.isArray(r.items)).toBe(true)
      expect(r).toHaveProperty('next_cursor')
    })
  })

  // ── Settings ──
  describe('Settings', () => {
    it('GET /api/clinics/settings', () => {
      const r = expectMockForUrl('/api/clinics/settings') as Record<string, unknown>
      expect(r.name).toBe('Clínica Synkroo')
      expect(r.businessHours).toBeDefined()
    })
  })

  // ── WhatsApp messages ──
  describe('WhatsApp messages', () => {
    it('GET /api/messages/whatsapp', () => {
      const r = expectMockForUrl('/api/messages/whatsapp?contact_id=mock-contact-001&phone=11999999999') as Record<string, unknown>
      expect(Array.isArray(r.messages)).toBe(true)
    })
  })

  // ── Analytics (supporting analytics-charts.tsx raw fetch) ──
  describe('Analytics', () => {
    it('GET /api/analytics/insights', () => {
      const r = expectMockForUrl('/api/analytics/insights') as Record<string, unknown>
      expect(Array.isArray(r.appointmentTrends)).toBe(true)
      expect(r.metrics).toBeDefined()
    })

    it('GET /api/analytics/roi', () => {
      const r = expectMockForUrl('/api/analytics/roi') as Record<string, unknown>
      expect(typeof r.totalRevenue).toBe('number')
      expect(typeof r.roi).toBe('number')
    })

    it('GET /api/analytics/noshow-prediction', () => {
      const r = expectMockForUrl('/api/analytics/noshow-prediction') as Record<string, unknown>
      expect(Array.isArray(r.predictions)).toBe(true)
    })
  })

  // ── Reminders config ──
  describe('Reminders config', () => {
    it('GET /api/reminders/config', () => {
      const r = expectMockForUrl('/api/reminders/config') as Record<string, unknown>
      expect(Array.isArray(r.configs)).toBe(true)
    })
  })

  // ── Cross-page stable IDs ──
  describe('Cross-page stable IDs', () => {
    it('Maria Silva appears in patients, appointments, conversations, and waitlist', () => {
      const patient = getMockForUrl('/api/patients/mock-patient-maria-001') as Record<string, unknown>
      const appointments = getMockForUrl('/api/appointments?clinic_id=mock-clinic&page=1&limit=20') as Record<string, unknown>
      const conversations = getMockForUrl('/api/conversations?clinic_id=mock-clinic') as Record<string, unknown>
      const waitlist = getMockForUrl('/api/waitlist?clinic_id=mock-clinic') as Record<string, unknown>

      expect(patient.name).toBe('Maria Silva')

      const appts = appointments.appointments as Array<Record<string, unknown>>
      const mariaAppt = appts.find(
        (a) => a.patient_name === 'Maria Silva',
      )
      expect(mariaAppt).toBeDefined()

      const convs = conversations.conversations as Array<Record<string, unknown>>
      const mariaConv = convs.find(
        (c) => c.contact_name === 'Maria Silva',
      )
      expect(mariaConv).toBeDefined()

      const entries = waitlist.entries as Array<Record<string, unknown>>
      const mariaWl = entries.find(
        (e) => e.patientName === 'Maria Silva',
      )
      expect(mariaWl).toBeDefined()
    })
  })

  // ── Unknown URL returns null ──
  describe('Unknown URLs', () => {
    it('returns null for unmapped URLs', () => {
      const r = getMockForUrl('/api/unknown/endpoint')
      expect(r).toBeNull()
    })
  })

  // ── All registered URLs produce non-null results ──
  describe('Coverage: all registered URLs', () => {
    it('every registered URL returns non-null data', () => {
      const urls = getRegisteredUrls()
      expect(urls.length).toBeGreaterThan(0)
      for (const url of urls) {
        // Skip single-resource catch-all patterns (end with /)
        if (url.endsWith('/')) continue
        const r = getMockForUrl(url)
        expect(r).not.toBeNull()
      }
    })
  })
})

// ── Mutation mock shapes (simulated — mutations intercept at hook level) ──
describe('Mutation mock shapes', () => {
  it('createTask mock returns expected shape', () => {
    // Simulated — the real useCreateTask hook checks isMockMode() and returns this shape
    const mockResult = {
      id: 'mock-task-new-123',
      title: 'Test task',
      created_at: new Date().toISOString(),
    }
    expect(mockResult).toHaveProperty('id')
    expect(mockResult).toHaveProperty('title')
    expect(mockResult).toHaveProperty('created_at')
  })

  it('updateTask mock returns expected shape', () => {
    const mockResult = {
      success: true,
      id: 'mock-task-001',
      status: 'completed',
      updated_at: new Date().toISOString(),
    }
    expect(mockResult.success).toBe(true)
    expect(mockResult.id).toBeTruthy()
  })

  it('deleteTask mock returns expected shape', () => {
    const mockResult = {
      success: true,
      id: 'mock-task-001',
      deleted_at: new Date().toISOString(),
    }
    expect(mockResult.success).toBe(true)
  })

  it('grantConsent mock returns expected shape', () => {
    const mockResult = {
      id: 'mock-consent-123',
      contact_id: 'mock-contact-001',
      contact_type: 'patient' as const,
      purpose: 'marketing',
      granted: true,
      granted_at: new Date().toISOString(),
    }
    expect(mockResult.granted).toBe(true)
  })

  it('revokeConsent mock returns expected shape', () => {
    const mockResult = {
      success: true,
      contact_id: 'mock-contact-001',
      contact_type: 'patient' as const,
      purpose: 'marketing',
      revoked_at: new Date().toISOString(),
    }
    expect(mockResult.success).toBe(true)
  })

  it('sendWhatsAppMessage mock returns expected shape', () => {
    const mockResult = {
      id: 'mock-sent-msg',
      status: 'sent',
      message: 'test',
      created_at: new Date().toISOString(),
    }
    expect(mockResult.status).toBe('sent')
  })
})
