/**
 * LGPD Export Route — behavioral tests
 */

// Mock auth
jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}))

import { validateApiAuth } from '@/lib/auth/session'

// Mock DB
let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
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

import { POST } from '@/app/api/lgpd/export/route'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

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
})

describe('POST /api/lgpd/export', () => {
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

  it('returns patient data with shape preserved', async () => {
    mockAuth('c1')
    seed(
      // patient
      [{ id: 'p1', name: 'João', phone: '123', clinicId: 'c1' }],
      // appointments
      [{ id: 'a1', patientId: 'p1', status: 'completed' }],
      // budgets
      [],
      // payments
      [{ id: 'pay1', patientId: 'p1', amount: '100.00' }],
    )

    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.patient).not.toBeNull()
    expect(data.patient.name).toBe('João')
    expect(data.appointments).toHaveLength(1)
    expect(data.payments).toHaveLength(1)
    expect(data.budgets).toEqual([])
    // consents should be absent (not in response)
    expect(data.consents).toBeUndefined()
  })

  it('returns null patient when not found', async () => {
    mockAuth('c1')
    seed(
      [], // patient not found
      [],
      [],
      [],
    )

    const res = await POST(mockReq({ patientId: 'p-missing' }))
    const data = await res.json()
    expect(data.patient).toBeNull()
  })
})
