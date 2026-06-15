/**
 * Campaign Segmentation Service — behavioral tests (Drizzle-migrated, v2 with patients.status)
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
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
  createSegment,
  previewSegmentSize,
  getSegmentPatients,
  listSegments,
} from '../segmentation.service'
import type { SegmentCriteria } from '../segmentation.service'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
})

describe('SegmentationService', () => {
  // ─── listSegments ───────────────────────────────────────────────────

  describe('listSegments', () => {
    it('returns segments for clinic', async () => {
      seed([{
        id: 's1', clinicId: 'c1', name: 'VIP',
        description: 'desc', criteria: { status: 'active' },
        patientCount: 5, createdBy: 'u1',
        createdAt: new Date(), updatedAt: new Date(),
      }])
      const segments = await listSegments('c1')
      expect(segments).toHaveLength(1)
      expect(segments[0].clinic_id).toBe('c1')
    })
  })

  // ─── previewSegmentSize ─────────────────────────────────────────────

  describe('previewSegmentSize', () => {
    it('filters by active status using patients.status', async () => {
      const criteria: SegmentCriteria = { status: 'active' }
      seed([{ id: 'p1' }, { id: 'p2' }])
      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(2)
    })

    it('filters by inactive status using patients.status', async () => {
      const criteria: SegmentCriteria = { status: 'inactive' }
      seed([{ id: 'p1' }])
      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(1)
    })

    it('filters by tags', async () => {
      const criteria: SegmentCriteria = { tags: ['vip', 'premium'] }
      seed([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }])
      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(3)
    })

    it('filters by age range', async () => {
      const criteria: SegmentCriteria = { ageMin: 18, ageMax: 65 }
      seed([{ id: 'p1' }])
      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(1)
    })

    it('applies procedure filter via appointment join', async () => {
      const criteria: SegmentCriteria = { procedures: ['limpeza'] }
      seed(
        [{ id: 'p1' }, { id: 'p2' }],
        [
          { patientId: 'p1', scheduledAt: new Date(), procedureName: 'Limpeza Dental' },
          { patientId: 'p2', scheduledAt: new Date(), procedureName: 'Extração' },
        ],
      )
      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(1) // only p1 matches Limpeza
    })

    it('totalSpentMin gates appointment query but does not filter', async () => {
      // totalSpentMin triggers the appointment join block but no amount filter applied
      const criteria: SegmentCriteria = { totalSpentMin: 1000 }
      seed(
        [{ id: 'p1' }, { id: 'p2' }],
        [
          { patientId: 'p1', scheduledAt: new Date(), procedureName: null },
          { patientId: 'p2', scheduledAt: new Date(), procedureName: null },
        ],
      )
      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(2) // both pass (no amount filter)
    })
  })

  // ─── getSegmentPatients ─────────────────────────────────────────────

  describe('getSegmentPatients', () => {
    it('returns matching patients', async () => {
      seed([{ id: 'p1', name: 'Ana', phone: '123' }, { id: 'p2', name: 'João', phone: '456' }])
      const patients = await getSegmentPatients('c1', { status: 'active' }, 10)
      expect(patients).toHaveLength(2)
    })

    it('handles null phone', async () => {
      seed([{ id: 'p1', name: 'X', phone: null }])
      const patients = await getSegmentPatients('c1', {}, 10)
      expect(patients[0].phone).toBe('')
    })
  })

  // ─── createSegment ──────────────────────────────────────────────────

  describe('createSegment', () => {
    it('creates segment with patient count', async () => {
      seed([{ id: 'p1' }]) // previewSegmentSize

      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'seg-1', clinicId: 'c1', name: 'Active patients',
            description: null, criteria: { status: 'active' },
            patientCount: 1, createdBy: null,
            createdAt: new Date(), updatedAt: new Date(),
          }]),
        }),
      })

      const segment = await createSegment({ clinicId: 'c1', name: 'Active patients', criteria: { status: 'active' } })
      expect(segment).not.toBeNull()
      expect(segment!.patient_count).toBe(1)
    })
  })
})
