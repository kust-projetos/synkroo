/**
 * Tests for Waitlist Service
 * Covers: addToWaitlist, getWaitlist, findMatchingWaitlist, cancelWaitlistEntry, expireOldWaitlistEntries
 */

import {
  addToWaitlist,
  getWaitlist,
  findMatchingWaitlist,
  cancelWaitlistEntry,
  expireOldWaitlistEntries,
} from '../waitlist.service'


import type { WaitlistEntry } from '../waitlist.service'
import { createTypedClient } from '@/lib/supabase/typed'
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))
const mockSupabase = {
  from: jest.fn(),
}
beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockResolvedValue(mockSupabase)
})
/**
 * Creates a thenable builder that mimics Supabase query chains.
 * All chain methods return self, and `await` resolves via `.then()`.
 */
function createThenableBuilder(resolveWith: { data: any; error: any }) {
  const builder: Record<string, any> = {
    then: (resolve: (value: any) => void) => resolve(resolveWith),
  }
  builder.select = jest.fn().mockReturnValue(builder)
  builder.insert = jest.fn().mockReturnValue(builder)
  builder.update = jest.fn().mockReturnValue(builder)
  builder.delete = jest.fn().mockReturnValue(builder)
  builder.eq = jest.fn().mockReturnValue(builder)
  builder.neq = jest.fn().mockReturnValue(builder)
  builder.in = jest.fn().mockReturnValue(builder)
  builder.is = jest.fn().mockReturnValue(builder)
  builder.lte = jest.fn().mockReturnValue(builder)
  builder.gte = jest.fn().mockReturnValue(builder)
  builder.lt = jest.fn().mockReturnValue(builder)
  builder.order = jest.fn().mockReturnValue(builder)
  builder.single = jest.fn().mockReturnValue(builder)
  return builder
}
describe('Waitlist Service', () => {
  describe('addToWaitlist', () => {
    it('should add patient to waitlist', async () => {
      mockSupabase.from
        // 1. Get patient info
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'p1', name: 'João', phone: '11999999999' },
                error: null,
              }),
            }),
          }),
        })
        // 2. Check existing
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                  }),
                }),
              }),
            }),
          }),
        })
        // 3. Get procedure name
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { name: 'Limpeza' },
                error: null,
              }),
            }),
          }),
        })
        // 4. Get dentist name
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { name: 'Dr. Silva' },
                error: null,
              }),
            }),
          }),
        })
        // 5. Create entry
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'w1', clinic_id: 'c1', patient_id: 'p1',
                  preferred_date: '2025-04-15',
                  preferred_time_start: '10:00',
                  preferred_time_end: '12:00',
                  procedure_id: 'proc1',
                  dentist_id: 'd1',
                  priority: 5,
                  status: 'waiting',
                  notes: null,
                  created_at: '2025-04-01T10:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        })
      const result = await addToWaitlist({
        clinicId: 'c1',
        patientId: 'p1',
        preferredDate: '2025-04-15',
        preferredTimeStart: '10:00',
        preferredTimeEnd: '12:00',
        procedureId: 'proc1',
        dentistId: 'd1',
      })

      expect(result.success).toBe(true)
      expect(result.entry).toBeDefined()
      expect(result.entry!.patientName).toBe('João')
      expect(result.entry!.procedureName).toBe('Limpeza')
    })

    it('should fail when patient not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      })

      const result = await addToWaitlist({
        clinicId: 'c1',
        patientId: 'nonexistent',
        preferredDate: '2025-04-15',
        preferredTimeStart: '10:00',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient not found')
    })

    it('should fail when patient already on waitlist', async () => {
      mockSupabase.from
        // 1. Get patient
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'p1', name: 'João', phone: '11999999999' },
                error: null,
              }),
            }),
          }),
        })
        // 2. Check existing - returns existing entry
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'existing-waitlist' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        })

      const result = await addToWaitlist({
        clinicId: 'c1',
        patientId: 'p1',
        preferredDate: '2025-04-15',
        preferredTimeStart: '10:00',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already on waitlist')
    })
  })

  describe('getWaitlist', () => {
    it('should return waitlist entries with filters', async () => {
      const mockEntries = [
        {
          id: 'w1', clinic_id: 'c1', patient_id: 'p1',
          preferred_date: '2025-04-15',
          preferred_time_start: '10:00',
          preferred_time_end: '12:00',
          procedure_id: null, dentist_id: null,
          priority: 5, status: 'waiting', notes: null,
          created_at: '2025-04-01T10:00:00Z',
          notified_at: null, scheduled_appointment_id: null,
          patients: { id: 'p1', name: 'João', phone: '11999999999' },
          procedures: null, dentists: null,
        },
      ]

      const builder = createThenableBuilder({ data: mockEntries, error: null })
      mockSupabase.from.mockReturnValue(builder)

      const result = await getWaitlist('c1', { status: 'waiting' })

      expect(result).toHaveLength(1)
      expect(result[0].patientName).toBe('João')
    })
  })

  describe('findMatchingWaitlist', () => {
    it('should find entries matching a slot', async () => {
      const mockEntries = [
        {
          id: 'w1', clinic_id: 'c1', patient_id: 'p1',
          preferred_date: '2025-04-15',
          preferred_time_start: '09:00',
          preferred_time_end: '12:00',
          procedure_id: null, dentist_id: null,
          priority: 8, status: 'waiting', notes: null,
          created_at: '2025-04-01T10:00:00Z',
          patients: { id: 'p1', name: 'João', phone: '11999999999' },
          procedures: null, dentists: null,
        },
      ]

      const builder = createThenableBuilder({ data: mockEntries, error: null })
      mockSupabase.from.mockReturnValue(builder)

      const result = await findMatchingWaitlist('c1', '2025-04-15', '10:00')

      expect(result).toHaveLength(1)
      expect(result[0].priority).toBe(8)
    })

    it('should prioritize specific dentist entries', async () => {
      const mockEntries = [
        {
          id: 'w1', clinic_id: 'c1', patient_id: 'p1',
          preferred_date: '2025-04-15',
          preferred_time_start: '09:00',
          preferred_time_end: '12:00',
          procedure_id: null, dentist_id: null,
          priority: 5, status: 'waiting', notes: null,
          created_at: '2025-04-01T10:00:00Z',
          patients: { id: 'p1', name: 'João', phone: '11999999999' },
          procedures: null, dentists: null,
        },
        {
          id: 'w2', clinic_id: 'c1', patient_id: 'p2',
          preferred_date: '2025-04-15',
          preferred_time_start: '09:00',
          preferred_time_end: '12:00',
          procedure_id: null, dentist_id: 'd1',
          priority: 5, status: 'waiting', notes: null,
          created_at: '2025-04-01T10:00:00Z',
          patients: { id: 'p2', name: 'Maria', phone: '11888888888' },
          procedures: null, dentists: { name: 'Dr. Silva' },
        },
      ]

      const builder = createThenableBuilder({ data: mockEntries, error: null })
      mockSupabase.from.mockReturnValue(builder)

      const result = await findMatchingWaitlist('c1', '2025-04-15', '10:00', 'd1')

      // w2 (specific dentist) should come first
      expect(result[0].id).toBe('w2')
    })
  })

  describe('cancelWaitlistEntry', () => {
    it('should cancel entry', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })

      const result = await cancelWaitlistEntry('w1', 'Não preciso mais')
      expect(result.success).toBe(true)
    })

    it('should handle error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Error' } }),
        }),
      })

      const result = await cancelWaitlistEntry('w1')
      expect(result.success).toBe(false)
    })
  })

  describe('expireOldWaitlistEntries', () => {
    it('should expire old entries', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'w1' }, { id: 'w2' }],
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await expireOldWaitlistEntries()
      expect(result.expired).toBe(2)
    })

    it('should handle error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Error' },
              }),
            }),
          }),
        }),
      })

      const result = await expireOldWaitlistEntries()
      expect(result.expired).toBe(0)
    })
  })
})
