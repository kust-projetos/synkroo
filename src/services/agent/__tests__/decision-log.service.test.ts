/**
 * Tests for Decision Log Service
 */

function createChain(finalResult: any): any {
  const c: any = {
    then(resolve?: (v: any) => any) { return resolve?.(finalResult) },
  }
  const methods = ['insert', 'select', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'single', 'contains', 'overlaps']
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

import { decisionLogService } from '../decision-log.service'

describe('Decision Log Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('logDecision', () => {
    it('should insert and return id', async () => {
      const c = createChain({ data: { id: 'log-123' }, error: null })
      mockFrom.mockReturnValue(c)
      const id = await decisionLogService.logDecision({
        clinicId: 'c1', intentClassified: 'agendamento',
        confidenceScore: 0.92, actionTaken: 'schedule', riskLevel: 'LOW', reasoning: 'test',
      })
      expect(id).toBe('log-123')
    })

    it('should return empty string on insert error', async () => {
      const c = createChain({ data: null, error: { message: 'failed' } })
      mockFrom.mockReturnValue(c)
      const id = await decisionLogService.logDecision({
        clinicId: 'c1', intentClassified: 'test', confidenceScore: 0.9,
        actionTaken: 'respond', riskLevel: 'LOW', reasoning: 'test',
      })
      expect(id).toBe('')
    })

    it('should return empty string on exception', async () => {
      mockFrom.mockImplementation(() => { throw new Error('fail') })
      const id = await decisionLogService.logDecision({
        clinicId: 'c1', intentClassified: 'test', confidenceScore: 0.9,
        actionTaken: 'respond', riskLevel: 'LOW', reasoning: 'test',
      })
      expect(id).toBe('')
    })
  })

  describe('getRecentLogs', () => {
    it('should fetch logs for a clinic', async () => {
      const c = createChain({ data: [{ id: '1' }, { id: '2' }], error: null })
      mockFrom.mockReturnValue(c)
      const logs = await decisionLogService.getRecentLogs('c1', 50)
      expect(logs).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      const c = createChain({ data: null, error: { message: 'fail' } })
      mockFrom.mockReturnValue(c)
      const logs = await decisionLogService.getRecentLogs('c1')
      expect(logs).toEqual([])
    })
  })

  describe('getLogsByConversation', () => {
    it('should fetch logs by conversation', async () => {
      const c = createChain({ data: [{ id: '1' }], error: null })
      mockFrom.mockReturnValue(c)
      const logs = await decisionLogService.getLogsByConversation('conv-1')
      expect(logs).toHaveLength(1)
    })
  })

  describe('getLogsByPatient', () => {
    it('should fetch logs by patient', async () => {
      const c = createChain({ data: [{ id: '1' }], error: null })
      mockFrom.mockReturnValue(c)
      const logs = await decisionLogService.getLogsByPatient('p1')
      expect(logs).toHaveLength(1)
    })
  })

  describe('getEscalationStats', () => {
    it('should compute stats correctly', async () => {
      const mockData = [
        { escalation_triggered: true, confidence_score: 0.5, intent_classified: 'reclamacao', risk_level: 'HIGH' },
        { escalation_triggered: false, confidence_score: 0.9, intent_classified: 'agendamento', risk_level: 'LOW' },
        { escalation_triggered: false, confidence_score: 0.85, intent_classified: 'agendamento', risk_level: 'LOW' },
      ]
      const c = createChain({ data: mockData, error: null })
      mockFrom.mockReturnValue(c)
      const stats = await decisionLogService.getEscalationStats('c1')
      expect(stats.totalDecisions).toBe(3)
      expect(stats.escalations).toBe(1)
      expect(stats.escalationRate).toBeCloseTo(33.33)
      expect(stats.avgConfidence).toBeCloseTo(0.75)
      expect(stats.riskDistribution.LOW).toBe(2)
      expect(stats.riskDistribution.HIGH).toBe(1)
    })

    it('should return empty stats on no data', async () => {
      const c = createChain({ data: [], error: null })
      mockFrom.mockReturnValue(c)
      const stats = await decisionLogService.getEscalationStats('c1')
      expect(stats.totalDecisions).toBe(0)
    })
  })

  describe('flagForReview', () => {
    it('should not throw', async () => {
      await expect(decisionLogService.flagForReview('id', 'reason')).resolves.not.toThrow()
    })
  })
})
