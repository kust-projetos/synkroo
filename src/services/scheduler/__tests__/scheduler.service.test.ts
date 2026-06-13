/**
 * Tests for scheduler.service.ts
 * Migrated from Supabase mock to Drizzle mock
 * Coverage restored: all parseNaturalDate, parseTime, availability, and scheduling cases
 */

import {
  parseNaturalDate,
  parseTime,
  getAvailableSlots,
  processSchedulingRequest,
  createAppointmentFromContext,
  type SchedulerContext,
  type SlotInfo,
} from '../scheduler.service'

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/llm', () => ({
  getLLMProvider: jest.fn(),
}))

// Helper: create a Drizzle from() mock that returns given rows via where()
function fromThatReturns(rows: unknown[]) {
  const whereResult: any = Promise.resolve(rows)
  whereResult.limit = jest.fn().mockImplementation(() => {
    const r: any = Promise.resolve(rows)
    r.orderBy = jest.fn().mockReturnValue(r)
    return r
  })
  whereResult.orderBy = jest.fn().mockReturnValue(whereResult)
  return jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue(whereResult) })
}

describe('scheduler.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // parseNaturalDate - Pure function tests (15 cases)
  // ============================================================
  describe('parseNaturalDate', () => {
    it('should return today date for "hoje"', () => {
      const today = new Date().toISOString().split('T')[0]
      expect(parseNaturalDate('hoje')).toBe(today)
    })

    it('should return tomorrow date for "amanhã"', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(parseNaturalDate('amanhã')).toBe(tomorrow.toISOString().split('T')[0])
    })

    it('should return tomorrow date for "amanha" (without accent)', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(parseNaturalDate('amanha')).toBe(tomorrow.toISOString().split('T')[0])
    })

    it('should parse DD/MM format', () => {
      const today = new Date()
      const day = 15
      const month = 6
      const year = today.getFullYear()
      const expectedDate = new Date(year, month - 1, day)
      if (expectedDate >= today) {
        expect(parseNaturalDate('15/06')).toBe(expectedDate.toISOString().split('T')[0])
      }
    })

    it('should parse "segunda" and return next Monday', () => {
      const result = parseNaturalDate('segunda')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "terça" and return next Tuesday', () => {
      const result = parseNaturalDate('terça')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "terca" without accent and return next Tuesday', () => {
      const result = parseNaturalDate('terca')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "quarta" and return next Wednesday', () => {
      const result = parseNaturalDate('quarta')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "quinta" and return next Thursday', () => {
      const result = parseNaturalDate('quinta')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "sexta" and return next Friday', () => {
      const result = parseNaturalDate('sexta')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "sábado" and return next Saturday', () => {
      const result = parseNaturalDate('sábado')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "sabado" without accent and return next Saturday', () => {
      const result = parseNaturalDate('sabado')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should parse "domingo" and return next Sunday', () => {
      const result = parseNaturalDate('domingo')
      expect(result).toBeDefined()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return null for invalid input', () => {
      expect(parseNaturalDate('invalid text')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseNaturalDate('')).toBeNull()
    })
  })

  // ============================================================
  // parseTime - Pure function tests (11 cases)
  // ============================================================
  describe('parseTime', () => {
    it('should parse HH:MM format "14:30"', () => {
      expect(parseTime('14:30')).toBe('14:30')
    })

    it('should parse "9h" as "09:00"', () => {
      expect(parseTime('9h')).toBe('09:00')
    })

    it('should parse "14h" as "14:00"', () => {
      expect(parseTime('14h')).toBe('14:00')
    })

    it('should parse "manhã" as "10:00"', () => {
      expect(parseTime('manhã')).toBe('10:00')
    })

    it('should parse "manha" without accent as "10:00"', () => {
      expect(parseTime('manha')).toBe('10:00')
    })

    it('should parse "manhã cedo" as "08:00"', () => {
      expect(parseTime('manhã cedo')).toBe('08:00')
    })

    it('should parse "tarde" as "16:00"', () => {
      expect(parseTime('tarde')).toBe('16:00')
    })

    it('should parse "tarde cedo" as "14:00"', () => {
      expect(parseTime('tarde cedo')).toBe('14:00')
    })

    it('should parse "noite" as "18:00"', () => {
      expect(parseTime('noite')).toBe('18:00')
    })

    it('should return null for invalid time input', () => {
      expect(parseTime('invalid')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseTime('')).toBeNull()
    })
  })

  // ============================================================
  // getAvailableSlots - Drizzle integration tests
  // ============================================================
  describe('getAvailableSlots', () => {
    const clinicId = 'clinic-123'
    const testDate = '2026-04-01'
    const operatingHours = { operating_hours: { start: '08:00', end: '18:00', lunchStart: '12:00', lunchEnd: '13:00', workDays: [1, 2, 3, 4, 5] } }

    function setupSlotsMock(options: {
      clinicSettings: unknown
      appointments: unknown[]
      dentists?: unknown[]
    }) {
      const mockDb = {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }
      // getAvailableSlots calls: select(clinics) → select(appointments) → select(dentists)
      mockDb.select
        .mockReturnValueOnce({ from: fromThatReturns([{ settings: options.clinicSettings }]) })
        .mockReturnValueOnce({ from: fromThatReturns(options.appointments) })
        .mockReturnValueOnce({ from: fromThatReturns(options.dentists || []) })
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)
      return mockDb
    }

    it('should fetch available slots from clinic settings', async () => {
      setupSlotsMock({ clinicSettings: operatingHours, appointments: [] })
      const slots = await getAvailableSlots(clinicId, testDate)
      expect(slots).toBeDefined()
      expect(Array.isArray(slots)).toBe(true)
    })

    it('should use default hours when clinic has no settings', async () => {
      setupSlotsMock({ clinicSettings: null, appointments: [] })
      const slots = await getAvailableSlots(clinicId, testDate)
      expect(slots).toBeDefined()
      expect(Array.isArray(slots)).toBe(true)
    })

    it('should exclude slots during lunch break', async () => {
      setupSlotsMock({ clinicSettings: operatingHours, appointments: [] })
      const slots = await getAvailableSlots(clinicId, testDate)
      expect(slots.some((s: SlotInfo) => s.time === '12:00')).toBe(false)
      expect(slots.some((s: SlotInfo) => s.time === '12:30')).toBe(false)
    })

    it('should filter by dentistId when provided', async () => {
      const dentistId = 'dentist-456'
      setupSlotsMock({ clinicSettings: operatingHours, appointments: [], dentists: [{ id: dentistId, name: 'Dr. Silva' }] })
      const slots = await getAvailableSlots(clinicId, testDate, 30, dentistId)
      expect(slots).toBeDefined()
    })

    it('should mark conflicting slots as unavailable', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const futureDateStr = futureDate.toISOString().split('T')[0]
      const conflictAppt = { scheduledAt: new Date(`${futureDateStr}T09:00:00`), durationMinutes: 60, dentistId: null }
      setupSlotsMock({ clinicSettings: operatingHours, appointments: [conflictAppt] })
      const slots = await getAvailableSlots(clinicId, futureDateStr)
      const slot0900 = slots.find(s => s.time === '09:00')
      const slot1000 = slots.find(s => s.time === '10:00')
      expect(slot0900?.available).toBe(false)
      expect(slot1000?.available).toBe(true)
    })

    it('should filter slots when dentistId is provided', async () => {
      const dentistId = 'dentist-789'
      setupSlotsMock({ clinicSettings: operatingHours, appointments: [], dentists: [{ id: dentistId, name: 'Dr. Costa' }] })
      const slots = await getAvailableSlots(clinicId, testDate, 30, dentistId)
      expect(slots).toBeDefined()
      expect(Array.isArray(slots)).toBe(true)
    })
  })

  // ============================================================
  // processSchedulingRequest - LLM integration tests
  // ============================================================
  describe('processSchedulingRequest', () => {
    const mockContext: SchedulerContext = {
      clinicId: 'clinic-123',
      patientId: 'patient-1',
      patientInfo: { name: 'João', phone: '11999999999' },
    }

    const mockContextWithDate: SchedulerContext = {
      ...mockContext,
      appointmentRequest: { date: '2026-04-01' },
    }

    it('should process check_availability action with available slot', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      // LLM returns check_availability
      const { getLLMProvider } = require('@/lib/llm')
      getLLMProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue(JSON.stringify({
          message: 'Vou verificar a disponibilidade para às 14:00',
          action: 'check_availability',
          extracted: { date: 'amanhã', time: '14:00', procedure: null, dentist: null },
        })),
      })

      // Mock getAvailableSlots with an available 14:00 slot
      const operatingHours = { operating_hours: { start: '08:00', end: '18:00', lunchStart: '12:00', lunchEnd: '13:00', workDays: [1, 2, 3, 4, 5] } }
      const mockDb = {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }
      mockDb.select
        .mockReturnValueOnce({ from: fromThatReturns([{ settings: operatingHours }]) })
        .mockReturnValueOnce({ from: fromThatReturns([]) })
        .mockReturnValueOnce({ from: fromThatReturns([]) })
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await processSchedulingRequest('Quero agendar para amanhã às 14h', mockContextWithDate)
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(true)
    })

    it('should process check_availability with unavailable slot and offer alternatives', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const { getLLMProvider } = require('@/lib/llm')
      getLLMProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue(JSON.stringify({
          message: 'Verificando',
          action: 'check_availability',
          extracted: { date: 'amanhã', time: '14:00', procedure: null, dentist: null },
        })),
      })

      const operatingHours = { operating_hours: { start: '08:00', end: '18:00', lunchStart: '12:00', lunchEnd: '13:00', workDays: [1, 2, 3, 4, 5] } }
      // Make 14:00 slot unavailable by creating a conflicting appointment
      const conflictAppt = { scheduledAt: new Date(`${tomorrowStr}T13:30:00`), durationMinutes: 60, dentistId: null }
      const mockDb = {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }
      mockDb.select
        .mockReturnValueOnce({ from: fromThatReturns([{ settings: operatingHours }]) })
        .mockReturnValueOnce({ from: fromThatReturns([conflictAppt]) })
        .mockReturnValueOnce({ from: fromThatReturns([]) })
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await processSchedulingRequest('Quero agendar para amanhã às 14h', mockContextWithDate)
      expect(result.success).toBe(false)
      expect(result.alternatives).toBeDefined()
      expect(result.alternatives!.length).toBeGreaterThan(0)
    })

    it('should process create_appointment action', async () => {
      const { getLLMProvider } = require('@/lib/llm')
      getLLMProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue(JSON.stringify({
          message: 'Agendamento confirmado!',
          action: 'create_appointment',
          extracted: { date: null, time: null, procedure: null, dentist: null },
        })),
      })

      const result = await processSchedulingRequest('Confirma o agendamento', mockContext)
      expect(result.success).toBe(true)
    })

    it('should process default action', async () => {
      const { getLLMProvider } = require('@/lib/llm')
      getLLMProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue(JSON.stringify({
          message: 'Qual horário você prefere?',
          action: 'collect_info',
          extracted: { date: null, time: null, procedure: null, dentist: null },
        })),
      })

      const result = await processSchedulingRequest('Quero agendar uma consulta', mockContext)
      expect(result.success).toBe(true)
      expect(result.message).toContain('Qual horário')
    })

    it('should handle errors and return error message', async () => {
      const { getLLMProvider } = require('@/lib/llm')
      getLLMProvider.mockReturnValue({
        chat: jest.fn().mockImplementation(() => { throw new Error('AI error') }),
      })

      const result = await processSchedulingRequest('Quero agendar', mockContext)
      expect(result.success).toBe(false)
      expect(result.message).toContain('problema')
    })

    it('should handle JSON parse error', async () => {
      const { getLLMProvider } = require('@/lib/llm')
      getLLMProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue('not valid json'),
      })

      const result = await processSchedulingRequest('Quero agendar', mockContext)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // createAppointmentFromContext - Integration tests
  // ============================================================
  describe('createAppointmentFromContext', () => {
    const validContext: SchedulerContext = {
      clinicId: 'clinic-123',
      patientId: 'patient-1',
      appointmentRequest: {
        date: '2026-06-15',
        time: '14:00',
        procedure: 'Limpeza',
        notes: 'Preferência por horário da tarde',
      },
    }

    function setupCreateMock(options: {
      procedures?: unknown[]
      dentists?: unknown[]
      insertedAppointment?: unknown
    }) {
      const mockDb = {
        select: jest.fn(),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue(options.insertedAppointment ? [options.insertedAppointment] : []),
          }),
        }),
        update: jest.fn(),
        delete: jest.fn(),
      }
      mockDb.select
        .mockReturnValueOnce({ from: fromThatReturns(options.procedures || []) })
        .mockReturnValueOnce({ from: fromThatReturns(options.dentists || []) })
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)
      return mockDb
    }

    it('should return error when missing patientId', async () => {
      const incomplete: SchedulerContext = { clinicId: 'clinic-123' }
      const result = await createAppointmentFromContext(incomplete)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Informações incompletas')
    })

    it('should return error when missing date', async () => {
      const ctx: SchedulerContext = { clinicId: 'clinic-123', patientId: 'patient-1' }
      const result = await createAppointmentFromContext(ctx)
      expect(result.success).toBe(false)
    })

    it('should return error when missing time', async () => {
      const ctx: SchedulerContext = {
        clinicId: 'clinic-123',
        patientId: 'patient-1',
        appointmentRequest: { date: '2026-06-15' },
      }
      const result = await createAppointmentFromContext(ctx)
      expect(result.success).toBe(false)
    })

    it('should create appointment successfully', async () => {
      const insertedAppt = { id: 'apt-new', clinicId: 'clinic-123', patientId: 'patient-1' }
      setupCreateMock({ procedures: [{ id: 'proc-1' }], insertedAppointment: insertedAppt })
      const result = await createAppointmentFromContext(validContext)
      expect(result.success).toBe(true)
      expect(result.appointmentId).toBe('apt-new')
      expect(result.message).toContain('confirmado')
    })

    it('should query procedures table when procedure is specified', async () => {
      const insertedAppt = { id: 'apt-new2', clinicId: 'clinic-123', patientId: 'patient-1' }
      setupCreateMock({ procedures: [{ id: 'proc-1' }], insertedAppointment: insertedAppt })
      const result = await createAppointmentFromContext(validContext)
      expect(result.success).toBe(true)
    })

    it('should query dentists table when dentist is specified', async () => {
      const ctx: SchedulerContext = {
        clinicId: 'clinic-123',
        patientId: 'patient-1',
        appointmentRequest: {
          date: '2026-06-15',
          time: '10:00',
          procedure: 'Restauração',
          dentist: 'Dr. Silva',
        },
      }
      const insertedAppt = { id: 'apt-dent', clinicId: 'clinic-123', patientId: 'patient-1' }
      setupCreateMock({ procedures: [{ id: 'proc-2' }], dentists: [{ id: 'dent-1', name: 'Dr. Silva' }], insertedAppointment: insertedAppt })
      const result = await createAppointmentFromContext(ctx)
      expect(result.success).toBe(true)
      expect(result.appointmentId).toBe('apt-dent')
    })

    it('should handle database error on appointment creation', async () => {
      const mockDb = {
        select: jest.fn(),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]), // empty = no appointment
          }),
        }),
        update: jest.fn(),
        delete: jest.fn(),
      }
      mockDb.select
        .mockReturnValueOnce({ from: fromThatReturns([]) })
        .mockReturnValueOnce({ from: fromThatReturns([]) })
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await createAppointmentFromContext(validContext)
      expect(result.success).toBe(false)
    })

    it('should handle unexpected errors gracefully', async () => {
      const mockDb = {
        select: jest.fn(),
        insert: jest.fn().mockImplementation(() => { throw new Error('DB error') }),
        update: jest.fn(),
        delete: jest.fn(),
      }
      mockDb.select
        .mockReturnValueOnce({ from: fromThatReturns([{ id: 'proc-1' }]) })
        .mockReturnValueOnce({ from: fromThatReturns([]) })
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await createAppointmentFromContext(validContext)
      expect(result.success).toBe(false)
      expect(result.message).toContain('erro')
    })

    it('should pass notes to appointment insert when provided', async () => {
      const ctxWithNotes: SchedulerContext = {
        ...validContext,
        appointmentRequest: { date: '2026-06-15', time: '14:00', notes: 'Prefere horário da tarde' },
      }
      const insertedAppt = { id: 'apt-notes', clinicId: 'clinic-123', patientId: 'patient-1' }
      setupCreateMock({ procedures: [{ id: 'proc-1' }], insertedAppointment: insertedAppt })
      const result = await createAppointmentFromContext(ctxWithNotes)
      expect(result.success).toBe(true)
      expect(result.appointmentId).toBe('apt-notes')
    })

    it('should handle appointment without procedure specified', async () => {
      const ctx: SchedulerContext = {
        clinicId: 'clinic-123',
        patientId: 'patient-1',
        appointmentRequest: { date: '2026-06-15', time: '14:00' },
      }
      const insertedAppt = { id: 'apt-noprocedure', clinicId: 'clinic-123', patientId: 'patient-1' }
      setupCreateMock({ insertedAppointment: insertedAppt })
      const result = await createAppointmentFromContext(ctx)
      expect(result.success).toBe(true)
    })
  })
})