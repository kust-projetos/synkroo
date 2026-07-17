/** Tests for leads/[id]/stage route */
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
import { PATCH } from '../../../../app/api/leads/[id]/stage/route'

describe('leads/[id]/stage', () => {
  it('returns 401', async () => {
    authFail()
    const r = await PATCH(
      new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    expect(r.status).toBe(401)
  })

  it('returns 422 for missing stage_id (invalid_input contract)', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: 'invalid_input', message: 'stage_id is required' },
    })
    const r = await PATCH(
      new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    expect(r.status).toBe(422)
  })

  it('returns 404 for invalid stage', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: 'not_found', message: 'stage not found' },
    })
    const r = await PATCH(
      new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stage_id: 's1' }) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    expect(r.status).toBe(404)
  })

  it('updates stage', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { lead: { id: 'l1', stageId: 's1' } },
    })
    const r = await PATCH(
      new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stage_id: 's1' }) }),
      { params: Promise.resolve({ id: 'l1' }) },
    )
    const b = await r.json()
    expect(b.lead.stageId).toBe('s1')
  })
})
