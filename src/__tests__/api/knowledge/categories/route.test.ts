/** Tests for knowledge/categories route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })), DatabaseError: class extends Error { constructor(msg: string, cause: any) { super(msg) } } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET } from '../../../../app/api/knowledge/categories/route'

describe('knowledge/categories', () => {
  it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(401) })
  it('returns categories with counts', async () => { authOk(); seed([{ category: 'faq' }, { category: 'faq' }, { category: 'pricing' }]); const r = await GET(new NextRequest('http://localhost')); const b = await r.json(); expect(b.data.categories).toHaveLength(2); expect(b.data.categories[0].count).toBe(2) })
  it('returns empty', async () => { authOk(); seed([]); const r = await GET(new NextRequest('http://localhost')); const b = await r.json(); expect(b.data.categories).toEqual([]) })
})
