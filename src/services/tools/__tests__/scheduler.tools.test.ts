/**
 * Scheduler Tools — behavioral tests (Drizzle-migrated)
 * Tests book, cancel, reschedule tools
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/services/scheduler/scheduler.service', () => ({
  getAvailableSlots: jest.fn().mockResolvedValue([
    { time: '09:00', available: true, dentistName: 'Dr. Silva' },
    { time: '09:30', available: false },
  ]),
}))

let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => {
      const result = queryResults[queryIndex++] ?? queryResults[queryResults.length - 1] ?? []
      return resolve(result)
    }),
  }
  return chain
}

let mdb = createMockDb()

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mdb),
  closeDb: jest.fn(),
}))

import {
  checkAvailabilityTool,
  bookAppointmentTool,
  cancelAppointmentTool,
  rescheduleAppointmentTool,
} from '../scheduler.tools'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
})

describe('SchedulerTools', () => {
  // ─── checkAvailabilityTool ───────────────────────────────────────────

  describe('checkAvailabilityTool', () => {
    it('returns available slots', async () => {
      const result = await checkAvailabilityTool(undefined, '2026-07-01', 'c1')
      expect(result.success).toBe(true)
      expect(result.data!.slots).toHaveLength(2)
      expect(result.data!.slots[0].available).toBe(true)
    })
  })

  // ─── bookAppointmentTool ─────────────────────────────────────────────

  describe('bookAppointmentTool', () => {
    it('creates appointment and returns success', async () => {
      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'apt-1',
          }]),
        }),
      })

      const result = await bookAppointmentTool('c1', 'p1', undefined, undefined, '2026-07-01', '14:00')

      expect(result.success).toBe(true)
      expect(result.data!.appointmentId).toBe('apt-1')
      expect(result.data!.message).toContain('confirmado')
    })

    it('returns error when insert fails', async () => {
      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      })

      const result = await bookAppointmentTool('c1', 'p1', undefined, undefined, '2026-07-01', '14:00')
      expect(result.success).toBe(false)
    })

    it('handles DB exception gracefully', async () => {
      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('DB down')),
        }),
      })

      const result = await bookAppointmentTool('c1', 'p1', undefined, undefined, '2026-07-01', '14:00')
      expect(result.success).toBe(false)
    })
  })

  // ─── cancelAppointmentTool ───────────────────────────────────────────

  describe('cancelAppointmentTool', () => {
    it('cancels appointment with reason', async () => {
      mdb.set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
      mdb.update = jest.fn().mockReturnValue({ set: mdb.set })

      const result = await cancelAppointmentTool('apt-1', 'Paciente solicitou')

      expect(result.success).toBe(true)
      expect(result.message).toContain('cancelado')
      expect(mdb.update).toHaveBeenCalled()
    })

    it('cancels without reason (null)', async () => {
      mdb.set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
      mdb.update = jest.fn().mockReturnValue({ set: mdb.set })

      const result = await cancelAppointmentTool('apt-1')
      expect(result.success).toBe(true)
    })

    it('handles DB error gracefully', async () => {
      mdb.update = jest.fn().mockImplementation(() => { throw new Error('DB error') })

      const result = await cancelAppointmentTool('apt-1', 'reason')
      expect(result.success).toBe(false)
    })
  })

  // ─── rescheduleAppointmentTool ───────────────────────────────────────

  describe('rescheduleAppointmentTool', () => {
    it('reschedules appointment to new date/time', async () => {
      // First query: select current appointment
      seed([{
        id: 'apt-1', clinicId: 'c1', patientId: 'p1',
        scheduledAt: new Date('2026-06-01T10:00'), status: 'scheduled',
      }])

      // Mock update chain
      mdb.set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
      mdb.update = jest.fn().mockReturnValue({ set: mdb.set })

      const result = await rescheduleAppointmentTool('apt-1', '2026-07-15', '16:00', 'Conflito de horário')

      expect(result.success).toBe(true)
      expect(result.data!.appointmentId).toBe('apt-1')
      expect(result.data!.message).toContain('remarcado')
    })

    it('returns error when appointment not found', async () => {
      seed([]) // no appointment found

      const result = await rescheduleAppointmentTool('apt-missing', '2026-07-01', '10:00')
      expect(result.success).toBe(false)
      expect(result.error).toContain('não encontrado')
    })

    it('handles DB error gracefully', async () => {
      mdb.update = jest.fn().mockImplementation(() => { throw new Error('DB error') })
      seed([{ id: 'apt-1', clinicId: 'c1', patientId: 'p1', scheduledAt: new Date(), status: 'scheduled' }])
      mdb.set = jest.fn().mockReturnValue({ where: mdb.update })

      const result = await rescheduleAppointmentTool('apt-1', '2026-07-01', '10:00')
      expect(result.success).toBe(false)
    })
  })
})
