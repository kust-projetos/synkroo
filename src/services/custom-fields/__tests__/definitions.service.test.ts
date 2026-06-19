/** Tests for Definitions Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }))
let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }), limit: jest.fn(function (this: any) { return this }),
  insert: jest.fn(function (this: any) { return this }), values: jest.fn(function (this: any) { return this }), returning: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }), set: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })
function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { getDefinitions, getDefinitionById, createDefinition, deleteDefinition } from '../definitions.service'

const mk = (over: any = {}) => ({ id: 'd1', clinicId: 'c1', name: 'Campo1', fieldType: 'text', options: [], required: false, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...over })

describe('Definitions Service', () => {
  it('getDefinitions returns active', async () => { seed([mk(), mk({ id: 'd2' })]); const r = await getDefinitions('c1'); expect(r).toHaveLength(2) })
  it('getDefinitionById returns single', async () => { seed([mk()]); const r = await getDefinitionById('c1', 'd1'); expect(r?.name).toBe('Campo1') })
  it('getDefinitionById returns null', async () => { seed([]); const r = await getDefinitionById('c1', 'x'); expect(r).toBeNull() })
  it('createDefinition adds', async () => { seed([{ sortOrder: 5 }], [mk()]); const r = await createDefinition('c1', { name: 'X', field_type: 'text' } as any); expect(r.name).toBe('Campo1') })
  it('deleteDefinition deactivates', async () => { seed(); await expect(deleteDefinition('c1', 'd1')).resolves.toBeUndefined() })
})
