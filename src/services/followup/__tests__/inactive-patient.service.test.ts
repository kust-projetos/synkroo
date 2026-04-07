/**
 * Tests for Campaign Service
 */

import {
  calculateDaysSinceLastVisit,
  getInactivitySegment,
  INACTIVITY_SEGMENTS,
} from '@/services/followup/inactive-patient.service'

describe('Inactive Patient Service', () => {
  describe('calculateDaysSinceLastVisit', () => {
    it('should return 999 for null lastVisit', () => {
      const result = calculateDaysSinceLastVisit(null)
      expect(result).toBe(999)
    })

    it('should calculate days correctly for recent visit', () => {
      const lastVisit = new Date()
      lastVisit.setDate(lastVisit.getDate() - 5)

      const result = calculateDaysSinceLastVisit(lastVisit)
      expect(result).toBe(5)
    })

    it('should calculate days correctly for old visit', () => {
      const lastVisit = new Date()
      lastVisit.setMonth(lastVisit.getMonth() - 3)

      const result = calculateDaysSinceLastVisit(lastVisit)
      expect(result).toBeGreaterThanOrEqual(89)
      expect(result).toBeLessThanOrEqual(92)
    })
  })

  describe('getInactivitySegment', () => {
    it('should return inactive_30 segment for 30-59 days', () => {
      expect(getInactivitySegment(30)?.segment).toBe('inactive_30')
      expect(getInactivitySegment(45)?.segment).toBe('inactive_30')
      expect(getInactivitySegment(59)?.segment).toBe('inactive_30')
    })

    it('should return inactive_60 segment for 60-89 days', () => {
      expect(getInactivitySegment(60)?.segment).toBe('inactive_60')
      expect(getInactivitySegment(75)?.segment).toBe('inactive_60')
      expect(getInactivitySegment(89)?.segment).toBe('inactive_60')
    })

    it('should return inactive_90 segment for 90-179 days', () => {
      expect(getInactivitySegment(90)?.segment).toBe('inactive_90')
      expect(getInactivitySegment(120)?.segment).toBe('inactive_90')
      expect(getInactivitySegment(179)?.segment).toBe('inactive_90')
    })

    it('should return inactive_180 segment for 180+ days', () => {
      expect(getInactivitySegment(180)?.segment).toBe('inactive_180')
      expect(getInactivitySegment(365)?.segment).toBe('inactive_180')
      expect(getInactivitySegment(999)?.segment).toBe('inactive_180')
    })

    it('should return null for less than 30 days', () => {
      expect(getInactivitySegment(0)).toBeNull()
      expect(getInactivitySegment(15)).toBeNull()
      expect(getInactivitySegment(29)).toBeNull()
    })
  })

  describe('INACTIVITY_SEGMENTS config', () => {
    it('should have correct priority order', () => {
      const priorities = INACTIVITY_SEGMENTS.map(s => s.priority)
      expect(priorities).toEqual([1, 2, 3, 4])
    })

    it('should have correct labels', () => {
      expect(INACTIVITY_SEGMENTS[0].label).toBe('Inativo 30 dias')
      expect(INACTIVITY_SEGMENTS[1].label).toBe('Inativo 60 dias')
      expect(INACTIVITY_SEGMENTS[2].label).toBe('Inativo 90 dias')
      expect(INACTIVITY_SEGMENTS[3].label).toBe('Inativo 6 meses')
    })
  })
})