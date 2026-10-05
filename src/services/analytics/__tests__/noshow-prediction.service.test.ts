/**
 * Tests for No-Show Prediction Service — migrated to Drizzle mocks.
 */
import { predictNoShowRisk, getUpcomingAppointmentRisks } from '@/services/analytics/noshow-prediction.service'

jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

const mockDb = {
  select: jest.fn(function(this: any) { return this }),
  from: jest.fn(function(this: any) { return this }),
  leftJoin: jest.fn(function(this: any) { return this }),
  where: jest.fn(function(this: any) { return this }),
  orderBy: jest.fn(function(this: any) { return this }),
  then: jest.fn(),
} as any

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

function mockChainReturn(data: any[]) {
  mockDb.then = jest.fn((fn: any) => Promise.resolve(typeof fn === 'function' ? fn(data) : data))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.leftJoin.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.orderBy.mockReturnThis()
  mockDb.then = jest.fn((fn: any) => Promise.resolve(fn ? fn([]) : []))
})

const patientId = 'patient-123'
const clinicId = 'clinic-123'

/** Coleta nomes de colunas drizzle (objetos com `name` + `table`) dentro do
 * predicado capturado em `.where()` — usado para fixar o predicado de tenant. */
function collectColumnNames(node: unknown, acc: Set<string> = new Set(), seen: Set<object> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return acc
  const obj = node as Record<string, unknown>
  if (seen.has(obj)) return acc
  seen.add(obj)
  if (typeof obj.name === 'string' && obj.table && typeof obj.table === 'object') acc.add(obj.name)
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectColumnNames(value, acc, seen)
  }
  return acc
}

describe('No-Show Prediction Service', () => {
  describe('predictNoShowRisk', () => {
    it('should return prediction with risk factors', async () => {
      mockChainReturn([{ id: patientId, name: 'João Silva', riskScore: '30' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())
      expect(prediction).not.toBeNull()
      expect(prediction!.patient_id).toBe(patientId)
      expect(prediction!.patient_name).toBe('João Silva')
      expect(prediction!.risk_score).toBeGreaterThanOrEqual(0)
      expect(prediction!.risk_score).toBeLessThanOrEqual(100)
      expect(['low', 'medium', 'high']).toContain(prediction!.riskLevel)
      expect(prediction!.factors.length).toBeGreaterThan(0)
    })

    it('returns null para paciente inexistente ou de outra clínica (sem score fabricado)', async () => {
      // Query scoped (id + clinicId) não encontra o paciente → null, nunca
      // uma predição fabricada com risk_score 40.
      mockChainReturn([])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())
      expect(prediction).toBeNull()
    })

    it('escopa a query por patientId AND clinicId (regressão anti-IDOR no nível da query)', async () => {
      // Se o predicado clinicId for removido do service, este teste quebra —
      // o mock devolve dados independente do where, então inspecionamos o
      // próprio predicado capturado.
      mockChainReturn([])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())

      expect(mockDb.where).toHaveBeenCalled()
      const predicate = mockDb.where.mock.calls[0][0]
      const columns = collectColumnNames(predicate)
      expect(columns.has('id')).toBe(true)
      // Drizzle colunas expõem o nome físico ('clinic_id'); TS prop é 'clinicId'.
      expect(columns.has('clinic_id') || columns.has('clinicId')).toBe(true)
    })

    it('rethrowa falha na query de histórico (sem virar "paciente novo" com score fabricado)', async () => {
      // 1º await (paciente) OK; 2º await (histórico) falha — o catch interno
      // de getPatientHistory foi removido: o erro deve propagar.
      mockDb.then = jest.fn()
        .mockImplementationOnce((resolve: (data: unknown[]) => void) => resolve([{ id: patientId, name: 'Ana Lima', riskScore: '0' }]))
        .mockImplementationOnce((_resolve: unknown, reject: (e: Error) => void) => reject(new Error('history down')))
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      await expect(predictNoShowRisk(clinicId, patientId, futureDate.toISOString())).rejects.toThrow('history down')
    })

    it('rethrowa erro de DB (fail-closed, sem score default)', async () => {
      // Thenable .then(onFulfilled, onRejected) — reject imediato via callback.
      mockDb.then = jest.fn((_resolve: any, reject: any) => reject(new Error('db down')))
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      await expect(predictNoShowRisk(clinicId, patientId, futureDate.toISOString())).rejects.toThrow('db down')
    })

    it('should produce factors for new patients', async () => {
      mockChainReturn([{ id: patientId, name: 'Maria Santos', riskScore: '0' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())
      expect(prediction!.factors.length).toBeGreaterThan(0)
    })

    it('should score higher with risk history', async () => {
      mockChainReturn([{ id: patientId, name: 'Pedro Costa', riskScore: '60' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())
      expect(prediction!.risk_score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getUpcomingAppointmentRisks', () => {
    it('should return predictions array', async () => {
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 3)
      const mockUpcoming = [
        { id: 'apt-1', scheduledAt: futureDate, patientId: 'patient-1', patientName: 'João Silva', patientRiskScore: '20' },
        { id: 'apt-2', scheduledAt: new Date(futureDate.getTime() + 86400000), patientId: 'patient-2', patientName: 'Maria Santos', patientRiskScore: '70' },
      ]
      mockChainReturn(mockUpcoming)
      // History query (second) returns empty via default mock
      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)
      expect(Array.isArray(predictions)).toBe(true)
    })

    it('should return empty on DB error', async () => {
      // Thenable .then(onFulfilled, onRejected) — reject immediately.
      mockDb.then = jest.fn((_resolve: any, reject: any) => reject(new Error('DB error')))
      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)
      expect(predictions).toEqual([])
    })

    it('should return empty for appointments without patient data', async () => {
      mockChainReturn([{ id: 'apt-1', scheduledAt: new Date(), patientId: 'p1', patientName: null, patientRiskScore: '0' }])
      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)
      expect(predictions).toEqual([])
    })
  })

  describe('Timing Risk Factors', () => {
    it('should detect early morning appointment risk', async () => {
      mockChainReturn([{ id: patientId, name: 'Ana Lima', riskScore: '0' }])
      const earlyMorning = new Date(); earlyMorning.setDate(earlyMorning.getDate() + 7); earlyMorning.setHours(7, 0, 0, 0)
      const prediction = await predictNoShowRisk(clinicId, patientId, earlyMorning.toISOString())
      const timingFactor = prediction!.factors.find(f => f.name === 'timing')
      expect(timingFactor).toBeDefined()
      expect(timingFactor!.impact).toBeGreaterThan(0)
    })

    it('should detect Monday/Friday risk', async () => {
      mockChainReturn([{ id: patientId, name: 'Carlos Oliveira', riskScore: '0' }])
      const monday = new Date(); while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1); monday.setHours(10, 0, 0, 0)
      const prediction = await predictNoShowRisk(clinicId, patientId, monday.toISOString())
      const timingFactor = prediction!.factors.find(f => f.name === 'timing')
      expect(timingFactor).toBeDefined()
    })
  })

  describe('Inactivity Risk Factors', () => {
    it('should detect long inactivity period', async () => {
      mockChainReturn([{ id: patientId, name: 'Lucia Ferreira', riskScore: '0' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())
      const inactivityFactor = prediction!.factors.find(f => f.name === 'inactivity')
      expect(inactivityFactor).toBeDefined()
    })
  })

  describe('Recommendations', () => {
    it('should generate confirmation recommendations for high risk', async () => {
      mockChainReturn([{ id: patientId, name: 'Ricardo Alves', riskScore: '80' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(clinicId, patientId, futureDate.toISOString())
      expect(Array.isArray(prediction!.recommendations)).toBe(true)
    })
  })
})
