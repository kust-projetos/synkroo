/**
 * LGPD Anonymize Route — behavioral tests (with audit log)
 */

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}))

import { validateApiAuth } from '@/lib/auth/session'

let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => {
      const result = queryResults[queryIndex++] ?? queryResults[queryResults.length - 1] ?? []
      return resolve(result)
    }),
  }
  return chain
}

let mdb = createMockDb()

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mdb),
}))

import { POST } from '@/app/api/lgpd/anonymize/route'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

function mockAuth(clinicId = 'c1', success = true) {
  ;(validateApiAuth as jest.Mock).mockResolvedValue(
    success
      ? { success: true, profile: { id: 'user-1', clinic_id: clinicId, is_active: true } }
      : { success: false, error: { message: 'Unauthorized', status: 401 } },
  )
}

function mockReq(body: any, headers: Record<string, string> = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: new Map(Object.entries(headers)),
  } as any
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
  mdb.set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
  mdb.update = jest.fn().mockReturnValue({ set: mdb.set })
  mdb.values = jest.fn().mockResolvedValue(undefined)
  mdb.insert = jest.fn().mockReturnValue({ values: mdb.values })
})

describe('POST /api/lgpd/anonymize', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth('c1', false)
    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when patientId is missing', async () => {
    mockAuth('c1')
    const res = await POST(mockReq({}))
    expect(res.status).toBe(400)
  })

  it('captures snapshot and inserts audit log', async () => {
    mockAuth('c1')
    seed([{
      id: 'p1', name: 'João', phone: '123', email: 'j@j.com',
      cpf: '111.222.333-44', birthDate: '1990-01-01', clinicId: 'c1',
    }])

    const res = await POST(mockReq(
      { patientId: 'p1' },
      { 'x-forwarded-for': '10.0.0.1', 'user-agent': 'TestAgent/1.0' },
    ))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.auditId).toBeDefined()

    // Verify audit log insert was called
    expect(mdb.insert).toHaveBeenCalled()
    expect(mdb.values).toHaveBeenCalled()
  })

  it('handles missing snapshot gracefully', async () => {
    mockAuth('c1')
    seed([]) // no patient found

    const res = await POST(mockReq({ patientId: 'p-missing' }))
    expect(res.status).toBe(200) // still succeeds, just oldValues = null
  })

  it('returns 500 on DB error', async () => {
    mockAuth('c1')
    seed([{ id: 'p1', name: 'X', clinicId: 'c1' }])
    mdb.update = jest.fn().mockImplementation(() => { throw new Error('DB error') })

    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(500)
  })
})
