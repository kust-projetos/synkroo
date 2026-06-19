const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }),
  leftJoin: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })
function seed(...s: any[][]) { counter = 0; results = s }
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET } from '../../../../app/api/leads/kanban/route'

describe('leads/kanban', () => {
  it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(401) })
  it('returns kanban leads', async () => {
    authOk()
    seed([
      { leads: { id: 'l1', name: 'A', phone: null, email: null, source: null, temperature: 'hot', score: 90, stageId: 's1', interest: null, lastContactAt: null, createdAt: new Date(), updatedAt: new Date() }, pipeline_stages: { id: 's1', name: 'Novo', color: '#3B82F6', position: 1 } },
      { leads: { id: 'l2', name: 'B', phone: null, email: null, source: null, temperature: 'cold', score: 30, stageId: 's2', interest: null, lastContactAt: null, createdAt: new Date(), updatedAt: new Date() }, pipeline_stages: { id: 's2', name: 'Qualificado', color: '#10B981', position: 2 } },
    ])
    const r = await GET(new NextRequest('http://localhost')); const b = await r.json(); expect(b.leads).toHaveLength(2)
  })
  it('filters by stage', async () => {
    authOk(); seed([{ leads: { id: 'l1', name: 'A', phone: null, email: null, source: null, temperature: 'hot', score: 90, stageId: 's1', interest: null, lastContactAt: null, createdAt: new Date(), updatedAt: new Date() }, pipeline_stages: { id: 's1', name: 'Novo', color: '#3B82F6', position: 1 } }])
    const r = await GET(new NextRequest('http://localhost?stage_id=s1')); const b = await r.json(); expect(b.leads).toHaveLength(1)
  })
})
