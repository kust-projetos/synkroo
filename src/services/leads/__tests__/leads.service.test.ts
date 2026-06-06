/**
 * Tests for Leads Service
 * Mocks: Supabase client (createTypedClient)
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ single: jest.fn() }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}))

import {
  calculateLeadScore,
  getTemperatureFromScore,
} from '../leads.service'

describe('Leads Service', () => {
  describe('calculateLeadScore()', () => {
    it('should return hot score for referral source with full info', () => {
      const result = calculateLeadScore({
        source: 'referral',
        hasPhone: true,
        hasEmail: true,
        expressedInterest: true,
        hasBudget: true,
        hasTimeline: true,
        respondedToFollowup: true,
        previousPatient: false,
      })
      expect(result.score).toBeGreaterThan(70)
    })

    it('should return cold score for web source with missing info', () => {
      const result = calculateLeadScore({
        source: 'web',
        hasPhone: false,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })
      expect(result.score).toBeLessThan(30)
    })

    it('should include factors in the result', () => {
      const result = calculateLeadScore({
        source: 'whatsapp',
        hasPhone: true,
        hasEmail: true,
        expressedInterest: true,
        hasBudget: true,
        hasTimeline: false,
        respondedToFollowup: false,
        previousPatient: true,
      })
      expect(result.factors).toBeInstanceOf(Array)
      expect(result.factors.length).toBeGreaterThan(0)
    })

    it('should return recommendation string', () => {
      const result = calculateLeadScore({
        source: 'instagram',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })
      expect(typeof result.recommendation).toBe('string')
    })
  })

  describe('getTemperatureFromScore()', () => {
    it('should return hot for score >= 70', () => {
      expect(getTemperatureFromScore(85)).toBe('hot')
      expect(getTemperatureFromScore(70)).toBe('hot')
    })

    it('should return warm for score 40-69', () => {
      expect(getTemperatureFromScore(60)).toBe('warm')
      expect(getTemperatureFromScore(40)).toBe('warm')
    })

    it('should return cold for score < 40', () => {
      expect(getTemperatureFromScore(30)).toBe('cold')
      expect(getTemperatureFromScore(0)).toBe('cold')
    })
  })
})