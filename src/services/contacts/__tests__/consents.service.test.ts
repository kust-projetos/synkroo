/**
 * Tests for Consents Service
 */

import {
  getConsentsForContact,
  grantConsent,
  revokeConsent,
} from '@/services/contacts/consents.service'

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { error: jest.fn(), info: jest.fn() },
}))

const mockSupabase = { from: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  require('@/lib/supabase/typed').createTypedClient.mockReturnValue(mockSupabase)
})

describe('Consents Service', () => {
  const clinicId = 'clinic-123'

  describe('getConsentsForContact', () => {
    it('should get all consents for a contact', async () => {
      const mockConsents = [
        { id: 'c1', contact_id: 'p1', contact_type: 'patient', purpose: 'data_collection', granted: true },
        { id: 'c2', contact_id: 'p1', contact_type: 'patient', purpose: 'marketing', granted: false },
      ]

      // Chain: .select().eq().eq().eq() - returns {data, error}
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({ data: mockConsents, error: null }),
            }),
          }),
        }),
      })

      const result = await getConsentsForContact(clinicId, 'p1', 'patient')

      expect(result).toHaveLength(2)
    })

    it('should return empty array when no consents', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({ data: [], error: null }),
            }),
          }),
        }),
      })

      const result = await getConsentsForContact(clinicId, 'p1', 'patient')

      expect(result).toEqual([])
    })
  })

  describe('grantConsent', () => {
    it('should grant consent successfully', async () => {
      const mockConsent = {
        id: 'c-new', clinic_id: clinicId, contact_id: 'p1', contact_type: 'patient',
        purpose: 'whatsapp_communication', granted: true, granted_at: '2024-01-15T10:00:00Z',
      }

      mockSupabase.from.mockReturnValue({
        upsert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockConsent, error: null }),
          }),
        }),
      })

      const result = await grantConsent(clinicId, {
        contact_id: 'p1', contact_type: 'patient', purpose: 'whatsapp_communication',
      })

      expect(result).not.toBeNull()
      expect(result.granted).toBe(true)
    })
  })

  describe('revokeConsent', () => {
    it('should revoke consent successfully', async () => {
      const mockConsent = {
        id: 'c1', clinic_id: clinicId, contact_id: 'p1', contact_type: 'patient',
        purpose: 'marketing', granted: false, revoked_at: '2024-01-15T10:00:00Z',
      }

      // Chain: .update().eq().eq().eq().eq().select().single()
      mockSupabase.from.mockReturnValue({
        update: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: jest.fn().mockResolvedValue({ data: mockConsent, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })

      const result = await revokeConsent(clinicId, 'p1', 'patient', 'marketing')

      expect(result).not.toBeNull()
      expect(result.granted).toBe(false)
    })
  })
})
