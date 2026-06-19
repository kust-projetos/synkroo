const mockValidateApiAuth = jest.fn()
const mockHasRequiredRole = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth, hasRequiredRole: mockHasRequiredRole }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })), ValidationError: class extends Error { constructor(msg: string, c?: any) { super(msg) } } }))
jest.mock('@/lib/validations', () => ({ updateCampaignSchema: { parse: jest.fn((b: any) => b) } }))
jest.mock('@/repositories/campaigns', () => ({ getCampaignById: jest.fn(), updateCampaign: jest.fn(), deleteCampaign: jest.fn() }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  leftJoin: jest.fn(function (this: any) { return this }), groupBy: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })
function seed(...s: any[][]) { counter = 0; results = s }
const { getCampaignById } = require('@/repositories/campaigns')
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', id: 'u1', role: 'admin' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET } from '../../../../app/api/campaigns/[id]/route'

describe('campaigns/[id]', () => {
  it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(401) })
})
