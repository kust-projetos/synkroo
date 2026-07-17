/** Tests for budgets/accept + budgets/reject routes — financeiro legacy adapter */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })) }))
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudget: jest.fn(),
  acceptBudget: jest.fn(),
  rejectBudget: jest.fn(),
}))
jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  updateBudget: jest.fn(),
}))

const { getBudget, acceptBudget, rejectBudget } = require('@/modules/financeiro/services/budget-service')
const { updateBudget: repoUpdateBudget } = require('@/modules/financeiro/repositories/financeiro-repository')

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
}
beforeEach(() => { jest.clearAllMocks() })

const mkBudget = (o: any = {}) => ({ id: 'b1', clinicId: 'c1', status: 'sent', valid_until: '2099-12-31', ...o })

import { NextRequest } from 'next/server'

describe('budgets/accept', () => {
  const { POST } = require('../../../../app/api/budgets/[id]/accept/route')
  it('returns 401', async () => {
    authFail()
    const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(r.status).toBe(401)
  })
  it('returns 404', async () => {
    authOk()
    ;(getBudget as jest.Mock).mockResolvedValue(undefined)
    const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(r.status).toBe(404)
  })
  it('accepts budget', async () => {
    authOk()
    ;(getBudget as jest.Mock).mockResolvedValue(mkBudget())
    ;(acceptBudget as jest.Mock).mockResolvedValue(mkBudget({ status: 'accepted' }))
    const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) })
    const b = await r.json()
    expect(b.message).toContain('accepted')
  })
})

describe('budgets/reject', () => {
  const { POST } = require('../../../../app/api/budgets/[id]/reject/route')
  it('returns 401', async () => {
    authFail()
    const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(r.status).toBe(401)
  })
  it('returns 404', async () => {
    authOk()
    ;(getBudget as jest.Mock).mockResolvedValue(undefined)
    const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(r.status).toBe(404)
  })
  it('rejects budget', async () => {
    authOk()
    ;(getBudget as jest.Mock).mockResolvedValue(mkBudget())
    ;(rejectBudget as jest.Mock).mockResolvedValue(mkBudget({ status: 'rejected' }))
    const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'b1' }) })
    const b = await r.json()
    expect(b.message).toContain('rejected')
  })
})
