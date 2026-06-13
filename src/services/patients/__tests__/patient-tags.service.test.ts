/**
 * Tests for Patient Tags Service
 * Migrated from Supabase mock to Drizzle mock
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// Mock patients repository — used by addPatientTag, removePatientTag, setPatientTags
jest.mock('@/repositories/patients', () => ({
  findById: jest.fn(),
  update: jest.fn(),
}))

import {
  addPatientTag,
  removePatientTag,
  getClinicTags,
  getPatientsByTag,
  setPatientTags,
  DEFAULT_TAGS,
} from '../patient-tags.service'

// Import mockDb from jest.setup
import { mockDb } from '@/test-utils/db-mock'

const { findById, update } = require('@/repositories/patients')

describe('Patient Tags Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock chain calls
    ;(mockDb.select as jest.Mock).mockClear()
    ;(mockDb.insert as jest.Mock).mockClear()
  })

  describe('DEFAULT_TAGS', () => {
    it('should export default tags array', () => {
      expect(DEFAULT_TAGS).toBeDefined()
      expect(Array.isArray(DEFAULT_TAGS)).toBe(true)
      expect(DEFAULT_TAGS.length).toBeGreaterThan(0)
    })
  })

  describe('addPatientTag', () => {
    it('should add a tag to a patient', async () => {
      const existingPatient = { id: 'p1', tags: ['vip'] }
      ;(findById as jest.Mock).mockResolvedValue(existingPatient)
      ;(update as jest.Mock).mockResolvedValue({ id: 'p1', tags: ['vip', 'premium'] })

      const result = await addPatientTag('p1', 'premium')
      expect(result).toBe(true)
      expect(findById).toHaveBeenCalledWith('p1')
      expect(update).toHaveBeenCalledWith('p1', { tags: ['vip', 'premium'] })
    })

    it('should return false when patient not found', async () => {
      ;(findById as jest.Mock).mockResolvedValue(null)
      const result = await addPatientTag('nonexistent', 'premium')
      expect(result).toBe(false)
    })

    it('should return true if tag already exists', async () => {
      const existingPatient = { id: 'p1', tags: ['vip', 'premium'] }
      ;(findById as jest.Mock).mockResolvedValue(existingPatient)
      const result = await addPatientTag('p1', 'premium')
      expect(result).toBe(true)
      // update should NOT be called since tag already exists
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('removePatientTag', () => {
    it('should remove a tag from patient', async () => {
      const patient = { id: 'p1', tags: ['vip', 'premium', 'orthodontic'] }
      ;(findById as jest.Mock).mockResolvedValue(patient)
      ;(update as jest.Mock).mockResolvedValue({ id: 'p1', tags: ['vip'] })

      const result = await removePatientTag('p1', 'premium')
      expect(result).toBeTruthy()
      expect(update).toHaveBeenCalledWith('p1', { tags: ['vip', 'orthodontic'] })
    })

    it('should return false when patient not found', async () => {
      ;(findById as jest.Mock).mockResolvedValue(null)
      const result = await removePatientTag('nonexistent', 'premium')
      expect(result).toBe(false)
    })
  })

  describe('setPatientTags', () => {
    it('should set all tags for a patient', async () => {
      ;(update as jest.Mock).mockResolvedValue({ id: 'p1', tags: ['vip', 'new-tag'] })
      const result = await setPatientTags('p1', ['vip', 'new-tag'])
      expect(result).toBe(true)
      expect(update).toHaveBeenCalledWith('p1', { tags: ['vip', 'new-tag'] })
    })
  })

  describe('getClinicTags', () => {
    it('should return unique tags from clinic patients', async () => {
      const mockRows = [
        { tags: ['vip', 'invisalign'] },
        { tags: ['vip', 'orthodontic'] },
        { tags: null },
      ]

      // Configure the select().from().where() chain
      const mockWhereFn = jest.fn().mockResolvedValue(mockRows)
      const mockFromFn = jest.fn().mockReturnValue({ where: mockWhereFn })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: mockFromFn })

      const tags = await getClinicTags('c1')

      expect(tags).toContain('vip')
      expect(tags).toContain('invisalign')
      expect(tags).toContain('orthodontic')
    })

    it('should return empty array on error', async () => {
      const mockWhereFn = jest.fn().mockRejectedValue(new Error('DB error'))
      const mockFromFn = jest.fn().mockReturnValue({ where: mockWhereFn })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: mockFromFn })

      const tags = await getClinicTags('c1')
      expect(tags).toEqual([])
    })
  })

  describe('getPatientsByTag', () => {
    it('should find patients with specific tag', async () => {
      const mockRows = [
        { id: 'p1', name: 'João', phone: '11999999999', tags: ['vip'] },
        { id: 'p2', name: 'Maria', phone: '11888888888', tags: ['vip'] },
      ]

      const mockWhereFn = jest.fn().mockResolvedValue(mockRows)
      const mockFromFn = jest.fn().mockReturnValue({ where: mockWhereFn })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: mockFromFn })

      const results = await getPatientsByTag('c1', 'vip')
      expect(results).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      const mockWhereFn = jest.fn().mockRejectedValue(new Error('DB error'))
      const mockFromFn = jest.fn().mockReturnValue({ where: mockWhereFn })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: mockFromFn })

      const results = await getPatientsByTag('c1', 'nonexistent')
      expect(results).toEqual([])
    })
  })
})