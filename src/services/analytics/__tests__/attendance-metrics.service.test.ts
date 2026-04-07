/**
 * Tests for Attendance Metrics Service
 * Tests message volume, intent distribution, response time, and period comparison
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { getAttendanceMetrics } from '../attendance-metrics.service'

function createChain(finalResult: any): any {
  const c: any = {
    then(resolve?: (v: any) => any) { return resolve?.(finalResult) },
  }
  const methods = [
    'insert', 'select', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'single', 'contains', 'overlaps',
    'upsert', 'not', 'in', 'is',
  ]
  for (const m of methods) {
    if (m === 'single') {
      c[m] = jest.fn(() => Promise.resolve(finalResult))
    } else {
      c[m] = jest.fn(() => c)
    }
  }
  return c
}

describe('Attendance Metrics Service', () => {
  const mockFrom = jest.fn()
  const mockClient = { from: mockFrom }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
  })

  describe('getAttendanceMetrics', () => {
    const baseParams = {
      clinicId: 'clinic-1',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-15T23:59:59Z',
    }

    it('should return null on conversations query error', async () => {
      mockFrom.mockReturnValueOnce(createChain({ data: null, error: { message: 'DB error' } }))

      const result = await getAttendanceMetrics(baseParams)
      expect(result).toBeNull()
    })

    it('should calculate message volume correctly', async () => {
      const conversations = [
        { channel: 'whatsapp', created_at: '2026-03-15T10:00:00Z', metadata: {} },
        { channel: 'whatsapp', created_at: '2026-03-15T14:00:00Z', metadata: {} },
        { channel: 'instagram', created_at: '2026-03-16T09:00:00Z', metadata: {} },
      ]

      mockFrom
        // conversations query
        .mockReturnValueOnce(createChain({ data: conversations, error: null }))
        // agent_logs (intents)
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        // agent_logs (response times)
        .mockReturnValueOnce(createChain({ data: [], error: null }))

      const result = await getAttendanceMetrics(baseParams)

      expect(result).toBeTruthy()
      expect(result!.messageVolume.total).toBe(3)
      expect(result!.messageVolume.byChannel.whatsapp).toBe(2)
      expect(result!.messageVolume.byChannel.instagram).toBe(1)
    })

    it('should group messages by day', async () => {
      const conversations = [
        { channel: 'whatsapp', created_at: '2026-03-15T10:00:00Z', metadata: {} },
        { channel: 'whatsapp', created_at: '2026-03-15T14:00:00Z', metadata: {} },
        { channel: 'instagram', created_at: '2026-03-16T09:00:00Z', metadata: {} },
      ]

      mockFrom
        .mockReturnValueOnce(createChain({ data: conversations, error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))

      const result = await getAttendanceMetrics(baseParams)

      expect(result!.messageVolume.byDay).toHaveLength(2)
      const day15 = result!.messageVolume.byDay.find(d => d.date === '2026-03-15')
      expect(day15?.count).toBe(2)
      const day16 = result!.messageVolume.byDay.find(d => d.date === '2026-03-16')
      expect(day16?.count).toBe(1)
    })

    it('should calculate intent distribution with percentages', async () => {
      const agentLogs = [
        { intent: 'scheduling', confidence: 0.9 },
        { intent: 'scheduling', confidence: 0.85 },
        { intent: 'cancellation', confidence: 0.8 },
      ]

      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: agentLogs, error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))

      const result = await getAttendanceMetrics(baseParams)

      expect(result!.intentDistribution).toHaveLength(2)
      const scheduling = result!.intentDistribution.find(i => i.intent === 'scheduling')
      expect(scheduling?.count).toBe(2)
      expect(scheduling?.percentage).toBe(67) // 2/3 ≈ 67%
    })

    it('should calculate average response time', async () => {
      const responseLogs = [
        { response_time_ms: 500, intent: 'scheduling' },
        { response_time_ms: 1000, intent: 'scheduling' },
        { response_time_ms: 200, intent: 'cancellation' },
      ]

      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: responseLogs, error: null }))

      const result = await getAttendanceMetrics(baseParams)

      // Average: (500 + 1000 + 200) / 3 = 566.67 → 567
      expect(result!.responseTime.averageMs).toBe(567)
    })

    it('should calculate median response time', async () => {
      const responseLogs = [
        { response_time_ms: 500, intent: 'scheduling' },
        { response_time_ms: 1000, intent: 'scheduling' },
        { response_time_ms: 200, intent: 'cancellation' },
      ]

      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: responseLogs, error: null }))

      const result = await getAttendanceMetrics(baseParams)

      // Sorted: [200, 500, 1000], median index = floor(3/2) = 1 → 500
      expect(result!.responseTime.medianMs).toBe(500)
    })

    it('should calculate p95 response time', async () => {
      const responseLogs = [
        { response_time_ms: 100, intent: 'scheduling' },
        { response_time_ms: 200, intent: 'scheduling' },
        { response_time_ms: 300, intent: 'cancellation' },
        { response_time_ms: 500, intent: 'scheduling' },
        { response_time_ms: 3000, intent: 'scheduling' },
      ]

      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: responseLogs, error: null }))

      const result = await getAttendanceMetrics(baseParams)

      // Sorted: [100, 200, 300, 500, 3000]
      // p95 index = floor(5 * 0.95) = floor(4.75) = 4 → 3000
      expect(result!.responseTime.p95Ms).toBe(3000)
    })

    it('should group response times by intent', async () => {
      const responseLogs = [
        { response_time_ms: 500, intent: 'scheduling' },
        { response_time_ms: 1000, intent: 'scheduling' },
        { response_time_ms: 200, intent: 'cancellation' },
      ]

      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: responseLogs, error: null }))

      const result = await getAttendanceMetrics(baseParams)

      expect(result!.responseTime.byIntent.scheduling).toBe(750) // (500+1000)/2
      expect(result!.responseTime.byIntent.cancellation).toBe(200)
    })

    it('should include period comparison when compareWithPrevious=true', async () => {
      const conversations = [
        { channel: 'whatsapp', created_at: '2026-03-15T10:00:00Z', metadata: {} },
      ]
      const prevConversations = [
        { id: 'conv-prev-1' },
        { id: 'conv-prev-2' },
      ]

      mockFrom
        // current conversations
        .mockReturnValueOnce(createChain({ data: conversations, error: null }))
        // agent logs (intents)
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        // agent logs (response times)
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        // previous period conversations
        .mockReturnValueOnce(createChain({ data: prevConversations, error: null }))

      const result = await getAttendanceMetrics({
        ...baseParams,
        compareWithPrevious: true,
      })

      expect(result!.comparison).toBeTruthy()
      expect(result!.comparison!.previousPeriod.messageVolume).toBe(2)
      // 1 current vs 2 previous = -50% change
      expect(result!.comparison!.volumeChange).toBe(-50)
    })

    it('should handle empty data', async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))

      const result = await getAttendanceMetrics(baseParams)

      expect(result).toBeTruthy()
      expect(result!.messageVolume.total).toBe(0)
      expect(result!.messageVolume.byChannel).toEqual({})
      expect(result!.messageVolume.byDay).toEqual([])
      expect(result!.intentDistribution).toEqual([])
      expect(result!.responseTime.averageMs).toBe(0)
      expect(result!.responseTime.medianMs).toBe(0)
      expect(result!.responseTime.p95Ms).toBe(0)
    })

    it('should return correct period in result', async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))

      const result = await getAttendanceMetrics(baseParams)

      expect(result!.period.start).toBe('2026-03-01T00:00:00Z')
      expect(result!.period.end).toBe('2026-03-15T23:59:59Z')
    })

    it('should handle zero previous volume in comparison', async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: [{ channel: 'whatsapp', created_at: '2026-03-15T10:00:00Z', metadata: {} }], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null })) // 0 previous

      const result = await getAttendanceMetrics({
        ...baseParams,
        compareWithPrevious: true,
      })

      // prevVolume = 0, so volumeChange = 0 (avoid div by zero)
      expect(result!.comparison!.volumeChange).toBe(0)
    })
  })
})
