/** Tests for Consents Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  insert: jest.fn(function (this: any) { return this }),
  values: jest.fn(function (this: any) { return this }),
  onConflictDoUpdate: jest.fn(function (this: any) { return this }),
  returning: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }),
  set: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }

import { getConsentsForContact, grantConsent, revokeConsent } from '../consents.service'

beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

const mk = (overrides: any = {}) => ({ id: 'c1', clinicId: 'clinic-123', contactId: 'p1', contactType: 'patient', purpose: 'marketing', granted: true, grantedAt: new Date(), revokedAt: null, channel: 'web', notes: null, createdAt: new Date(), updatedAt: new Date(), ...overrides })

describe('Consents Service', () => {
  describe('getConsentsForContact', () => {
    it('returns consents', async () => { seed([mk(), mk({ id: 'c2' })]); const r = await getConsentsForContact('clinic-123', 'p1', 'patient'); expect(r).toHaveLength(2) })
    it('returns empty', async () => { seed([]); const r = await getConsentsForContact('clinic-123', 'p1', 'patient'); expect(r).toEqual([]) })
  })
  describe('grantConsent', () => {
    it('grants and returns', async () => { seed([mk({ purpose: 'whatsapp_communication' })]); const r = await grantConsent('clinic-123', { contact_id: 'p1', contact_type: 'patient', purpose: 'whatsapp_communication' }); expect(r.granted).toBe(true) })
  })
  describe('revokeConsent', () => {
    it('revokes and returns', async () => { seed([mk({ granted: false, revokedAt: new Date() })]); const r = await revokeConsent('clinic-123', 'p1', 'patient', 'marketing'); expect(r.granted).toBe(false) })
  })
})
