/**
 * Procedure Reminder Config Service — behavioral tests (Drizzle-migrated)
 *
 * Mock strategy: follows project conventions (chainable mock DB).
 * insert().values() uses a separate mock (doesn't consume then slots).
 */
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/modules/atendimento', () => ({
  fillTemplate: jest.fn((tpl: any, vals: Record<string, string>) => {
    let result = tpl.body
    for (const [k, v] of Object.entries(vals)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    }
    return result
  }),
}))

// Query results queue
let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
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
  getProcedureReminderConfig,
  getAllProcedureReminderConfigs,
  saveProcedureReminderConfig,
  getProcedureTypes,
  getDefaultReminderHours,
  getDefaultTemplate,
  validateTemplate,
  replacePlaceholders,
  getEffectiveConfig,
} from '../procedure-reminder-config.service'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
})

describe('ProcedureReminderConfigService', () => {
  // ─── getDefaultReminderHours ─────────────────────────────────────────

  describe('getDefaultReminderHours', () => {
    it('returns 48h for check-up', () => {
      expect(getDefaultReminderHours('check-up')).toBe(48)
    })
    it('returns 48h for consulta', () => {
      expect(getDefaultReminderHours('consulta')).toBe(48)
    })
    it('returns 24h for procedimento', () => {
      expect(getDefaultReminderHours('procedimento')).toBe(24)
    })
    it('returns 24h for cirurgia', () => {
      expect(getDefaultReminderHours('cirurgia')).toBe(24)
    })
    it('returns default 24h for unknown type', () => {
      expect(getDefaultReminderHours('ortodontia')).toBe(24)
    })
    it('is case-insensitive', () => {
      expect(getDefaultReminderHours('CHECK-UP')).toBe(48)
    })
  })

  // ─── getDefaultTemplate ──────────────────────────────────────────────

  describe('getDefaultTemplate', () => {
    it('returns template with placeholders', () => {
      const tpl = getDefaultTemplate('consulta')
      expect(tpl).toContain('{{paciente_nome}}')
      expect(tpl).toContain('{{procedimento}}')
      expect(tpl).toContain('{{data}}')
      expect(tpl).toContain('{{horario}}')
      expect(tpl).toContain('{{dentista}}')
    })
  })

  // ─── validateTemplate ────────────────────────────────────────────────

  describe('validateTemplate', () => {
    it('accepts valid template', () => {
      const result = validateTemplate('Olá {{paciente_nome}}, consulta {{data}} às {{horario}}')
      expect(result.valid).toBe(true)
    })

    it('rejects unsupported placeholder', () => {
      const result = validateTemplate('Olá {{invalid_placeholder}}')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('invalid_placeholder'))).toBe(true)
    })

    it('rejects invalid placeholder pattern', () => {
      // Unsupported placeholder name — regex captures it, validation rejects
      const result = validateTemplate('Olá {{unknown_field}}')
      expect(result.valid).toBe(false)
    })
  })

  // ─── replacePlaceholders ─────────────────────────────────────────────

  describe('replacePlaceholders', () => {
    it('replaces all placeholders', () => {
      const result = replacePlaceholders('Olá {{paciente_nome}} às {{horario}}', {
        paciente_nome: 'João',
        horario: '14:00',
      })
      expect(result).toContain('João')
      expect(result).toContain('14:00')
      expect(result).not.toContain('{{')
    })

    it('preserves unmatched placeholders', () => {
      const result = replacePlaceholders('{{paciente_nome}} e {{dentista}}', {
        paciente_nome: 'Maria',
      })
      expect(result).toContain('Maria')
      expect(result).toContain('{{dentista}}')
    })
  })

  // ─── getProcedureReminderConfig ──────────────────────────────────────

  describe('getProcedureReminderConfig', () => {
    it('returns config when found', async () => {
      seed([{
        id: 'cfg-1', clinicId: 'c1', procedureTypeId: 'pt1',
        hoursBefore: 48, messageTemplate: 'tpl', enabled: true,
        createdAt: new Date(), updatedAt: new Date(),
      }])

      const config = await getProcedureReminderConfig('c1', 'pt1')
      expect(config).not.toBeNull()
      expect(config!.procedure_type_id).toBe('pt1')
      expect(config!.hours_before).toBe(48)
    })

    it('returns null when not found', async () => {
      seed([])
      const config = await getProcedureReminderConfig('c1', 'pt-missing')
      expect(config).toBeNull()
    })
  })

  // ─── getAllProcedureReminderConfigs ──────────────────────────────────

  describe('getAllProcedureReminderConfigs', () => {
    it('returns all configs for clinic', async () => {
      seed([
        { id: 'c1', clinicId: 'clinic-a', procedureTypeId: 'pt1', hoursBefore: 24, messageTemplate: 't1', enabled: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'c2', clinicId: 'clinic-a', procedureTypeId: 'pt2', hoursBefore: 48, messageTemplate: 't2', enabled: false, createdAt: new Date(), updatedAt: new Date() },
      ])

      const configs = await getAllProcedureReminderConfigs('clinic-a')
      expect(configs).toHaveLength(2)
      expect(configs[0].hours_before).toBe(24)
      expect(configs[1].enabled).toBe(false)
    })

    it('returns empty array on error', async () => {
      seed([])
      const configs = await getAllProcedureReminderConfigs('nonexistent')
      expect(configs).toEqual([])
    })
  })

  // ─── saveProcedureReminderConfig ─────────────────────────────────────

  describe('saveProcedureReminderConfig', () => {
    it('inserts and returns new config', async () => {
      // Mock insert chain
      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              id: 'new-cfg', clinicId: 'c1', procedureTypeId: 'pt1',
              hoursBefore: 48, messageTemplate: 'tpl', enabled: true,
              createdAt: new Date(), updatedAt: new Date(),
            }]),
          }),
        }),
      })

      const result = await saveProcedureReminderConfig('c1', {
        procedure_type_id: 'pt1',
        procedure_type_name: 'Consulta',
        hours_before: 48,
        message_template: 'tpl',
        enabled: true,
      })

      expect(result.success).toBe(true)
      expect(result.config!.procedure_type_id).toBe('pt1')
    })

    it('returns error on failure', async () => {
      mdb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockReturnValue({
            returning: jest.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
      })

      const result = await saveProcedureReminderConfig('c1', {
        procedure_type_id: 'pt1',
        procedure_type_name: 'Consulta',
        hours_before: 48,
        message_template: 'tpl',
        enabled: true,
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── getProcedureTypes ───────────────────────────────────────────────

  describe('getProcedureTypes', () => {
    it('returns all procedure types ordered by name', async () => {
      seed([
        { id: 'pt1', name: 'Check-up' },
        { id: 'pt2', name: 'Consulta' },
        { id: 'pt3', name: 'Cirurgia' },
      ])

      const types = await getProcedureTypes('c1')
      expect(types).toHaveLength(3)
      expect(types[0].name).toBe('Check-up')
    })

    it('returns empty array on error', async () => {
      seed([])
      const types = await getProcedureTypes('c1')
      expect(types).toEqual([])
    })
  })

  // ─── getEffectiveConfig ──────────────────────────────────────────────

  describe('getEffectiveConfig', () => {
    it('returns custom config when found', async () => {
      seed([{
        id: 'cfg-custom', clinicId: 'c1', procedureTypeId: 'pt1',
        hoursBefore: 72, messageTemplate: 'custom tpl', enabled: true,
        createdAt: new Date(), updatedAt: new Date(),
      }])

      const config = await getEffectiveConfig('c1', 'pt1', 'consulta')
      expect(config.hours_before).toBe(72)
      expect(config.message_template).toBe('custom tpl')
    })

    it('returns default config when no custom found', async () => {
      seed([])

      const config = await getEffectiveConfig('c1', 'pt2', 'consulta')
      expect(config.hours_before).toBe(48) // D-05 default for consulta
      expect(config.message_template).toContain('{{paciente_nome}}')
    })
  })
})
