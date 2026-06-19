/**
 * Follow-up Service — behavioral tests (Drizzle-migrated)
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/repositories/followup', () => ({
  createFeedback: jest.fn().mockResolvedValue(undefined),
}))

// Mock fetch for sendFollowUpMessage
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ messages: [{ id: 'msg-1' }] }),
}) as any

let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => {
      const result = queryResults[queryIndex++] ?? queryResults[queryResults.length - 1] ?? []
      return resolve(result)
    }),
  }
  return chain
}

let mdb = createMockDb()

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mdb),
  closeDb: jest.fn(),
}))

import {
  getProcedureGuidelines,
  getFollowUpConfig,
  getAppointmentsNeedingFollowUp,
  formatFollowUpMessage,
  getPatientsNeedingReturnReminder,
} from '../followup.service'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ messages: [{ id: 'msg-1' }] }),
  })
})

const now = new Date()
const day = (offset: number) => new Date(now.getTime() + offset * 86400000)

describe('FollowupService', () => {
  // ─── getProcedureGuidelines ──────────────────────────────────────────

  describe('getProcedureGuidelines', () => {
    it('returns guidelines when found', async () => {
      seed([{
        id: 'g1', clinicId: 'c1', procedureId: 'p1',
        procedureName: 'Limpeza', title: 'Pós-limpeza',
        instructions: 'Evite alimentos duros', emergencyContact: false,
        recoveryTimeDays: 2, restrictions: ['doces'], warningSigns: ['dor'],
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
      }])

      const result = await getProcedureGuidelines('c1', 'Limpeza')
      expect(result).not.toBeNull()
      expect(result!.title).toBe('Pós-limpeza')
    })

    it('returns null when not found', async () => {
      seed([])
      const result = await getProcedureGuidelines('c1', 'Nonexistent')
      expect(result).toBeNull()
    })
  })

  // ─── getFollowUpConfig ───────────────────────────────────────────────

  describe('getFollowUpConfig', () => {
    it('returns procedure-specific config', async () => {
      seed([{
        id: 'c1', clinicId: 'cl1', configType: 'post_consultation',
        procedureId: 'p1', procedureName: 'Limpeza',
        delayHours: 2, messageTemplate: 'Como foi?',
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
      }])

      const result = await getFollowUpConfig('cl1', 'post_consultation', 'Limpeza')
      expect(result).not.toBeNull()
      expect(result!.messageTemplate).toBe('Como foi?')
    })

    it('falls back to default config', async () => {
      seed(
        [], // no specific config
        [{ id: 'd1', clinicId: 'cl1', configType: 'post_consultation',
           procedureId: null, procedureName: null,
           delayHours: 24, messageTemplate: 'Default msg',
           isActive: true, createdAt: new Date(), updatedAt: new Date() }],
      )

      const result = await getFollowUpConfig('cl1', 'post_consultation', 'Extração')
      expect(result).not.toBeNull()
      expect(result!.messageTemplate).toBe('Default msg')
    })

    it('returns null when no config at all', async () => {
      seed([], [])
      const result = await getFollowUpConfig('cl1', 'budget_follow_up')
      expect(result).toBeNull()
    })
  })

  // ─── getAppointmentsNeedingFollowUp ──────────────────────────────────

  describe('getAppointmentsNeedingFollowUp', () => {
    it('returns completed appointments without existing feedback', async () => {
      seed(
        // appointments with joins
        [{
          id: 'a1', scheduledAt: new Date(), updatedAt: new Date(now.getTime() - 3 * 3600000),
          patientId: 'p1', patientName: 'João', patientPhone: '123',
          dentistName: 'Dr. Silva', procedureName: 'Limpeza',
          clinicId: 'c1', clinicName: 'Clinica X', clinicPhone: '456',
        }],
        // patient_feedback query → no existing feedback
        [],
      )

      const result = await getAppointmentsNeedingFollowUp(2)
      expect(result).toHaveLength(1)
      expect(result[0].patientName).toBe('João')
    })

    it('excludes appointments with existing feedback', async () => {
      seed(
        [{
          id: 'a1', scheduledAt: new Date(), updatedAt: new Date(now.getTime() - 3 * 3600000),
          patientId: 'p1', patientName: 'Ana', patientPhone: '111',
          dentistName: null, procedureName: null,
          clinicId: 'c1', clinicName: 'C', clinicPhone: '222',
        }],
        [{ appointmentId: 'a1' }], // already sent
      )

      const result = await getAppointmentsNeedingFollowUp(2)
      expect(result).toHaveLength(0)
    })
  })

  // ─── formatFollowUpMessage ───────────────────────────────────────────

  describe('formatFollowUpMessage', () => {
    const patient: any = {
      patientName: 'João', procedureName: 'Limpeza', dentistName: 'Dr. Silva',
      clinicName: 'Clinica X', clinicPhone: '123',
    }
    const config = {
      id: 'c1', clinicId: 'cl1', configType: 'post_consultation' as const,
      messageTemplate: 'Olá {{patient_name}}, {{procedure_name}} com {{dentist_name}} na {{clinic_name}} ({{clinic_phone}}) {{procedure_guidelines}}',
    }

    it('replaces all placeholders', () => {
      const msg = formatFollowUpMessage(patient, config, null)
      expect(msg).toContain('João')
      expect(msg).toContain('Limpeza')
      expect(msg).toContain('Dr. Silva')
      expect(msg).not.toContain('{{')
    })

    it('replaces guidelines when provided', () => {
      const guidelines = { id: 'g1', clinicId: 'c1', procedureName: 'Limpeza', title: 't', instructions: 'Beba água', emergencyContact: false }
      const msg = formatFollowUpMessage(patient, config, guidelines)
      expect(msg).toContain('Beba água')
    })

    it('falls back to default guidelines text', () => {
      const msg = formatFollowUpMessage(patient, config, null)
      expect(msg).toContain('Cuide bem da sua saúde bucal')
    })
  })

  // ─── getPatientsNeedingReturnReminder ────────────────────────────────

  describe('getPatientsNeedingReturnReminder', () => {
    it('returns patients with last visit in target window', async () => {
      const targetDate = new Date(now.getTime() - 6 * 30 * 86400000)
      seed(
        // patients + clinics join
        [{
          id: 'p1', name: 'Ana', phone: '123',
          lastVisit: targetDate,
          optOutReminders: false,
          clinicId: 'c1', clinicName: 'Clinic A', clinicPhone: '456',
        }],
        // appointments + procedures join
        [{
          patientId: 'p1', id: 'a1',
          scheduledAt: targetDate, status: 'completed',
          procedureName: 'Limpeza',
        }],
      )

      const result = await getPatientsNeedingReturnReminder(6)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Ana')
      expect(result[0].clinics.name).toBe('Clinic A')
      expect(result[0].appointments).toHaveLength(1)
      expect(result[0].appointments[0].procedures.name).toBe('Limpeza')
    })

    it('handles appointments without procedure name', async () => {
      seed(
        [{ id: 'p1', name: 'X', phone: '1', lastVisit: new Date(now.getTime() - 6*30*86400000), optOutReminders: false, clinicId: 'c1', clinicName: 'C', clinicPhone: '2' }],
        [{ patientId: 'p1', id: 'a1', scheduledAt: new Date(), status: 'completed', procedureName: null }],
      )

      const result = await getPatientsNeedingReturnReminder(6)
      expect(result[0].appointments[0].procedures).toBeNull()
    })

    it('returns empty when no patients match', async () => {
      seed([])
      const result = await getPatientsNeedingReturnReminder(6)
      expect(result).toEqual([])
    })
  })
})
