/**
 * Tests for ROI Calculation Service
 */

import { calculateROI, getROIMetrics } from '@/services/analytics/roi.service'

// Mock the Supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockSupabase = {
  from: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockReturnValue(mockSupabase)
})

describe('ROI Service', () => {
  const clinicId = 'clinic-123'
  const periodStart = '2026-03-01T00:00:00.000Z'
  const periodEnd = '2026-03-31T23:59:59.999Z'

  /**
   * Helper to create chainable mock for supabase queries
   */
  function createChainable(resolvedValue: { data?: unknown; count?: number | null; error?: unknown }) {
    const chain: Record<string, jest.Mock> = {}

    chain.select = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.in = jest.fn().mockReturnValue(chain)
    chain.not = jest.fn().mockReturnValue(chain)
    chain.gte = jest.fn().mockReturnValue(chain)
    chain.lte = jest.fn().mockReturnValue(chain)
    chain.lt = jest.fn().mockReturnValue(chain)

    // Terminal method
    chain.mockResolvedValue = jest.fn().mockResolvedValue(resolvedValue)

    // Make the chain itself thenable
    const thenable = Object.assign(() => chain, {
      then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
    })

    // Rebuild chain to return thenable at the end
    const result: Record<string, jest.Mock> = {}

    result.select = jest.fn().mockReturnValue(result)
    result.eq = jest.fn().mockReturnValue(result)
    result.in = jest.fn().mockReturnValue(result)
    result.not = jest.fn().mockReturnValue(result)
    result.gte = jest.fn().mockReturnValue(result)
    result.lte = jest.fn().mockReturnValue(result)
    result.lt = jest.fn().mockReturnValue(result)

    // Make thenable
    Object.assign(result, {
      then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
    })

    return result
  }

  describe('calculateROI', () => {
    it('should calculate ROI correctly with data', async () => {
      // Mock conversations query (returns 5 conversations)
      const conversationsChain = createChainable({
        data: [
          { id: 'conv-1' },
          { id: 'conv-2' },
          { id: 'conv-3' },
          { id: 'conv-4' },
          { id: 'conv-5' },
        ],
        error: null,
      })

      // Mock messages count query (AI-handled)
      const messagesChain = createChainable({
        count: 100,
        error: null,
      })

      // Mock messages count query (AI-booked)
      const bookedChain = createChainable({
        count: 20,
        error: null,
      })

      // Mock no-show appointments query
      const noShowChain = createChainable({
        data: [
          { patient_id: 'patient-1' },
          { patient_id: 'patient-2' },
          { patient_id: 'patient-1' }, // duplicate patient
        ],
        error: null,
      })

      // Mock recovered no-shows query
      const recoveredChain = createChainable({
        count: 5,
        error: null,
      })

      let callIndex = 0
      mockSupabase.from.mockImplementation((table: string) => {
        callIndex++
        if (table === 'conversations') {
          // First 2 calls are conversations (for messages and bookings)
          return conversationsChain
        }
        if (table === 'messages') {
          // Messages calls: first is AI-handled count, second is AI-booked count
          if (callIndex % 2 === 0) return bookedChain
          return messagesChain
        }
        if (table === 'appointments') {
          // First appointments call: no-show history, second: recovered
          if (callIndex <= 5) return noShowChain
          return recoveredChain
        }
        return createChainable({ data: [], error: null })
      })

      const result = await calculateROI(clinicId, periodStart, periodEnd)

      // Verify structure
      expect(result).toHaveProperty('period')
      expect(result.period.start).toBe(periodStart)
      expect(result.period.end).toBe(periodEnd)

      expect(result).toHaveProperty('savings')
      expect(result).toHaveProperty('revenue')
      expect(result).toHaveProperty('costs')
      expect(result).toHaveProperty('roi')
      expect(result).toHaveProperty('netBenefit')

      // Verify cost defaults
      expect(result.costs.platform).toBe(297)
      expect(result.costs.total).toBe(297)
    })

    it('should return zeroed metrics when no data exists', async () => {
      const emptyChain = createChainable({
        data: [],
        error: null,
      })

      const zeroCountChain = createChainable({
        count: 0,
        error: null,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'conversations') return emptyChain
        return zeroCountChain
      })

      const result = await calculateROI(clinicId, periodStart, periodEnd)

      expect(result.savings.messagesHandled).toBe(0)
      expect(result.savings.totalSaved).toBe(0)
      expect(result.revenue.appointmentsBooked).toBe(0)
      expect(result.revenue.totalRevenue).toBe(0)
      expect(result.revenue.recoveredNoShows).toBe(0)
      expect(result.revenue.recoveredRevenue).toBe(0)
      expect(result.roi).toBe(-100) // netBenefit = 0 + 0 - 297 = -297, roi = (-297/297)*100
      expect(result.netBenefit).toBe(-297)
    })

    it('should handle database errors gracefully', async () => {
      const errorChain = createChainable({
        data: null,
        error: { message: 'Database connection failed' },
      })

      mockSupabase.from.mockReturnValue(errorChain)

      const result = await calculateROI(clinicId, periodStart, periodEnd)

      // Should return zeroed metrics on error
      expect(result.savings.messagesHandled).toBe(0)
      expect(result.revenue.appointmentsBooked).toBe(0)
    })
  })

  describe('getROIMetrics', () => {
    it('should return ROI with period comparison', async () => {
      // Setup mock for both current and previous period queries
      const conversationsChain = createChainable({
        data: [{ id: 'conv-1' }],
        error: null,
      })

      const countChain = createChainable({
        count: 50,
        error: null,
      })

      const noShowChain = createChainable({
        data: [{ patient_id: 'patient-1' }],
        error: null,
      })

      const recoveredChain = createChainable({
        count: 3,
        error: null,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'conversations') return conversationsChain
        if (table === 'appointments') {
          // Alternate between no-show history and recovered
          return recoveredChain
        }
        return countChain
      })

      const result = await getROIMetrics(clinicId, 'month', '2026-03-01')

      expect(result).toHaveProperty('comparison')
      expect(result.comparison).toHaveProperty('previousPeriod')
      expect(result.comparison).toHaveProperty('changePercent')
    })

    it('should reject invalid period parameter', async () => {
      const result = await getROIMetrics(clinicId, 'month', '2026-03-01')

      // Month is valid, should work
      expect(result).toHaveProperty('roi')
    })

    it('should default to month period', async () => {
      const emptyChain = createChainable({ data: [], error: null })
      const zeroChain = createChainable({ count: 0, error: null })

      mockSupabase.from.mockImplementation(() => emptyChain)

      const result = await getROIMetrics(clinicId)

      expect(result.period.start).toBeDefined()
      expect(result.period.end).toBeDefined()
    })

    it('should handle quarter period', async () => {
      const emptyChain = createChainable({ data: [], error: null })

      mockSupabase.from.mockImplementation(() => emptyChain)

      const result = await getROIMetrics(clinicId, 'quarter', '2026-03-01')

      expect(result).toHaveProperty('period')
      expect(result).toHaveProperty('roi')
    })

    it('should handle year period', async () => {
      const emptyChain = createChainable({ data: [], error: null })

      mockSupabase.from.mockImplementation(() => emptyChain)

      const result = await getROIMetrics(clinicId, 'year', '2026-01-01')

      expect(result).toHaveProperty('period')
      expect(result).toHaveProperty('roi')
    })
  })

  describe('ROI Calculation Formula', () => {
    it('should calculate positive ROI when benefits exceed costs', async () => {
      // Setup: all conversations and messages queries return data
      // and appointments queries return proper data for recovered no-shows
      const conversationChain = createChainable({
        data: [{ id: 'conv-1' }, { id: 'conv-2' }],
        error: null,
      })
      const messagesCountChain = createChainable({ count: 100, error: null })
      const bookedCountChain = createChainable({ count: 20, error: null })
      const noShowDataChain = createChainable({
        data: [{ patient_id: 'p1' }, { patient_id: 'p2' }],
        error: null,
      })
      const recoveredCountChain = createChainable({ count: 5, error: null })

      const calls: string[] = []
      mockSupabase.from.mockImplementation((table: string) => {
        calls.push(table)
        if (table === 'conversations') return conversationChain
        if (table === 'appointments') {
          // First call = no-show history (returns data), second = recovered (returns count)
          const aptCalls = calls.filter((t) => t === 'appointments').length
          return aptCalls <= 1 ? noShowDataChain : recoveredCountChain
        }
        // messages: first call = AI-handled, second call = AI-booked
        const msgCalls = calls.filter((t) => t === 'messages').length
        return msgCalls <= 1 ? messagesCountChain : bookedCountChain
      })

      const result = await calculateROI(clinicId, periodStart, periodEnd)

      // savings: 100 msgs * 3 min * (R$25/60) = R$125
      expect(result.savings.totalSaved).toBe(125)
      // revenue: (20 * R$350) + (5 * R$350) = R$8,750
      expect(result.revenue.totalRevenue).toBe(8750)
      // cost: R$297
      expect(result.costs.total).toBe(297)
      // net benefit: 125 + 8750 - 297 = R$8,578
      expect(result.netBenefit).toBe(8578)
      // ROI should be positive
      expect(result.roi).toBeGreaterThan(0)

      // Verify the correct tables were queried
      expect(calls).toContain('conversations')
      expect(calls).toContain('messages')
      expect(calls).toContain('appointments')
    })

    it('should calculate negative ROI when costs exceed benefits', async () => {
      const emptyChain = createChainable({ data: [], error: null })

      mockSupabase.from.mockReturnValue(emptyChain)

      const result = await calculateROI(clinicId, periodStart, periodEnd)

      // No data means zero savings and revenue, but still R$297 cost
      expect(result.roi).toBe(-100)
      expect(result.netBenefit).toBe(-297)
    })
  })
})
