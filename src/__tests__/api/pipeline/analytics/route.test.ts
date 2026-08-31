/** Tests for pipeline/analytics route */
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

import { NextRequest } from 'next/server'
import { GET } from '../../../../app/api/pipeline/analytics/route'

beforeEach(() => { jest.clearAllMocks() })

describe('pipeline/analytics', () => {
  it('returns 401', async () => {
    authFail()
    const r = await GET(new NextRequest('http://localhost'))
    expect(r.status).toBe(401)
  })
  it('returns 422 for invalid/missing action (adapter maps invalid_input to 422)', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: 'invalid_input', message: 'invalid action' },
    })
    const r = await GET(new NextRequest('http://localhost'))
    expect(r.status).toBe(422)
  })
  it('returns conversion_by_stage', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { stages: [{ stageId: 's1', stageName: 'Novo' }] },
    })
    const r = await GET(new NextRequest('http://localhost?action=conversion_by_stage'))
    const b = await r.json()
    expect(b.data.stages).toHaveLength(1)
  })
  it('returns avg_conversion_time', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { avgDays: 5.5 },
    })
    const r = await GET(new NextRequest('http://localhost?action=avg_conversion_time'))
    const b = await r.json()
    expect(b.data.avgDays).toBe(5.5)
  })
  it('returns inactive_patients', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { patients: [{ id: 'p1' }] },
    })
    const r = await GET(new NextRequest('http://localhost?action=inactive_patients'))
    const b = await r.json()
    expect(b.data.patients).toHaveLength(1)
  })
  it('returns upsell_opportunities', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { opportunities: [{ id: 'b1' }] },
    })
    const r = await GET(new NextRequest('http://localhost?action=upsell_opportunities'))
    const b = await r.json()
    expect(b.data.opportunities).toHaveLength(1)
  })
})
