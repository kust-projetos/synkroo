/** Tests for knowledge root route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/services/rag', () => ({ ragService: { addKnowledgeEntry: jest.fn() } }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })), DatabaseError: class extends Error { constructor(msg: string, cause: any) { super(msg) } } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }), limit: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
const mk = (o: any = {}) => ({ id: 'k1', clinicId: 'c1', category: 'faq', question: 'Q', answer: 'A', keywords: [], isActive: true, createdAt: new Date(), updatedAt: new Date(), ...o })
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET, POST } from '../../../../app/api/knowledge/route'
const { ragService } = require('@/services/rag')

describe('knowledge/route', () => {
  describe('GET', () => {
    it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(401) })
    it('lists entries', async () => { authOk(); seed([mk(), mk({ id: 'k2' })]); const r = await GET(new NextRequest('http://localhost')); const b = await r.json(); expect(b.data).toHaveLength(2) })
    it('filters by category', async () => { authOk(); seed([mk()]); const r = await GET(new NextRequest('http://localhost?category=faq')); const b = await r.json(); expect(b.data).toHaveLength(1) })
    it('filters by search', async () => { authOk(); seed([mk()]); const r = await GET(new NextRequest('http://localhost?search=test')); const b = await r.json(); expect(b.data).toHaveLength(1) })
  })
  describe('POST', () => {
    it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(401) })
    it('returns 400 for missing fields', async () => { authOk(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(400) })
    it('creates entry', async () => { authOk(); ragService.addKnowledgeEntry.mockResolvedValue('k-new'); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ category: 'faq', question: 'Q', answer: 'A' }) })); const b = await r.json(); expect(b.success).toBe(true); expect(b.id).toBe('k-new') })
  })
})
