import { formatReminderMessage, DEFAULT_REMINDER_CONFIGS, AppointmentReminder, getAppointmentsNeedingReminders } from '../reminder.service'

// ─── Pure function tests (no DB) ───
describe('ReminderService (pure)', () => {
  const mockReminder: AppointmentReminder = {
    appointmentId: 'apt-123', patientId: 'pat-456', patientName: 'João Silva', patientPhone: '11999999999',
    scheduledAt: new Date('2026-03-29T14:00:00'), dentistName: 'Dra. Maria', procedureName: 'Limpeza',
    clinicId: 'clinic-123', clinicName: 'Clínica Sorriso', clinicPhone: '1133333333',
  }
  describe('DEFAULT_REMINDER_CONFIGS', () => {
    it('has 24h and 2h', () => { expect(DEFAULT_REMINDER_CONFIGS).toHaveLength(2) })
  })
  describe('formatReminderMessage', () => {
    it('formats 24h', () => { expect(formatReminderMessage(mockReminder, 24)).toContain('João Silva') })
    it('formats 2h', () => { expect(formatReminderMessage(mockReminder, 2)).toContain('2 horas') })
  })
})

// ─── DB-dependent tests with Drizzle mock ───
jest.mock('@/lib/db/client', () => {
  let results: any[][] = [], counter = 0
  const mdb = {
    select: jest.fn(function (this: any) { return this }),
    from: jest.fn(function (this: any) { return this }),
    innerJoin: jest.fn(function (this: any) { return this }),
    leftJoin: jest.fn(function (this: any) { return this }),
    where: jest.fn(function (this: any) { return this }),
    then: jest.fn(function (this: any, onF: any) {
      const d = results[counter++] ?? results[results.length - 1] ?? []
      return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
    }),
  } as any
  return { getDb: jest.fn(() => mdb), __seed: (...s: any[][]) => { counter = 0; results = s }, __reset: () => { counter = 0; results = [] } }
})

const { __seed, __reset } = require('@/lib/db/client') as any
beforeEach(() => { __reset() })

const future = new Date(Date.now() + 25 * 3600000)
const mk = (id: string) => ({ id, scheduledAt: future, clinicId: 'c1', clinicName: 'C1', clinicPhone: '11', patientId: 'p1', patientName: 'João', patientPhone: '119', dentistName: 'Dr(a). A', procedureId: 'proc1', procedureName: 'Limpeza' })

describe('getAppointmentsNeedingReminders (DB)', () => {
  it('returns appointments in window', async () => { __seed([mk('a1')], []); const r = await getAppointmentsNeedingReminders(24); expect(r).toHaveLength(1) })
  it('excludes already-sent', async () => { __seed([mk('a1')], [{ appointmentId: 'a1' }]); const r = await getAppointmentsNeedingReminders(24); expect(r).toHaveLength(0) })
  it('handles 2h (confirmed only)', async () => { __seed([mk('a1')], []); const r = await getAppointmentsNeedingReminders(2); expect(r).toHaveLength(1) })
  it('returns empty for no data', async () => { __seed([], []); const r = await getAppointmentsNeedingReminders(24); expect(r).toEqual([]) })
})
