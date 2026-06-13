/**
 * Tests for Patient History Service
 * Migrated from Supabase mock to Drizzle mock
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { getPatientHistory, getPatientVisitSummary } from '../patient-history.service'

// Build a mock db that simulates Drizzle query builder chain
// KEY: in Drizzle, query methods (where, limit, orderBy) return the builder itself for chaining.
// Only await/execute resolves to a Promise.
function makeMockDb(patientRows: unknown[], appointmentRows: unknown[]) {
  // Patient query: db.select().from().leftJoin().where().limit(1)
  // All methods return the builder for chaining; only await resolves.
  const patientWhereFn = jest.fn()
  const patientJoinFn = jest.fn()
  const patientFromFn = jest.fn()
  const patientSelectFn = jest.fn()

  // Build the patient query chain as a nested object
  // where() result → builder with .limit() → Promise when awaited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patientWhereResult: any = {
    limit: jest.fn().mockImplementation(() => {
      // limit() result → await resolves to patientRows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const limitResult: any = Promise.resolve(patientRows)
      limitResult.orderBy = jest.fn().mockImplementation(() => limitResult)
      return limitResult
    }),
    orderBy: jest.fn().mockImplementation(() => patientWhereResult),
    execute: jest.fn().mockResolvedValue(patientRows),
  }
  patientWhereFn.mockReturnValue(patientWhereResult)

  // leftJoin() on from result → returns builder with where()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patientJoinResult: any = {
    where: jest.fn().mockReturnValue(patientWhereResult),
    limit: jest.fn().mockImplementation(() => patientWhereResult.limit()),
    orderBy: jest.fn().mockReturnValue(patientWhereResult),
    execute: jest.fn().mockResolvedValue(patientRows),
  }
  patientJoinFn.mockReturnValue(patientJoinResult)

  // from() result → builder with leftJoin() and where()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patientFromResult: any = {
    where: jest.fn().mockReturnValue(patientWhereResult),
    leftJoin: jest.fn().mockReturnValue(patientJoinResult),
    limit: jest.fn().mockImplementation(() => patientWhereResult.limit()),
    orderBy: jest.fn().mockReturnValue(patientWhereResult),
    execute: jest.fn().mockResolvedValue(patientRows),
  }
  patientFromFn.mockReturnValue(patientFromResult)

  // select() result → builder with from()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patientSelectResult: any = {
    from: jest.fn().mockReturnValue(patientFromResult),
    where: jest.fn().mockReturnValue(patientWhereResult),
    leftJoin: jest.fn().mockReturnValue(patientJoinResult),
    limit: jest.fn().mockImplementation(() => patientWhereResult.limit()),
    execute: jest.fn().mockResolvedValue(patientRows),
  }
  patientSelectFn.mockReturnValue(patientSelectResult)

  // Appointment query: db.select().from().leftJoin().leftJoin().where().orderBy()
  const apptWhereFn = jest.fn()
  const apptJoinFn = jest.fn()
  const apptFromFn = jest.fn()
  const apptSelectFn = jest.fn()

  // where() result → builder with .orderBy() → await resolves to appointmentRows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apptWhereResult: any = {
    orderBy: jest.fn().mockImplementation(() => {
      // orderBy() result → await resolves to appointmentRows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderResult: any = Promise.resolve(appointmentRows)
      orderResult.orderBy = jest.fn().mockImplementation(() => orderResult)
      orderResult.execute = jest.fn().mockResolvedValue(appointmentRows)
      return orderResult
    }),
    limit: jest.fn().mockImplementation(() => apptWhereResult),
    execute: jest.fn().mockResolvedValue(appointmentRows),
  }
  apptWhereFn.mockReturnValue(apptWhereResult)

  // First leftJoin() on from result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apptJoin1Result: any = {
    where: jest.fn().mockReturnValue(apptWhereResult),
    leftJoin: jest.fn().mockReturnValue(apptJoinFn()),
    orderBy: jest.fn().mockImplementation(() => apptWhereResult.orderBy()),
    limit: jest.fn().mockImplementation(() => apptWhereResult),
    execute: jest.fn().mockResolvedValue(appointmentRows),
  }
  apptJoinFn.mockReturnValue(apptJoin1Result)

  // Second leftJoin (on apptJoin1Result.leftJoin)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apptJoin2Result: any = {
    where: jest.fn().mockReturnValue(apptWhereResult),
    orderBy: jest.fn().mockImplementation(() => apptWhereResult.orderBy()),
    limit: jest.fn().mockImplementation(() => apptWhereResult),
    execute: jest.fn().mockResolvedValue(appointmentRows),
  }
  // Make apptJoin1Result.leftJoin() return apptJoin2Result
  apptJoin1Result.leftJoin = jest.fn().mockReturnValue(apptJoin2Result)

  // from() result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apptFromResult: any = {
    where: jest.fn().mockReturnValue(apptWhereResult),
    leftJoin: jest.fn().mockReturnValue(apptJoin1Result),
    orderBy: jest.fn().mockImplementation(() => apptWhereResult.orderBy()),
    limit: jest.fn().mockImplementation(() => apptWhereResult),
    execute: jest.fn().mockResolvedValue(appointmentRows),
  }
  apptFromFn.mockReturnValue(apptFromResult)

  // select() result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apptSelectResult: any = {
    from: jest.fn().mockReturnValue(apptFromResult),
    where: jest.fn().mockReturnValue(apptWhereResult),
    leftJoin: jest.fn().mockReturnValue(apptJoin1Result),
    orderBy: jest.fn().mockImplementation(() => apptWhereResult.orderBy()),
    execute: jest.fn().mockResolvedValue(appointmentRows),
  }
  apptSelectFn.mockReturnValue(apptSelectResult)

  // Counter-based select to return correct chain per call
  let selectCount = 0
  const selectFn = jest.fn().mockImplementation(() => {
    selectCount++
    if (selectCount === 1) return patientSelectResult
    return apptSelectResult
  })

  return { select: selectFn, insert: jest.fn(), update: jest.fn(), delete: jest.fn() }
}

describe('Patient History Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPatientHistory', () => {
    it('should return complete patient history', async () => {
      const patientRow = {
        patient: { id: 'p1', name: 'João Silva', phone: '11999999999', clinicId: 'c1', email: null, cpf: null, birthDate: null, gender: null, notes: null, tags: null, lastVisitAt: null, optOutMarketing: null, optOutReminders: null, riskScore: null, createdAt: new Date(), updatedAt: new Date() },
        clinic: { name: 'Clínica Sorriso' },
      }
      const appointmentRows = [
        { id: 'a1', scheduledAt: new Date('2025-03-15T10:00:00Z'), durationMinutes: 30, status: 'completed', notes: 'Limpeza', procedure: { name: 'Limpeza' }, dentist: { name: 'Dra. Maria' } },
        { id: 'a2', scheduledAt: new Date('2025-04-15T14:00:00Z'), durationMinutes: 60, status: 'completed', notes: null, procedure: { name: 'Restauração' }, dentist: { name: 'Dr. Pedro' } },
        { id: 'a3', scheduledAt: new Date('2025-05-20T09:00:00Z'), durationMinutes: 30, status: 'cancelled', notes: 'Paciente desmarcou', procedure: { name: 'Limpeza' }, dentist: { name: 'Dra. Maria' } },
        { id: 'a4', scheduledAt: new Date(Date.now() + 86400000 * 365), durationMinutes: 30, status: 'scheduled', notes: null, procedure: { name: 'Clareamento' }, dentist: { name: 'Dra. Maria' } },
        { id: 'a5', scheduledAt: new Date('2025-02-10T10:00:00Z'), durationMinutes: 30, status: 'no_show', notes: null, procedure: { name: 'Limpeza' }, dentist: { name: 'Dr. Pedro' } },
      ]

      const mockDb = makeMockDb([patientRow], appointmentRows)
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await getPatientHistory('p1')
      expect(result.success).toBe(true)
      expect(result.history).toBeDefined()
      const h = result.history!
      expect(h.patientName).toBe('João Silva')
      expect(h.totalVisits).toBe(5)
      expect(h.completedVisits).toBe(2)
      expect(h.cancelledVisits).toBe(1)
      expect(h.noShowCount).toBe(1)
      expect(h.appointments).toHaveLength(5)

      // Procedure frequency - only completed appointments count
      expect(h.procedures).toEqual([
        { name: 'Limpeza', count: 1 },
        { name: 'Restauração', count: 1 },
      ])

      // Next appointment detection - a4 is scheduled in the future
      expect(h.nextAppointment).toBeDefined()
      expect(h.nextAppointment).toEqual(appointmentRows[3].scheduledAt)

      // Clinic name from join
      expect(h.clinicName).toBe('Clínica Sorriso')
    })

    it('should handle empty appointments', async () => {
      const patientRow = {
        patient: { id: 'p1', name: 'João Silva', phone: '11999999999', clinicId: 'c1', email: null, cpf: null, birthDate: null, gender: null, notes: null, tags: null, lastVisitAt: null, optOutMarketing: null, optOutReminders: null, riskScore: null, createdAt: new Date(), updatedAt: new Date() },
        clinic: { name: 'Clínica Sorriso' },
      }
      const appointmentRows: any[] = []

      const mockDb = makeMockDb([patientRow], appointmentRows)
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await getPatientHistory('p1')
      expect(result.success).toBe(true)
      const h = result.history!
      expect(h.totalVisits).toBe(0)
      expect(h.completedVisits).toBe(0)
      expect(h.cancelledVisits).toBe(0)
      expect(h.noShowCount).toBe(0)
      expect(h.lastVisit).toBeUndefined()
      expect(h.nextAppointment).toBeUndefined()
      expect(h.procedures).toEqual([])
      expect(h.appointments).toHaveLength(0)
    })

    it('should return error when patient not found', async () => {
      const mockDb = makeMockDb([], [])
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await getPatientHistory('nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient not found')
    })

    it('should handle internal error', async () => {
      // Build error chain: where() returns a builder that, when awaited, rejects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorLimitResult: any = new Promise((_, reject) => { reject(new Error('DB error')) })
      errorLimitResult.limit = jest.fn().mockReturnValue(errorLimitResult)
      errorLimitResult.orderBy = jest.fn().mockReturnValue(errorLimitResult)
      errorLimitResult.execute = jest.fn().mockImplementation(() => { throw new Error('DB error') })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorWhereResult: any = {
        limit: jest.fn().mockReturnValue(errorLimitResult),
        orderBy: jest.fn().mockReturnValue(errorLimitResult),
        execute: jest.fn().mockImplementation(() => { throw new Error('DB error') }),
      }
      const errorWhereFn = jest.fn().mockReturnValue(errorWhereResult)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorFromResult: any = {
        where: errorWhereFn,
        leftJoin: jest.fn().mockImplementation(() => ({ where: errorWhereFn })),
        limit: jest.fn().mockReturnValue(errorWhereResult),
        orderBy: jest.fn().mockReturnValue(errorWhereResult),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorSelectResult: any = { from: jest.fn().mockReturnValue(errorFromResult) }
      const errorDb = {
        select: jest.fn().mockReturnValue(errorSelectResult),
        insert: jest.fn(), update: jest.fn(), delete: jest.fn(),
      }
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(errorDb)

      const result = await getPatientHistory('p1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Internal error')
    })
  })

  describe('getPatientVisitSummary', () => {
    it('should return visit summary with no-show rate', async () => {
      const rows = [
        { scheduledAt: new Date('2025-03-15'), status: 'completed' },
        { scheduledAt: new Date('2025-04-15'), status: 'completed' },
        { scheduledAt: new Date('2025-05-20'), status: 'cancelled' },
        { scheduledAt: new Date('2025-06-15'), status: 'scheduled' },
        { scheduledAt: new Date('2025-02-10'), status: 'no_show' },
      ]
      // Build chain: select().from().where() → await
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereResult: any = Promise.resolve(rows)
      whereResult.limit = jest.fn().mockReturnValue(whereResult)
      whereResult.orderBy = jest.fn().mockReturnValue(whereResult)
      whereResult.execute = jest.fn().mockResolvedValue(rows)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromResult: any = {
        where: jest.fn().mockReturnValue(whereResult),
        limit: jest.fn().mockReturnValue(whereResult),
        orderBy: jest.fn().mockReturnValue(whereResult),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectResult: any = { from: jest.fn().mockReturnValue(fromResult) }
      const mockDb = { select: jest.fn().mockReturnValue(selectResult), insert: jest.fn(), update: jest.fn(), delete: jest.fn() }
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const summary = await getPatientVisitSummary('p1')
      expect(summary.totalVisits).toBe(5)
      expect(summary.noShowRate).toBe(0.2)
    })

    it('should return zero no-show rate for no appointments', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereResult: any = Promise.resolve([])
      whereResult.limit = jest.fn().mockReturnValue(whereResult)
      whereResult.orderBy = jest.fn().mockReturnValue(whereResult)
      whereResult.execute = jest.fn().mockResolvedValue([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromResult: any = { where: jest.fn().mockReturnValue(whereResult) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectResult: any = { from: jest.fn().mockReturnValue(fromResult) }
      const mockDb = { select: jest.fn().mockReturnValue(selectResult), insert: jest.fn(), update: jest.fn(), delete: jest.fn() }
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const summary = await getPatientVisitSummary('p1')
      expect(summary.totalVisits).toBe(0)
      expect(summary.noShowRate).toBe(0)
    })

    it('should handle DB error', async () => {
      // where() result → throws synchronously when accessed (thenable that rejects)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorWhereFn = jest.fn().mockImplementation(() => {
        const r: any = new Promise((_, reject) => { reject(new Error('DB error')) })
        r.limit = jest.fn().mockReturnValue(r)
        r.orderBy = jest.fn().mockReturnValue(r)
        r.execute = jest.fn().mockImplementation(() => { throw new Error('DB error') })
        return r
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromResult: any = { where: errorWhereFn }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectResult: any = { from: jest.fn().mockReturnValue(fromResult) }
      const mockDb = { select: jest.fn().mockReturnValue(selectResult), insert: jest.fn(), update: jest.fn(), delete: jest.fn() }
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      await expect(getPatientVisitSummary('p1')).rejects.toThrow('DB error')
    })
  })
})