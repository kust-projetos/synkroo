/** Tests for Values Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }))
let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  insert: jest.fn(function (this: any) { return this }), values: jest.fn(function (this: any) { return this }), onConflictDoUpdate: jest.fn(function (this: any) { return this }), returning: jest.fn(function (this: any) { return this }),
  delete: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })
function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { getValuesForContact, upsertValues, searchByCustomField, deleteValuesForContact } from '../values.service'

const mkVal = (over: any = {}) => ({ id: 'v1', clinicId: 'c1', contactId: 'p1', contactType: 'patient', definitionId: 'd1', valueText: 'test', valueNumber: null, valueDate: null, valueBoolean: null, valueJson: null, createdAt: new Date(), updatedAt: new Date(), ...over })

describe('Values Service', () => {
  it('getValuesForContact', async () => { seed([mkVal(), mkVal({ id: 'v2' })]); const r = await getValuesForContact('c1', 'p1', 'patient'); expect(r).toHaveLength(2) })
  it('upsertValues empty', async () => { const r = await upsertValues('c1', 'p1', 'patient', []); expect(r).toEqual([]) })
  it('upsertValues with definition', async () => { seed([{ fieldType: 'text' }], [mkVal()]); const r = await upsertValues('c1', 'p1', 'patient', [{ definition_id: 'd1', value: 'hello' }]); expect(r).toHaveLength(1) })
  it('searchByCustomField', async () => { seed([{ fieldType: 'text' }], [{ contactId: 'p1' }, { contactId: 'p2' }]); const r = await searchByCustomField('c1', 'd1', 'x'); expect(r).toEqual(['p1', 'p2']) })
  it('deleteValuesForContact', async () => { seed(); await expect(deleteValuesForContact('c1', 'p1', 'patient')).resolves.toBeUndefined() })
})
