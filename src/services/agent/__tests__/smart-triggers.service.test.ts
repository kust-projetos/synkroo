/**
 * Smart Triggers Service — behavioral tests (Drizzle-migrated)
 *
 * Mock strategy v2: directly resolve DB queries instead of chainable thenable.
 */
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/services/whatsapp', () => ({
  sendWhatsAppMessage: jest.fn().mockResolvedValue(undefined),
}))

import { sendWhatsAppMessage } from '@/services/whatsapp'

// Query results queue
let queryResults: any[] = []
let queryIndex = 0

// Create a DB mock that resolves queries from the queue
function createMockDb() {
  const query = () => {
    const result = queryResults[queryIndex++] ?? queryResults[queryResults.length - 1] ?? []
    return Promise.resolve(result)
  }

  const chain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(() => Promise.resolve()),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    // Make the chain thenable
    then: jest.fn((resolve: any) => {
      const result = queryResults[queryIndex++] ?? queryResults[queryResults.length - 1] ?? []
      return resolve(result)
    }),
  }

  // Each method returns the chain (for chaining) but then() resolves from queue
  return chain
}

let mdb = createMockDb()

jest.mock('@/lib/db/client', () => {
  return {
    getDb: jest.fn(() => mdb),
    closeDb: jest.fn(),
  }
})

import { smartTriggersService } from '../smart-triggers.service'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
  // Note: don't clearAllMocks when using thenable mock pattern
  ;(sendWhatsAppMessage as jest.Mock).mockResolvedValue(undefined)
})

describe('SmartTriggersService', () => {
  describe('checkCooldown', () => {
    it('returns true when no recent logs and under monthly quota', async () => {
      seed([], [])
      const result = await smartTriggersService.checkCooldown('patient-1', 'no_show_recovery_1h', 1440)
      expect(result).toBe(true)
    })

    it('returns false when a log exists within cooldown', async () => {
      seed([{ id: 'existing' }])
      const result = await smartTriggersService.checkCooldown('patient-1', 'no_show_recovery_1h', 1440)
      expect(result).toBe(false)
    })

    it('returns false when monthly quota exceeded', async () => {
      seed([], [{ id: '1' }, { id: '2' }])
      const result = await smartTriggersService.checkCooldown('patient-1', 'inactive_30d_check', 43200)
      expect(result).toBe(false)
    })
  })

  describe('logTrigger', () => {
    it('inserts a trigger log entry', async () => {
      await smartTriggersService.logTrigger({
        clinicId: 'clinic-1', patientId: 'patient-1',
        triggerType: 'no_show_recovery_1h', messageSent: 'test message',
      })
      expect(mdb.insert).toHaveBeenCalled()
    })

    it('does not throw on insert error', async () => {
      mdb.values = jest.fn().mockRejectedValue(new Error('DB error'))
      await expect(
        smartTriggersService.logTrigger({
          clinicId: 'clinic-1', patientId: 'patient-1',
          triggerType: 'no_show_recovery_1h', messageSent: 'test message',
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('recordResponse', () => {
    it('updates trigger log with response', async () => {
      mdb.set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
      await smartTriggersService.recordResponse('trigger-log-1', 'Sim!')
      expect(mdb.update).toHaveBeenCalled()
      expect(mdb.set).toHaveBeenCalled()
    })
  })

  describe('processNoShowRecovery', () => {
    it('processes no-show appointments and sends messages', async () => {
      seed(
        [{ id: 'a1', patientId: 'p1', clinicId: 'c1', scheduledAt: new Date(), procedureId: null, dentistId: null }],
        [{ name: 'João', phone: '+5511999999999' }],
        [{ name: 'Clinica X', phone: '+5511888888888' }],
        [], // cooldown
        [], // quota
      )
      const summary = await smartTriggersService.processNoShowRecovery()
      expect(summary.sent).toBe(1)
    })

    it('skips when no appointments match', async () => {
      seed([])
      const summary = await smartTriggersService.processNoShowRecovery()
      expect(summary.sent).toBe(0)
    })
  })

  describe('processPostAppointmentFollowup', () => {
    it('processes completed appointments with procedure info', async () => {
      seed(
        [{ id: 'a2', patientId: 'p2', clinicId: 'c2', scheduledAt: new Date(Date.now() - 86400000), procedureId: 'proc-1', dentistId: 'dent-1' }],
        [{ name: 'Maria', phone: '+5511977777777' }],
        [{ name: 'Clinic Y', phone: '+5511966666666' }],
        [], [], // cooldown checks
        [{ name: 'Limpeza' }], // procedure
        [{ name: 'Dr. Silva' }], // dentist
      )
      const summary = await smartTriggersService.processPostAppointmentFollowup()
      expect(summary.sent).toBe(1)
    })
  })

  describe('processInactivePatients', () => {
    it('sends messages for patients with valid phone', async () => {
      // Override checkCooldown (already tested separately)
      const orig = smartTriggersService.checkCooldown
      smartTriggersService.checkCooldown = jest.fn().mockResolvedValue(true) as any

      seed(
        [{ id: 'px', name: 'X', phone: '+55', lastVisitAt: new Date(Date.now() - 40*86400000), clinicId: 'cx' }],
        [{ name: 'Clinica', phone: '+55' }],
        // reactivation_90d patients (empty) — consumed by then(), not insert
        [],
      )
      const r = await smartTriggersService.processInactivePatients()
      expect(r[0].triggerType).toBe('inactive_30d_check')
      expect(r[0].sent).toBe(1)
      
      smartTriggersService.checkCooldown = orig
    })

    it('processes both inactive_30d and reactivation_90d', async () => {
      // Mock checkCooldown to always return true
      const orig = smartTriggersService.checkCooldown
      smartTriggersService.checkCooldown = jest.fn().mockResolvedValue(true) as any

      // Note: insert().values() uses a separate mock (doesnt consume then slots)
      seed(
        [{ id: 'p30', name: 'Ana', phone: '+5511933333333', lastVisitAt: new Date(Date.now() - 40*86400000), clinicId: 'c10' }],
        [{ name: 'Clinic A', phone: '+5511922222222' }],
        [{ id: 'p90', name: 'Carlos', phone: '+5511911111111', lastVisitAt: new Date(Date.now() - 100*86400000), clinicId: 'c10' }],
        [{ name: 'Clinic B', phone: '+5511900000000' }],
      )
      const r = await smartTriggersService.processInactivePatients()
      expect(r).toHaveLength(2)
      expect(r[0].sent).toBe(1)
      expect(r[1].sent).toBe(1)
      
      smartTriggersService.checkCooldown = orig
    })

    it('skips patients without phone', async () => {
      seed(
        [{ id: 'pnophone', name: 'Sem', phone: null, lastVisitAt: new Date(Date.now() - 40*86400000), clinicId: 'c99' }],
        [], // reactivation empty
      )
      const r = await smartTriggersService.processInactivePatients()
      expect(r[0].skipped).toBe(1)
      expect(r[0].sent).toBe(0)
    })
  })

  describe('processAll', () => {
    it('runs all triggers', async () => {
      seed([], [], [], [], []) // 5 empty results for 5 trigger types
      const summaries = await smartTriggersService.processAll()
      expect(summaries).toHaveLength(5)
    })
  })
})
