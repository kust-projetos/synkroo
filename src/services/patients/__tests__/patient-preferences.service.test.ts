/**
 * Tests for Patient Preferences Service
 * Migrated from Supabase mock to Drizzle mock
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  addObservation,
  getObservations,
  deleteObservation,
  setPreference,
  getPreferences,
  getSchedulingPreferences,
} from '../patient-preferences.service'

import { mockDb } from '@/test-utils/db-mock'

// Build a simple chain: select() → { from: fn } → { where: fn }
// Uses mockImplementation so it works on EVERY call (not just first)
function makeSelectChain(resolvedValue: unknown) {
  const limitFn = jest.fn().mockResolvedValue(resolvedValue)
  // whereFn must: (a) await to resolvedValue, (b) expose .limit()
  // Use thenable object so both patterns work
  const whereFn = jest.fn().mockImplementation(() => ({
    limit: limitFn,
    then: (resolve: (val: unknown) => void) => { resolve(resolvedValue) },
    catch: (_rej: (err: unknown) => void) => ({ then: (resolve: (val: unknown) => void) => { resolve(resolvedValue) } }),
  }))
  const fromFn = jest.fn().mockImplementation(() => ({ where: whereFn }))
  const selectFn = jest.fn().mockImplementation(() => ({ from: fromFn }))
  return { selectFn, fromFn, whereFn, limitFn }
}

function makeInsertChain(resolvedValue: unknown[]) {
  const returningFn = jest.fn().mockResolvedValue(resolvedValue)
  const valuesFn = jest.fn().mockImplementation(() => ({ returning: returningFn }))
  const insertFn = jest.fn().mockImplementation(() => ({ values: valuesFn }))
  return { insertFn, valuesFn, returningFn }
}

function makeDeleteChain() {
  const whereFn = jest.fn().mockResolvedValue([])
  const deleteFn = jest.fn().mockImplementation(() => ({ where: whereFn }))
  return { deleteFn, whereFn }
}

function makeUpdateChain(returningResolvedValue: unknown[], whereResolvedValue: unknown = [{}]) {
  const returningFn = jest.fn().mockResolvedValue(returningResolvedValue)
  const whereFn = jest.fn().mockResolvedValue(whereResolvedValue)
  // setFn must expose .where() AND .returning() — Drizzle's .where() returns the UPDATE builder
  const setFn = jest.fn().mockImplementation(() => ({
    returning: returningFn,
    where: jest.fn().mockImplementation(() => ({ returning: returningFn })),
  }))
  const updateFn = jest.fn().mockImplementation(() => ({ set: setFn }))
  return { updateFn, setFn, whereFn, returningFn }
}

describe('Patient Preferences Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Use mockImplementation (not mockReturnValue) for defaults.
    // mockImplementation fires on every call and is NOT cleared by clearAllMocks.
    const dummyWhere = jest.fn().mockResolvedValue([])
    const dummyFrom = jest.fn().mockImplementation(() => ({ where: dummyWhere }))
    const dummyValues = jest.fn().mockImplementation(() => ({ returning: jest.fn().mockResolvedValue([]) }))
    const dummyDeleteWhere = jest.fn().mockResolvedValue([])
    ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: dummyFrom }))
    ;(mockDb.insert as jest.Mock).mockImplementation(() => ({ values: dummyValues }))
    ;(mockDb.update as jest.Mock).mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({ returning: jest.fn().mockResolvedValue([]) })),
    }))
    ;(mockDb.delete as jest.Mock).mockImplementation(() => ({ where: dummyDeleteWhere }))
  })

  describe('addObservation', () => {
    it('should add an observation and return it', async () => {
      const mockRow = {
        id: 'obs-1',
        patientId: 'patient-1',
        clinicId: 'clinic-1',
        content: 'Paciente alérgico a latex',
        createdBy: 'user-1',
        createdAt: new Date(),
      }
      const { returningFn } = makeInsertChain([mockRow])
      ;(mockDb.insert as jest.Mock).mockImplementation(() => ({
        values: () => ({ returning: returningFn }),
      }))

      const result = await addObservation({
        patientId: 'patient-1',
        clinicId: 'clinic-1',
        authorId: 'user-1',
        authorName: 'Dra. Maria',
        content: 'Paciente alérgico a latex',
        visibility: 'team_only',
      })

      expect(result).toBeTruthy()
      expect(result!.content).toBe('Paciente alérgico a latex')
      expect(result!.visibility).toBe('team_only')
    })

    it('should return null on insert error', async () => {
      // Returning empty array = insert failed
      const { returningFn } = makeInsertChain([])
      ;(mockDb.insert as jest.Mock).mockImplementation(() => ({
        values: () => ({ returning: returningFn }),
      }))

      const result = await addObservation({
        patientId: 'p1', clinicId: 'c1', authorId: 'u1',
        authorName: 'Test', content: 'test',
      })
      expect(result).toBeNull()
    })
  })

  describe('getObservations', () => {
    it('should fetch observations for a patient', async () => {
      const mockRows = [
        { id: 'obs-1', patientId: 'p1', clinicId: 'c1', content: 'Note 1', createdBy: 'u1', createdAt: new Date() },
        { id: 'obs-2', patientId: 'p1', clinicId: 'c1', content: 'Note 2', createdBy: 'u1', createdAt: new Date() },
      ]
      const { fromFn } = makeSelectChain(mockRows)
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      const results = await getObservations('p1')
      expect(results).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      // whereFn throws synchronously — service catches in try-catch
      const whereFn = jest.fn().mockImplementation(() => { throw new Error('DB error') })
      const fromFn = jest.fn().mockImplementation(() => ({ where: whereFn }))
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      const results = await getObservations('p1')
      expect(results).toEqual([])
    })
  })

  describe('deleteObservation', () => {
    it('should delete observation by id', async () => {
      const { deleteFn } = makeDeleteChain()
      ;(mockDb.delete as jest.Mock).mockImplementation(() => ({ where: deleteFn }))

      const result = await deleteObservation('obs-1', 'user-1')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      // whereFn throws — service catches and returns false
      const whereFn = jest.fn().mockImplementation(() => { throw new Error('DB error') })
      ;(mockDb.delete as jest.Mock).mockImplementation(() => ({ where: whereFn }))

      const result = await deleteObservation('obs-1', 'user-1')
      expect(result).toBe(false)
    })
  })

  describe('setPreference', () => {
    it('should update existing preference', async () => {
      // SELECT returns existing row → update path
      const { fromFn } = makeSelectChain([{ id: 'pref-1', key: 'preferred_time', value: 'old', category: 'scheduling' }])
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      // UPDATE chain
      const { setFn } = makeUpdateChain([{ id: 'pref-1', key: 'preferred_time', value: 'morning', category: 'scheduling' }])
      ;(mockDb.update as jest.Mock).mockImplementation(() => ({ set: setFn }))

      const result = await setPreference({
        patientId: 'p1', clinicId: 'c1', key: 'preferred_time', value: 'morning', category: 'scheduling',
      })

      expect(result).toBeTruthy()
      expect(result!.value).toBe('morning')
    })

    it('should insert new preference when not exists', async () => {
      // SELECT returns empty → insert path
      const { fromFn } = makeSelectChain([])
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      // INSERT chain
      const { valuesFn, returningFn } = makeInsertChain([{ id: 'pref-new', key: 'new_key', value: 'new_val', category: 'general' }])
      ;(mockDb.insert as jest.Mock).mockImplementation(() => ({ values: valuesFn }))

      const result = await setPreference({
        patientId: 'p1', clinicId: 'c1', key: 'new_key', value: 'new_val', category: 'general',
      })

      expect(result).toBeTruthy()
    })

    it('should return null on error', async () => {
      // SELECT throws → service catches and returns null
      const whereFn = jest.fn().mockImplementation(() => { throw new Error('DB error') })
      const fromFn = jest.fn().mockImplementation(() => ({ where: whereFn }))
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      const result = await setPreference({
        patientId: 'p1', clinicId: 'c1', key: 'k', value: 'v', category: 'general',
      })
      expect(result).toBeNull()
    })
  })

  describe('getPreferences', () => {
    it('should return preferences for a patient', async () => {
      const mockRows = [
        { id: 'p1', patientId: 'patient-1', clinicId: 'c1', key: 'preferred_time', value: 'morning', category: 'scheduling', updatedAt: new Date() },
      ]
      const { fromFn } = makeSelectChain(mockRows)
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      const results = await getPreferences('patient-1')
      expect(results).toHaveLength(1)
      expect(results[0].key).toBe('preferred_time')
    })
  })

  describe('getSchedulingPreferences', () => {
    it('should return key-value map of scheduling prefs', async () => {
      const mockRows = [
        { id: 'p1', patientId: 'p1', clinicId: 'c1', key: 'preferred_time', value: 'morning', category: 'scheduling', updatedAt: new Date() },
        { id: 'p2', patientId: 'p1', clinicId: 'c1', key: 'preferred_day', value: 'tuesday', category: 'scheduling', updatedAt: new Date() },
      ]
      const { fromFn } = makeSelectChain(mockRows)
      ;(mockDb.select as jest.Mock).mockImplementation(() => ({ from: fromFn }))

      const result = await getSchedulingPreferences('patient-1')

      expect(result).toEqual({
        preferred_time: 'morning',
        preferred_day: 'tuesday',
      })
    })
  })
})