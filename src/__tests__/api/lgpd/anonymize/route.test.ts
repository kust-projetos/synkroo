/**
 * LGPD Anonymize Route — behavioral tests
 */

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}))

import { validateApiAuth } from '@/lib/auth/session'

let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
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

function mockAuth(clinicId = 'c1', success = true) {
  ;(validateApiAuth as jest.Mock).mockResolvedValue(
    success
      ? { success: true, profile: { clinic_id: clinicId, is_active: true } }
      : { success: false, error: { message: 'Unauthorized', status: 401 } },
  )
}

function mockReq(body: any) {
  return { json: () => Promise.resolve(body) } as any
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
  // Default: set().where() resolves
  mdb.set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
  mdb.update = jest.fn().mockReturnValue({ set: mdb.set })
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

  it('anonymizes patient data successfully', async () => {
    mockAuth('c1')

    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.auditId).toBeDefined()
  })

  it('returns 500 on DB error', async () => {
    mockAuth('c1')
    // Make update throw
    mdb.update = jest.fn().mockImplementation(() => { throw new Error('DB error') })

    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(500)
  })
})
