/**
 * Tests for Patient Tags Service
 */

function createChain(finalResult: any): any {
  const c: any = {
    then(resolve?: (v: any) => any) { return resolve?.(finalResult) },
  }
  const methods = ['insert', 'select', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'single', 'contains', 'overlaps', 'upsert']
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

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn().mockResolvedValue(mockClient),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  addPatientTag,
  removePatientTag,
  getClinicTags,
  getPatientsByTag,
  DEFAULT_TAGS,
} from '../patient-tags.service'

describe('Patient Tags Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('DEFAULT_TAGS', () => {
    it('should export default tags array', () => {
      expect(DEFAULT_TAGS).toBeDefined()
      expect(Array.isArray(DEFAULT_TAGS)).toBe(true)
      expect(DEFAULT_TAGS.length).toBeGreaterThan(0)
    })
  })

  describe('addPatientTag', () => {
    // Real API: addPatientTag(patientId: string, tag: string) => Promise<boolean>
    it('should add a tag to a patient', async () => {
      const existingPatient = { tags: ['vip'] }
      const updated = { tags: ['vip', 'premium'] }

      mockFrom
        .mockReturnValueOnce(createChain({ data: existingPatient, error: null }))
      mockFrom
        .mockReturnValueOnce(createChain({ data: updated, error: null }))

      const result = await addPatientTag('p1', 'premium')
      expect(result).toBe(true)
    })

    it('should return false on fetch error', async () => {
      mockFrom.mockReturnValue(createChain({ data: null, error: { message: 'Not found' } }))
      const result = await addPatientTag('p1', 'test')
      expect(result).toBe(false)
    })

    it('should return true if tag already exists', async () => {
      const existingPatient = { tags: ['vip', 'premium'] }
      mockFrom.mockReturnValueOnce(createChain({ data: existingPatient, error: null }))

      const result = await addPatientTag('p1', 'premium')
      expect(result).toBe(true)
    })
  })

  describe('removePatientTag', () => {
    it('should remove a tag from patient', async () => {
      const patient = { tags: ['vip', 'premium', 'orthodontic'] }
      const updated = { tags: ['vip'] }

      mockFrom
        .mockReturnValueOnce(createChain({ data: patient, error: null }))
      mockFrom
        .mockReturnValueOnce(createChain({ data: updated, error: null }))

      const result = await removePatientTag('p1', 'premium')
      expect(result).toBeTruthy()
    })
  })

  describe('getClinicTags', () => {
    it('should return unique tags from clinic patients', async () => {
      const patients = [
        { tags: ['vip', 'invisalign'] },
        { tags: ['vip', 'orthodontic'] },
        { tags: null },
      ]

      mockFrom.mockReturnValue(createChain({ data: patients, error: null }))
      const tags = await getClinicTags('c1')

      expect(tags).toContain('vip')
      expect(tags).toContain('invisalign')
      expect(tags).toContain('orthodontic')
    })

    it('should return empty array on error', async () => {
      mockFrom.mockReturnValue(createChain({ data: null, error: { message: 'fail' } }))
      const tags = await getClinicTags('c1')
      expect(tags).toEqual([])
    })
  })

  describe('getPatientsByTag', () => {
    it('should find patients with specific tag', async () => {
      const patients = [
        { id: 'p1', name: 'João', phone: '11999999999' },
        { id: 'p2', name: 'Maria', phone: '11888888888' },
      ]

      mockFrom.mockReturnValue(createChain({ data: patients, error: null }))
      const results = await getPatientsByTag('c1', 'vip')
      expect(results).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      mockFrom.mockReturnValue(createChain({ data: null, error: { message: 'fail' } }))
      const results = await getPatientsByTag('c1', 'nonexistent')
      expect(results).toEqual([])
    })
  })
})
