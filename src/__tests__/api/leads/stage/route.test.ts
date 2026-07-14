const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
import { buildUserContext } from '@/core/actions/context'

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }), set: jest.fn(function (this: any) { return this }), returning: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
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

import { NextRequest } from 'next/server'
import { PATCH } from '../../../../app/api/leads/[id]/stage/route'

describe('leads/[id]/stage', () => {
  it('returns 401', async () => { authFail(); const r = await PATCH(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(401) })
  it('returns 400 for missing stage_id', async () => { authOk(); const r = await PATCH(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(400) })
  it('returns 404 for invalid stage', async () => { authOk(); seed([]); const r = await PATCH(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stage_id: 's1' }) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(404) })
  it('moves stage successfully', async () => {
    authOk(); seed([{ id: 's1' }], [{ id: 'l1', stageId: 's1', updatedAt: new Date() }])
    const r = await PATCH(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stage_id: 's1' }) }), { params: Promise.resolve({ id: 'l1' }) }); const b = await r.json(); expect(b.data.stage_id).toBe('s1')
  })
})
