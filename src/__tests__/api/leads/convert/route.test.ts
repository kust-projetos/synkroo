/** Tests for leads/[id]/convert route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }))

import { buildUserContext } from '@/core/actions/context'
import { runAction } from '@/core/actions/run'

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
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/leads/[id]/convert/route'

describe('leads/[id]/convert', () => {
  it('returns 401', async () => {
    authFail()
    const r = await POST(
      new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    expect(r.status).toBe(401)
  })

  it('returns 422 for missing patient_id (invalid_input contract)', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: 'invalid_input', message: 'patient_id is required' },
    })
    const r = await POST(
      new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    expect(r.status).toBe(422)
  })

  it('converts successfully', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { success: true },
    })
    const r = await POST(
      new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ patient_id: 'p1' }) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    const b = await r.json()
    expect(b.success).toBe(true)
  })

  it('returns 500 on internal failure', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: 'internal', message: 'conversion failed' },
    })
    const r = await POST(
      new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ patient_id: 'p1' }) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    expect(r.status).toBe(500)
  })
})
