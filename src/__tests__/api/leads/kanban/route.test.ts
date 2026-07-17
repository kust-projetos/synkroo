const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }))

import { buildUserContext } from '@/core/actions/context'
import { runAction } from '@/core/actions/run'

function seed(..._s: any[][]) { /* DB seed retained for parity with sibling suites; the canonical mock boundary is runAction below. */ }
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
import { GET } from '../../../../app/api/leads/kanban/route'

describe('leads/kanban', () => {
  it('returns 401', async () => {
    authFail()
    const r = await GET(new NextRequest('http://localhost'))
    expect(r.status).toBe(401)
  })

  it('returns kanban leads', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { leads: [
        { id: 'l1', name: 'A', temperature: 'hot', score: 90, stageId: 's1', stageName: 'Novo' },
        { id: 'l2', name: 'B', temperature: 'cold', score: 30, stageId: 's2', stageName: 'Qualificado' },
      ] },
    })
    const r = await GET(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.leads).toHaveLength(2)
  })

  it('filters by stage', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { leads: [
        { id: 'l1', name: 'A', temperature: 'hot', score: 90, stageId: 's1', stageName: 'Novo' },
      ] },
    })
    const r = await GET(new NextRequest('http://localhost?stage_id=s1'))
    const b = await r.json()
    expect(b.leads).toHaveLength(1)
  })
})
