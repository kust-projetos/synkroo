import { SALES_TOOLS, getLeadInfoTool } from '../sales.tools'

jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))
let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })
function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

describe('sales.tools', () => {
  it('exports tool array', () => { expect(Array.isArray(SALES_TOOLS)).toBe(true); expect(SALES_TOOLS.length).toBeGreaterThan(0) })
  it('tools have required fields', () => { SALES_TOOLS.forEach(t => { expect(t.name).toBeTruthy(); expect(t.description).toBeTruthy() }) })

  describe('getLeadInfoTool', () => {
    it('returns lead data', async () => {
      seed([{ id: 'l1', name: 'João', phone: '119', email: 'j@j.com', source: 'web', status: 'new', temperature: 'hot', score: 90, interest: null, notes: null, assignedTo: null, lastContactAt: null, nextFollowupAt: null, createdAt: new Date() }])
      const r = await getLeadInfoTool('l1')
      expect(r.success).toBe(true)
      expect(r.data?.name).toBe('João')
      expect(r.data?.score).toBe(90)
    })
    it('returns error when lead not found', async () => {
      seed([])
      const r = await getLeadInfoTool('l1')
      expect(r.success).toBe(false)
      expect(r.error).toContain('não encontrado')
    })
  })
})
