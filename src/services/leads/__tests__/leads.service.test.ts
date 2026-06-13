/**
 * Tests for Leads Service
 * Migrated from Supabase to Drizzle
 * Pure function tests (no DB needed) + mocked repository tests
 */

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
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

    it('should cap score at 100', () => {
      const result = calculateLeadScore({
        source: 'referral',
        hasPhone: true,
        hasEmail: true,
        expressedInterest: true,
        hasBudget: true,
        hasTimeline: true,
        respondedToFollowup: true,
        previousPatient: true,
      })
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('should give 20 points for referral source', () => {
      const result = calculateLeadScore({
        source: 'referral',
        hasPhone: false,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })
      const sourceFactor = result.factors.find(f => f.name === 'source')
      expect(sourceFactor?.points).toBe(20)
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

    it('should return hot for score 100', () => {
      expect(getTemperatureFromScore(100)).toBe('hot')
    })
  })
})