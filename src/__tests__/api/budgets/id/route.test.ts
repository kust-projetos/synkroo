/** Tests for budgets/[id]/route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
import { buildUserContext } from '@/core/actions/context'
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => { console.error('handleApiError called with:', e?.message || e); return new Response(JSON.stringify({ error: 'Internal' }), { status: 500 }) }), ValidationError: class extends Error { constructor(msg: string, ctx?: any) { super(msg) } } }))
jest.mock('@/lib/validations', () => ({ updateBudgetSchema: { parse: jest.fn((b: any) => b) } }))
jest.mock('@/services/budgets/budget.service', () => ({ getBudgetById: jest.fn(), deleteBudget: jest.fn() }))

const { getBudgetById, deleteBudget } = require('@/services/budgets/budget.service')
const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', id: 'u1', role: 'admin' } })
  ;(buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user', clinicId: 'c1', user: { id: 'u1', email: 'u@x.com', name: 'U' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' },
  })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
  ;(buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'))
}

// DB mock setup
let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (t: any) { return this }), from: jest.fn(function (t: any) { return this }),
  where: jest.fn(function (c: any) { return this }), orderBy: jest.fn(function (c: any) { return this }), limit: jest.fn(function (n: any) { return this }),
  insert: jest.fn(function (t: any) { return this }), values: jest.fn(function (v: any) { return this }), returning: jest.fn(function (c: any) { return this }),
  update: jest.fn(function (t: any) { return this }), set: jest.fn(function (s: any) { return this }),
  delete: jest.fn(function (t: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks(); mdb.set.mockClear(); mdb.where.mockClear(); mdb.update.mockClear(); mdb.returning.mockClear(); mdb.then.mockClear() })

const mkBudget = (o: any = {}) => ({ id: 'b1', clinic_id: 'c1', patient_id: 'p1', title: 'Test', status: 'sent', total_value: 1000, final_value: 1000, discount_value: '0', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...o })

import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../../../../app/api/budgets/[id]/route'

describe('budgets/[id]', () => {
  describe('GET', () => {
    it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(401) })
    it('returns budget', async () => { authOk(); getBudgetById.mockResolvedValue(mkBudget()); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) }); const b = await r.json(); expect(b.budget.id).toBe('b1') })
    it('returns 404', async () => { authOk(); getBudgetById.mockResolvedValue(null); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(404) })
  })
  describe('PUT', () => {
    it('returns 401', async () => { authFail(); const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(401) })
    it('updates budget and returns 200', async () => {
      authOk(); getBudgetById.mockResolvedValue(mkBudget())
      seed([{ id: 'b1', clinicId: 'c1', patientId: 'p1', title: 'Test', status: 'accepted', totalValue: '1000', finalValue: '1000', discountValue: '0', createdAt: new Date(), updatedAt: new Date() }])
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({ status: 'accepted' }) }), { params: Promise.resolve({ id: 'b1' }) })
      if (r.status !== 200) { const body = await r.json(); throw new Error(`PUT returned ${r.status}: ${JSON.stringify(body)}`) }
      const b = await r.json(); expect(b.budget.status).toBe('accepted')
    })
  })
  describe('DELETE', () => {
    it('returns 401', async () => { authFail(); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(401) })
    it('deletes budget', async () => { authOk(); getBudgetById.mockResolvedValue(mkBudget()); deleteBudget.mockResolvedValue(true); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) }); const b = await r.json(); expect(b.success).toBe(true) })
  })
})
