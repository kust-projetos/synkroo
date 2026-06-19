/**
 * Tests for Waitlist Service — migrated to Drizzle mocks.
 */
import {
  addToWaitlist, getWaitlist, findMatchingWaitlist,
  cancelWaitlistEntry, expireOldWaitlistEntries,
} from '../waitlist.service'

jest.mock('@/repositories/waitlist', () => ({
  createWaitlistEntry: jest.fn(),
  findByPatientClinicDate: jest.fn(),
  findByClinic: jest.fn(),
  findMatchingEntries: jest.fn(),
  markNotified: jest.fn(),
  markScheduled: jest.fn(),
  cancelEntry: jest.fn(),
  expireOldEntries: jest.fn(),
}))

const mockDb = {
  select: jest.fn(function(this: any) { return this }),
  from: jest.fn(function(this: any) { return this }),
  where: jest.fn(function(this: any) { return this }),
  then: jest.fn(),
} as any

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

global.fetch = jest.fn().mockResolvedValue({ ok: true })

const {
  createWaitlistEntry, findByPatientClinicDate, findByClinic,
  findMatchingEntries, cancelEntry, expireOldEntries,
} = require('@/repositories/waitlist')

/** Set up the Drizzle thenable mock to resolve with given data. */
function mockDbResolve(...results: any[][]) {
  let calls = 0
  mockDb.then = jest.fn((fn: any) => {
    const data = results[calls] ?? results[results.length - 1] ?? []
    calls++
    return Promise.resolve(typeof fn === 'function' ? fn(data) : data)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(findByPatientClinicDate as jest.Mock).mockResolvedValue(null)
  ;(createWaitlistEntry as jest.Mock).mockResolvedValue({ id: 'w1' })
  ;(findByClinic as jest.Mock).mockResolvedValue([])
  ;(findMatchingEntries as jest.Mock).mockResolvedValue([])
  ;(cancelEntry as jest.Mock).mockResolvedValue(true)
  ;(expireOldEntries as jest.Mock).mockResolvedValue([])
  mockDb.then = jest.fn((fn: any) => Promise.resolve(fn ? fn([]) : []))
})

describe('Waitlist Service', () => {
  describe('addToWaitlist', () => {
    it('should add patient to waitlist', async () => {
      // 3 DB queries: patient, procedure, dentist
      mockDbResolve(
        [{ id: 'p1', name: 'João', phone: '11999999999' }],
        [{ name: 'Limpeza' }],
        [{ name: 'Dr. Silva' }],
      )
      const result = await addToWaitlist({
        clinicId: 'c1', patientId: 'p1',
        preferredDate: '2025-04-15', preferredTimeStart: '10:00', preferredTimeEnd: '12:00',
        procedureId: 'proc1', dentistId: 'd1',
      })
      expect(result.success).toBe(true)
      expect(result.entry).toBeDefined()
      expect(result.entry!.patientName).toBe('João')
      expect(createWaitlistEntry).toHaveBeenCalled()
    })

    it('should fail when patient not found', async () => {
      mockDbResolve([])
      const result = await addToWaitlist({
        clinicId: 'c1', patientId: 'nonexistent',
        preferredDate: '2025-04-15', preferredTimeStart: '10:00',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient not found')
    })

    it('should fail when patient already on waitlist', async () => {
      mockDbResolve([{ id: 'p1', name: 'João', phone: '11999999999' }])
      ;(findByPatientClinicDate as jest.Mock).mockResolvedValueOnce({ id: 'existing-waitlist' })
      const result = await addToWaitlist({
        clinicId: 'c1', patientId: 'p1',
        preferredDate: '2025-04-15', preferredTimeStart: '10:00',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('already on waitlist')
    })
  })

  describe('getWaitlist', () => {
    it('should return entries with filters', async () => {
      ;(findByClinic as jest.Mock).mockResolvedValue([{
        id: 'w1', clinicId: 'c1', patientId: 'p1',
        preferredDate: new Date('2025-04-15'), preferredTimeStart: '10:00', preferredTimeEnd: '12:00',
        dentistId: null, priority: 5, status: 'waiting', notes: null,
        createdAt: new Date('2025-04-01'), updatedAt: null,
      }])
      const result = await getWaitlist('c1', { status: 'waiting' })
      expect(result).toHaveLength(1)
    })
  })

  describe('cancelWaitlistEntry', () => {
    it('should cancel entry', async () => {
      ;(cancelEntry as jest.Mock).mockResolvedValue(true)
      const result = await cancelWaitlistEntry('w1', 'reason')
      expect(result.success).toBe(true)
    })
    it('should handle error', async () => {
      ;(cancelEntry as jest.Mock).mockResolvedValue(false)
      const result = await cancelWaitlistEntry('w1')
      expect(result.success).toBe(false)
    })
  })

  describe('expireOldWaitlistEntries', () => {
    it('should expire old entries', async () => {
      ;(expireOldEntries as jest.Mock).mockResolvedValue(['w1', 'w2'])
      const result = await expireOldWaitlistEntries()
      expect(result.expired).toBe(2)
    })
  })
})
