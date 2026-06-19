/**
 * Campaign Segmentation Service — behavioral tests (Drizzle-migrated, with totalValue)
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
  describe('listSegments', () => {
    it('returns segments for clinic', async () => {
      seed([{ id: 's1', clinicId: 'c1', name: 'VIP', description: null, criteria: {}, patientCount: 5, createdBy: null, createdAt: new Date(), updatedAt: new Date() }])
      const segments = await listSegments('c1')
      expect(segments).toHaveLength(1)
    })
  })

  describe('previewSegmentSize', () => {
    it('filters by active status', async () => {
      seed([{ id: 'p1' }, { id: 'p2' }])
      const count = await previewSegmentSize('c1', { status: 'active' })
      expect(count).toBe(2)
    })

    it('applies totalSpentMin filter on aggregated totalValue', async () => {
      const criteria: SegmentCriteria = { totalSpentMin: 500 }
      seed(
        [{ id: 'p1' }, { id: 'p2' }],
        [
          { patientId: 'p1', scheduledAt: new Date(), procedureName: null, totalValue: '300' },
          { patientId: 'p1', scheduledAt: new Date(), procedureName: null, totalValue: '300' },
          { patientId: 'p2', scheduledAt: new Date(), procedureName: null, totalValue: '100' },
        ],
      )

      const count = await previewSegmentSize('c1', criteria)
      // p1: 300+300=600 >= 500 → matches. p2: 100 < 500 → excluded
      expect(count).toBe(1)
    })

    it('applies totalSpentMax filter on aggregated totalValue', async () => {
      const criteria: SegmentCriteria = { totalSpentMax: 400 }
      seed(
        [{ id: 'p1' }, { id: 'p2' }],
        [
          { patientId: 'p1', scheduledAt: new Date(), procedureName: null, totalValue: '100' },
          { patientId: 'p2', scheduledAt: new Date(), procedureName: null, totalValue: '500' },
        ],
      )

      const count = await previewSegmentSize('c1', criteria)
      // p1: 100 <= 400 → matches. p2: 500 > 400 → excluded
      expect(count).toBe(1)
    })

    it('combines totalSpent with procedure filter', async () => {
      const criteria: SegmentCriteria = { totalSpentMin: 200, procedures: ['limpeza'] }
      seed(
        [{ id: 'p1' }, { id: 'p2' }],
        [
          { patientId: 'p1', scheduledAt: new Date(), procedureName: 'Limpeza', totalValue: '300' },
          { patientId: 'p2', scheduledAt: new Date(), procedureName: 'Extração', totalValue: '500' },
        ],
      )

      const count = await previewSegmentSize('c1', criteria)
      // p1: Limpeza + total 300≥200 → matches. p2: Extração → excluded by procedure
      expect(count).toBe(1)
    })

    it('returns 0 when no patient meets totalSpent threshold', async () => {
      const criteria: SegmentCriteria = { totalSpentMin: 1000 }
      seed(
        [{ id: 'p1' }],
        [{ patientId: 'p1', scheduledAt: new Date(), procedureName: null, totalValue: '500' }],
      )

      const count = await previewSegmentSize('c1', criteria)
      expect(count).toBe(0)
    })
  })

  describe('getSegmentPatients', () => {
    it('returns matching patients', async () => {
      seed([{ id: 'p1', name: 'Ana', phone: '123' }])
      const patients = await getSegmentPatients('c1', {}, 10)
      expect(patients).toHaveLength(1)
    })
  })

  describe('createSegment', () => {
    it('creates segment with patient count', async () => {
      seed([{ id: 'p1' }])
      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'seg-1', clinicId: 'c1', name: 'Test', description: null, criteria: {}, patientCount: 1, createdBy: null, createdAt: new Date(), updatedAt: new Date() }]),
        }),
      })
      const segment = await createSegment({ clinicId: 'c1', name: 'Test', criteria: {} })
      expect(segment).not.toBeNull()
    })
  })
})
