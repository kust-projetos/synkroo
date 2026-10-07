/**
 * P1A-SOFT-CAST — guards de status do domínio operacional (appointments).
 *
 * (1) parseAppointmentStatus/isAppointmentStatus rejeitam lixo de borda;
 * (2) findByClinicWithJoins falha fechado em status inválido SEM tocar o DB.
 */
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb), closeDb: jest.fn() }))

import {
  APPOINTMENT_STATUSES,
  isAppointmentStatus,
  parseAppointmentStatus,
  findByClinicWithJoins,
} from '../appointments-repository'

class Query {
  from() { return this }
  where() { return this }
  orderBy() { return this }
  limit() { return this }
  offset() { return this }
  then(onFulfilled: (v: any) => any) {
    return Promise.resolve(onFulfilled([{ count: 2 }]))
  }
}

const mockDb = {
  select: jest.fn(() => new Query()),
  insert: jest.fn(),
  update: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('appointment status guards', () => {
  it('expõe os 6 status do enum appointment_status', () => {
    expect([...APPOINTMENT_STATUSES].sort()).toEqual(
      ['cancelled', 'completed', 'confirmed', 'in_progress', 'no_show', 'scheduled'].sort(),
    )
  })

  it.each(APPOINTMENT_STATUSES)('aceita status válido %s', (s) => {
    expect(isAppointmentStatus(s)).toBe(true)
    expect(parseAppointmentStatus(s)).toBe(s)
  })

  it.each(['foo', '', 'CONFIRMED', 'scheduled ', null, undefined, 123, 'proposal_sent'])(
    'rejeita status inválido %p',
    (v) => {
      expect(isAppointmentStatus(v)).toBe(false)
      expect(() => parseAppointmentStatus(v)).toThrow(/Invalid appointment status/)
    },
  )

  it('findByClinicWithJoins rejeita status inválido sem consultar o banco', async () => {
    await expect(
      findByClinicWithJoins('clinic-1', { status: 'deleted', count: true }),
    ).rejects.toThrow(/Invalid appointment status/)
    // Fail-closed antes de qualquer SQL: nenhum select foi construído.
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('findByClinicWithJoins aceita status válido (count)', async () => {
    await expect(
      findByClinicWithJoins('clinic-1', { status: 'confirmed', count: true }),
    ).resolves.toBe(2)
    expect(mockDb.select).toHaveBeenCalled()
  })
})
