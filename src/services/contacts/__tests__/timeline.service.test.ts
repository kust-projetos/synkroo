/** Tests for Timeline Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  limit: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { getContactTimeline } from '../timeline.service'

const now = new Date()

describe('Timeline Service', () => {
  describe('getContactTimeline — patient', () => {
    it('returns appointments + observations + messages', async () => {
      seed(
        [{ id: 'a1', status: 'confirmed', scheduledAt: now, dentistId: null, createdAt: now, title: 'Consulta' }],
        [{ id: 'c1' }],
        [{ id: 'm1', conversationId: 'c1', content: 'Olá', direction: 'inbound', messageType: 'text', createdAt: now }],
        [{ id: 'o1', content: 'Nota', createdBy: 'u1', createdAt: now }],
      )
      const r = await getContactTimeline('c1', 'p1', 'patient')
      expect(r.events.length).toBeGreaterThanOrEqual(3)
    })

    it('returns empty when no data', async () => {
      seed([], [], [], [])
      const r = await getContactTimeline('c1', 'p1', 'patient')
      expect(r.events).toEqual([])
      expect(r.next_cursor).toBeNull()
    })

    it('sorts by event_timestamp desc', async () => {
      const t1 = new Date('2026-01-01')
      const t2 = new Date('2026-03-01')
      seed(
        [{ id: 'a1', status: 'confirmed', scheduledAt: t1, dentistId: null, createdAt: t1, title: 'Old' }, { id: 'a2', status: 'confirmed', scheduledAt: t2, dentistId: null, createdAt: t2, title: 'New' }],
        [],
        [],
        [],
      )
      const r = await getContactTimeline('c1', 'p1', 'patient')
      expect(r.events[0].id).toBe('a2')
    })
  })

  describe('getContactTimeline — lead', () => {
    it('returns activities + linked patient events', async () => {
      seed(
        [{ id: 'act1', leadId: 'l1', activityType: 'call', description: 'Ligação', performedAt: now, metadata: {}, createdAt: now }],
        [],
        [{ patientId: 'p1' }],
        [{ id: 'a1', status: 'done', scheduledAt: now, dentistId: 'd1', createdAt: now, title: 'Appt' }],
        [{ id: 'o1', content: 'Obs', createdBy: 'u1', createdAt: now }],
      )
      const r = await getContactTimeline('c1', 'l1', 'lead')
      expect(r.events.length).toBeGreaterThanOrEqual(3)
    })

    it('returns empty for lead with no data', async () => {
      seed([], [], [], [])
      const r = await getContactTimeline('c1', 'l1', 'lead')
      expect(r.events).toEqual([])
    })
  })
})
