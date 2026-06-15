/** Tests for GET /api/contacts/[id]/appointments — Drizzle mocks */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })) }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  leftJoin: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })

const mkApt = (over: any = {}) => ({ id: 'a1', scheduledAt: new Date(), status: 'confirmed', notes: null, durationMinutes: 30, patientName: 'João', dentistName: 'Dra. Maria', procedureName: 'Limpeza', ...over })

import { NextRequest } from 'next/server'
import { GET } from '../../../../app/api/contacts/[id]/appointments/route'

describe('GET /api/contacts/[id]/appointments', () => {
  it('returns 401 when not authenticated', async () => {
    authFail()
    const r = await GET(new NextRequest('http://localhost/api/contacts/p1/appointments'), { params: Promise.resolve({ id: 'p1' }) })
    expect(r.status).toBe(401)
  })

  it('returns appointments for contact', async () => {
    authOk(); seed([mkApt(), mkApt({ id: 'a2' })])
    const r = await GET(new NextRequest('http://localhost/api/contacts/p1/appointments'), { params: Promise.resolve({ id: 'p1' }) })
    const body = await r.json()
    expect(r.status).toBe(200)
    expect(body.appointments).toHaveLength(2)
  })

  it('returns empty list when no appointments', async () => {
    authOk(); seed([])
    const r = await GET(new NextRequest('http://localhost/api/contacts/p1/appointments'), { params: Promise.resolve({ id: 'p1' }) })
    const body = await r.json()
    expect(body.appointments).toEqual([])
  })
})
