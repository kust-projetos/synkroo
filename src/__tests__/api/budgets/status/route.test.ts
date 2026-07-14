/** Tests for budgets/accept + reject routes */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
import { buildUserContext } from '@/core/actions/context'
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })) }))
jest.mock('@/services/budgets/budget.service', () => ({ getBudgetById: jest.fn(), acceptBudget: jest.fn(), rejectBudget: jest.fn() }))

let results: any[][] = [], counter = 0
const mdb = {
  update: jest.fn(function (this: any) { return this }), set: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
const { getBudgetById, acceptBudget, rejectBudget } = require('@/services/budgets/budget.service')
const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
  ;(buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user', clinicId: 'c1', user: { id: 'u1', email: 'u@x.com', name: 'U' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' },
  })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
  ;(buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'))
}
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

const mkBudget = (o: any = {}) => ({ id: 'b1', clinic_id: 'c1', status: 'sent', valid_until: '2099-12-31', ...o })

import { NextRequest } from 'next/server'

describe('budgets/accept', () => {
  const { POST } = require('../../../../app/api/budgets/[id]/accept/route')
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(401) })
  it('returns 404', async () => { authOk(); getBudgetById.mockResolvedValue(null); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(404) })
  it('accepts budget', async () => { authOk(); getBudgetById.mockResolvedValue(mkBudget()); acceptBudget.mockResolvedValue(mkBudget({ status: 'accepted' })); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) }); const b = await r.json(); expect(b.message).toContain('accepted') })
})

describe('budgets/reject', () => {
  const { POST } = require('../../../../app/api/budgets/[id]/reject/route')
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(401) })
  it('returns 404', async () => { authOk(); getBudgetById.mockResolvedValue(null); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) }); expect(r.status).toBe(404) })
  it('rejects budget', async () => { authOk(); getBudgetById.mockResolvedValue(mkBudget()); rejectBudget.mockResolvedValue(mkBudget({ status: 'rejected' })); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) }); const b = await r.json(); expect(b.message).toContain('rejected') })
})
