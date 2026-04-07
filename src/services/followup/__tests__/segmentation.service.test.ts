/**
 * Tests for Segmentation Service
 * Covers createSegment, previewSegmentSize, getSegmentPatients, listSegments
 */

import {
  createSegment,
  previewSegmentSize,
  getSegmentPatients,
  listSegments,
  Segment,
  SegmentCriteria,
} from '../segmentation.service'

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

/**
 * Helper to create a mock Supabase chain
 * Handles both { count, error } responses for count queries and { data, error } for data queries
 */
function createChain(finalResult: any): any {
  const c: any = {
    then(resolve?: (v: any) => any) { return resolve?.(finalResult) },
  }
  const methods = ['insert', 'select', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'single', 'contains', 'overlaps', 'upsert', 'not', 'in', 'is']
  for (const m of methods) {
    if (m === 'single') {
      c[m] = jest.fn(() => Promise.resolve(finalResult))
    } else {
      c[m] = jest.fn(() => c)
    }
  }
  return c
}

const mockFrom = jest.fn()
const mockClient = { from: mockFrom }

beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockResolvedValue(mockClient)
})

describe('Segmentation Service', () => {
  const mockClinicId = 'clinic-123'
  const mockUserId = 'user-456'

  describe('previewSegmentSize', () => {
    describe('basic criteria (status, tags, age)', () => {
      it('should count patients with active status', async () => {
        const countChain = createChain({ count: 42, error: null })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, { status: 'active' })

        expect(result).toBe(42)
        expect(mockFrom).toHaveBeenCalledWith('patients')
        expect(countChain.eq).toHaveBeenCalledWith('clinic_id', mockClinicId)
        expect(countChain.is).toHaveBeenCalledWith('deleted_at', null)
        expect(countChain.neq).toHaveBeenCalledWith('status', 'inactive')
      })

      it('should count patients with inactive status', async () => {
        const countChain = createChain({ count: 15, error: null })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, { status: 'inactive' })

        expect(result).toBe(15)
        expect(countChain.eq).toHaveBeenCalledWith('status', 'inactive')
      })

      it('should count patients with all status (no filter)', async () => {
        const countChain = createChain({ count: 100, error: null })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, { status: 'all' })

        expect(result).toBe(100)
        // Should not apply status filter
        expect(countChain.eq).not.toHaveBeenCalledWith('status', expect.any(String))
      })

      it('should count patients with tags overlap', async () => {
        const countChain = createChain({ count: 23, error: null })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, {
          tags: ['vip', 'returning'],
        })

        expect(result).toBe(23)
        expect(countChain.overlaps).toHaveBeenCalledWith('tags', ['vip', 'returning'])
      })

      it('should count patients within age range', async () => {
        const countChain = createChain({ count: 67, error: null })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, {
          ageMin: 25,
          ageMax: 65,
        })

        expect(result).toBe(67)
        expect(countChain.lte).toHaveBeenCalledWith(
          'birth_date',
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        )
        expect(countChain.gte).toHaveBeenCalledWith(
          'birth_date',
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        )
      })

      it('should combine multiple basic criteria', async () => {
        const countChain = createChain({ count: 8, error: null })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, {
          status: 'active',
          tags: ['vip'],
          ageMin: 18,
        })

        expect(result).toBe(8)
      })

      it('should return 0 on database error', async () => {
        const countChain = createChain({ count: null, error: { message: 'DB error' } })
        mockFrom.mockReturnValue(countChain)

        const result = await previewSegmentSize(mockClinicId, { status: 'active' })

        expect(result).toBe(0)
      })
    })

    describe('advanced criteria (procedures, lastVisit, totalSpent)', () => {
      it('should filter patients by lastVisitMin days', async () => {
        // First call: count query (gets initial count, but is overridden by advanced logic)
        const countChain = createChain({ count: 3, error: null })
        // Second call: get patient IDs
        const patientChain = createChain({
          data: [
            { id: 'p1' },
            { id: 'p2' },
            { id: 'p3' },
          ],
          error: null,
        })
        // Third call: get appointments
        const aptChain = createChain({
          data: [
            { patient_id: 'p1', scheduled_at: '2026-03-01' }, // 30 days ago
            { patient_id: 'p2', scheduled_at: '2026-02-01' }, // 60 days ago
            { patient_id: 'p3', scheduled_at: '2026-01-01' }, // 90 days ago
          ],
          error: null,
        })
        mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(patientChain).mockReturnValueOnce(aptChain)

        // lastVisitMin: 45 means at least 45 days since last visit
        const result = await previewSegmentSize(mockClinicId, {
          lastVisitMin: 45,
        })

        // Only p2 (60 days) and p3 (90 days) match
        expect(result).toBe(2)
      })

      it('should filter patients by lastVisitMax days', async () => {
        const countChain = createChain({ count: 2, error: null })
        const patientChain = createChain({
          data: [{ id: 'p1' }, { id: 'p2' }],
          error: null,
        })
        const aptChain = createChain({
          data: [
            { patient_id: 'p1', scheduled_at: '2026-03-20' }, // 11 days ago
            { patient_id: 'p2', scheduled_at: '2026-02-01' }, // 60 days ago
          ],
          error: null,
        })
        mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(patientChain).mockReturnValueOnce(aptChain)

        // lastVisitMax: 30 means at most 30 days since last visit
        const result = await previewSegmentSize(mockClinicId, {
          lastVisitMax: 30,
        })

        // Only p1 (11 days) matches
        expect(result).toBe(1)
      })

      it('should filter patients by procedures (case-insensitive)', async () => {
        const countChain = createChain({ count: 2, error: null })
        const patientChain = createChain({
          data: [{ id: 'p1' }, { id: 'p2' }],
          error: null,
        })
        const aptChain = createChain({
          data: [
            { patient_id: 'p1', procedures: { name: 'Limpeza Dental' } },
            { patient_id: 'p2', procedures: { name: 'Restauração' } },
          ],
          error: null,
        })
        mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(patientChain).mockReturnValueOnce(aptChain)

        const result = await previewSegmentSize(mockClinicId, {
          procedures: ['limpeza', 'extração'],
        })

        // p1 matches 'limpeza' (case-insensitive)
        expect(result).toBe(1)
      })

      it('should return 0 when no patients found for advanced criteria', async () => {
        const patientChain = createChain({ data: [], error: null })
        mockFrom.mockReturnValue(patientChain)

        const result = await previewSegmentSize(mockClinicId, {
          lastVisitMin: 30,
        })

        expect(result).toBe(0)
      })

      it('should handle missing procedure relation gracefully', async () => {
        const patientChain = createChain({
          data: [{ id: 'p1' }],
          error: null,
        })
        const aptChain = createChain({
          data: [{ patient_id: 'p1', procedures: null }],
          error: null,
        })
        mockFrom.mockReturnValueOnce(patientChain).mockReturnValueOnce(aptChain)

        const result = await previewSegmentSize(mockClinicId, {
          procedures: ['limpeza'],
        })

        // No match due to null procedures
        expect(result).toBe(0)
      })
    })
  })

  describe('getSegmentPatients', () => {
    it('should return patients matching tag criteria', async () => {
      const mockPatients = [
        { id: 'p1', name: 'João Silva', phone: '11999999999', tags: ['vip'] },
        { id: 'p2', name: 'Maria Santos', phone: '11888888888', tags: ['vip'] },
      ]
      const chain = createChain({ data: mockPatients, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await getSegmentPatients(mockClinicId, {
        tags: ['vip'],
      })

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('João Silva')
      expect(chain.overlaps).toHaveBeenCalledWith('tags', ['vip'])
    })

    it('should respect limit parameter', async () => {
      const mockPatients = Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`,
        name: `Patient ${i}`,
        phone: '11999999999',
        tags: ['test'],
      }))
      const chain = createChain({ data: mockPatients, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await getSegmentPatients(mockClinicId, { tags: ['test'] }, 10)

      expect(chain.limit).toHaveBeenCalledWith(10)
    })

    it('should use default limit of 100', async () => {
      const chain = createChain({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      await getSegmentPatients(mockClinicId, {})

      expect(chain.limit).toHaveBeenCalledWith(100)
    })

    it('should return empty array on error', async () => {
      const chain = createChain({ data: null, error: { message: 'DB error' } })
      mockFrom.mockReturnValue(chain)

      const result = await getSegmentPatients(mockClinicId, {})

      expect(result).toEqual([])
    })
  })

  describe('createSegment', () => {
    it('should create segment with patient count from preview', async () => {
      const mockSegment: Segment = {
        id: 'seg-1',
        clinic_id: mockClinicId,
        name: 'VIP Patients',
        description: 'High-value patients',
        criteria: { tags: ['vip'] },
        patient_count: 25,
        created_by: mockUserId,
        created_at: '2026-03-31T00:00:00Z',
        updated_at: '2026-03-31T00:00:00Z',
      }

      // First call: preview (count query)
      const countChain = createChain({ count: 25, error: null })
      // Second call: insert
      const insertChain = createChain({ data: mockSegment, error: null })

      mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)

      const result = await createSegment({
        clinicId: mockClinicId,
        name: 'VIP Patients',
        description: 'High-value patients',
        criteria: { tags: ['vip'] },
        createdBy: mockUserId,
      })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('seg-1')
      expect(result?.patient_count).toBe(25)
    })

    it('should create segment with null description when not provided', async () => {
      const mockSegment: Segment = {
        id: 'seg-2',
        clinic_id: mockClinicId,
        name: 'Inactive Patients',
        description: null,
        criteria: { status: 'inactive' },
        patient_count: 10,
        created_by: null,
        created_at: '2026-03-31T00:00:00Z',
        updated_at: '2026-03-31T00:00:00Z',
      }

      const countChain = createChain({ count: 10, error: null })
      const insertChain = createChain({ data: mockSegment, error: null })

      mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)

      const result = await createSegment({
        clinicId: mockClinicId,
        name: 'Inactive Patients',
        criteria: { status: 'inactive' },
      })

      expect(result?.description).toBeNull()
      expect(result?.created_by).toBeNull()
    })

    it('should return null on insert error', async () => {
      const countChain = createChain({ count: 5, error: null })
      const insertChain = createChain({ data: null, error: { message: 'Insert failed' } })

      mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)

      const result = await createSegment({
        clinicId: mockClinicId,
        name: 'Test Segment',
        criteria: { status: 'active' },
      })

      expect(result).toBeNull()
    })

    it('should handle empty criteria', async () => {
      const mockSegment: Segment = {
        id: 'seg-3',
        clinic_id: mockClinicId,
        name: 'All Patients',
        description: null,
        criteria: {},
        patient_count: 100,
        created_by: null,
        created_at: '2026-03-31T00:00:00Z',
        updated_at: '2026-03-31T00:00:00Z',
      }

      const countChain = createChain({ count: 100, error: null })
      const insertChain = createChain({ data: mockSegment, error: null })

      mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)

      const result = await createSegment({
        clinicId: mockClinicId,
        name: 'All Patients',
        criteria: {},
      })

      expect(result?.patient_count).toBe(100)
    })
  })

  describe('listSegments', () => {
    it('should return segments ordered by created_at descending', async () => {
      const mockSegments: Segment[] = [
        {
          id: 'seg-1',
          clinic_id: mockClinicId,
          name: 'Newest',
          description: null,
          criteria: {},
          patient_count: 10,
          created_by: null,
          created_at: '2026-03-31T10:00:00Z',
          updated_at: '2026-03-31T10:00:00Z',
        },
        {
          id: 'seg-2',
          clinic_id: mockClinicId,
          name: 'Oldest',
          description: null,
          criteria: {},
          patient_count: 5,
          created_by: null,
          created_at: '2026-03-01T10:00:00Z',
          updated_at: '2026-03-01T10:00:00Z',
        },
      ]

      const chain = createChain({ data: mockSegments, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await listSegments(mockClinicId)

      expect(result).toHaveLength(2)
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('should filter by clinic_id', async () => {
      const chain = createChain({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      await listSegments(mockClinicId)

      expect(chain.eq).toHaveBeenCalledWith('clinic_id', mockClinicId)
    })

    it('should return empty array on error', async () => {
      const chain = createChain({ data: null, error: { message: 'DB error' } })
      mockFrom.mockReturnValue(chain)

      const result = await listSegments(mockClinicId)

      expect(result).toEqual([])
    })

    it('should return empty array when no segments exist', async () => {
      const chain = createChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await listSegments(mockClinicId)

      expect(result).toEqual([])
    })
  })
})
