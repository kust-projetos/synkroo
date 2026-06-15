/** Tests for knowledge/[id] route — Drizzle mocks */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/services/rag', () => ({ ragService: {}, embeddingService: { generateEmbedding: jest.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] }) } }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })), DatabaseError: class extends Error { constructor(msg: string, cause: any) { super(msg) } } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }), set: jest.fn(function (this: any) { return this }), returning: jest.fn(function (this: any) { return this }),
  delete: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
const mk = (o: any = {}) => ({ id: 'k1', clinicId: 'c1', category: 'faq', question: 'Q', answer: 'A', keywords: [], isActive: true, createdAt: new Date(), updatedAt: new Date(), ...o })

import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../../../../app/api/knowledge/[id]/route'

describe('knowledge/[id]', () => {
  describe('GET', () => {
    it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'k1' }) }); expect(r.status).toBe(401) })
    it('returns entry', async () => { authOk(); seed([mk()]); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'k1' }) }); const b = await r.json(); expect(b.data.id).toBe('k1') })
    it('returns 404', async () => { authOk(); seed([]); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'k1' }) }); expect(r.status).toBe(404) })
  })
  describe('PUT', () => {
    it('returns 401', async () => { authFail(); const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'k1' }) }); expect(r.status).toBe(401) })
    it('updates entry', async () => { authOk(); seed([{ question: 'old', answer: 'old' }], [mk({ question: 'new', answer: 'new' })]); const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({ question: 'new' }) }), { params: Promise.resolve({ id: 'k1' }) }); const b = await r.json(); expect(b.success).toBe(true) })
  })
  describe('DELETE', () => {
    it('returns 401', async () => { authFail(); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'k1' }) }); expect(r.status).toBe(401) })
    it('deletes entry', async () => { authOk(); seed(); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'k1' }) }); const b = await r.json(); expect(b.success).toBe(true) })
  })
})
