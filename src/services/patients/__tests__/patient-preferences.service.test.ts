/**
 * Tests for Patient Preferences Service
 * Tests observations, preferences, and scheduling preferences
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

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

describe('Patient Preferences Service', () => {
  const mockClient = { from: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
  })

  describe('addObservation', () => {
    it('should add an observation and return it', async () => {
      const mockObs = {
        id: 'obs-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        author_id: 'user-1',
        author_name: 'Dra. Maria',
        content: 'Paciente alérgico a latex',
        visibility: 'team_only',
        created_at: new Date().toISOString(),
      }

      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockObs, error: null }),
          }),
        }),
      })

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

    it('should default visibility to public', async () => {
      const mockObs = { id: 'obs-1', visibility: 'public' }

      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockObs, error: null }),
        }),
      })
      mockClient.from.mockReturnValue({ insert: insertMock })

      await addObservation({
        patientId: 'p1',
        clinicId: 'c1',
        authorId: 'u1',
        authorName: 'Test',
        content: 'test note',
      })

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'public' })
      )
    })

    it('should return null on error', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      })

      const result = await addObservation({
        patientId: 'p1', clinicId: 'c1', authorId: 'u1',
        authorName: 'Test', content: 'test',
      })

      expect(result).toBeNull()
    })
  })

  describe('getObservations', () => {
    it('should fetch observations for a patient', async () => {
      const mockObs = [
        { id: 'obs-1', content: 'Note 1', visibility: 'public' },
        { id: 'obs-2', content: 'Note 2', visibility: 'team_only' },
      ]

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockObs, error: null }),
          }),
        }),
      })

      const results = await getObservations('patient-1')
      expect(results).toHaveLength(2)
    })

    it('should filter by visibility', async () => {
      // Service does: .select().eq('patient_id').order().eq('visibility')
      // Need a chainable query object supporting eq + order + thenable
      const queryResult = { data: [], error: null }
      const query: any = {
        then: (resolve: any) => resolve(queryResult),
      }
      query.eq = jest.fn(() => query)
      query.order = jest.fn(() => query)

      mockClient.from.mockReturnValue({
        select: jest.fn(() => query),
      })

      const results = await getObservations('patient-1', { visibility: 'team_only' })
      // eq called twice: once for patient_id, once for visibility
      expect(query.eq).toHaveBeenCalledTimes(2)
      expect(results).toEqual([])
    })

    it('should return empty array on error', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
          }),
        }),
      })

      const results = await getObservations('patient-1')
      expect(results).toEqual([])
    })
  })

  describe('deleteObservation', () => {
    it('should delete observation by id and author', async () => {
      mockClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      })

      const result = await deleteObservation('obs-1', 'user-1')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
          }),
        }),
      })

      const result = await deleteObservation('obs-1', 'user-1')
      expect(result).toBe(false)
    })
  })

  describe('setPreference', () => {
    it('should upsert a preference', async () => {
      const mockPref = { id: 'pref-1', key: 'preferred_time', value: 'morning', category: 'scheduling' }

      mockClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockPref, error: null }),
          }),
        }),
      })

      const result = await setPreference({
        patientId: 'p1',
        clinicId: 'c1',
        key: 'preferred_time',
        value: 'morning',
        category: 'scheduling',
      })

      expect(result).toBeTruthy()
      expect(result!.key).toBe('preferred_time')
    })

    it('should return null on error', async () => {
      mockClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Upsert failed' } }),
          }),
        }),
      })

      const result = await setPreference({
        patientId: 'p1', clinicId: 'c1', key: 'k', value: 'v', category: 'general',
      })

      expect(result).toBeNull()
    })
  })

  describe('getSchedulingPreferences', () => {
    it('should return key-value map of scheduling prefs', async () => {
      const prefs = [
        { id: 'p1', key: 'preferred_time', value: 'morning', category: 'scheduling' },
        { id: 'p2', key: 'preferred_day', value: 'tuesday', category: 'scheduling' },
      ]

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: prefs, error: null }),
          }),
        }),
      })

      const result = await getSchedulingPreferences('patient-1')

      expect(result).toEqual({
        preferred_time: 'morning',
        preferred_day: 'tuesday',
      })
    })
  })
})
