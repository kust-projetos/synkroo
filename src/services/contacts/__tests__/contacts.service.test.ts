/** Tests for Contacts Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }) }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  offset: jest.fn(function (this: any) { return this }),
  limit: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  insert: jest.fn(function (this: any) { return this }),
  values: jest.fn(function (this: any) { return this }),
  returning: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }),
  set: jest.fn(function (this: any) { return this }),
  leftJoin: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { searchContacts, getContactById, createContact, getContactNotes, addContactNote } from '../contacts.service'

const mkPatient = (over: any = {}) => ({ id: 'p1', clinicId: 'c1', name: 'João', phone: '119', email: null, cpf: null, birthDate: null, tags: [], status: 'active', notes: null, createdAt: new Date(), updatedAt: new Date(), ...over })
const mkLead = (over: any = {}) => ({ id: 'l1', clinicId: 'c1', name: 'Maria', phone: '119', email: null, source: null, interest: null, tags: [], status: 'new', stageId: null, score: null, temperature: null, patientId: null, notes: null, createdAt: new Date(), updatedAt: new Date(), ...over })

describe('Contacts Service', () => {
  describe('searchContacts', () => {
    it('searches patients', async () => { seed([mkPatient()], []); const r = await searchContacts('c1', { type: 'patient' }); expect(r.data).toHaveLength(1) })
    it('searches leads', async () => { seed([mkLead()]); const r = await searchContacts('c1', { type: 'lead' }); expect(r.data).toHaveLength(1) })
    it('returns empty', async () => { seed([], []); const r = await searchContacts('c1'); expect(r.data).toEqual([]) })
  })
  describe('getContactById', () => {
    it('gets patient', async () => { seed([mkPatient()]); const r = await getContactById('c1', 'p1', 'patient'); expect(r?.name).toBe('João') })
    it('returns null for missing', async () => { seed([]); const r = await getContactById('c1', 'x', 'patient'); expect(r).toBeNull() })
  })
  describe('createContact', () => {
    it('creates patient', async () => { seed([mkPatient()]); const r = await createContact('c1', { type: 'patient', name: 'João', phone: '119' } as any); expect(r.name).toBe('João') })
    it('creates lead', async () => { seed([{ id: 's1' }], [mkLead()]); const r = await createContact('c1', { type: 'lead', name: 'Maria', phone: '119' } as any); expect(r.name).toBe('Maria') })
  })
  describe('getContactNotes', () => {
    it('gets lead notes', async () => { seed([{ id: 'a1', leadId: 'l1', activityType: 'note', description: 'Test', performedAt: new Date(), performedBy: 'u1' }]); const r = await getContactNotes('c1', 'l1', 'lead'); expect(r).toHaveLength(1) })
    it('gets patient notes', async () => { seed([{ id: 'o1', patientId: 'p1', clinicId: 'c1', content: 'Obs', createdAt: new Date(), createdBy: 'u1' }]); const r = await getContactNotes('c1', 'p1', 'patient'); expect(r).toHaveLength(1) })
  })
  describe('addContactNote', () => {
    it('adds lead note', async () => { seed([{ id: 'a1', leadId: 'l1', activityType: 'note', description: 'Note', performedAt: new Date(), performedBy: 'user-1' }]); const r = await addContactNote('c1', 'l1', 'lead', 'Note'); expect(r.contact_id).toBe('l1') })
    it('adds patient note', async () => { seed([{ id: 'o1', patientId: 'p1', clinicId: 'c1', content: 'Note', createdAt: new Date(), createdBy: 'user-1' }]); const r = await addContactNote('c1', 'p1', 'patient', 'Note'); expect(r.contact_id).toBe('p1') })
  })
})
